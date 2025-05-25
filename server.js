const express = require('express');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const { parse } = require('csv-parse');
require('dotenv').config();

const app = express();
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

const API_KEY = process.env.PERPLEXITY_API_KEY;
const API_URL = 'https://api.perplexity.ai/chat/completions';
const conversations = {};

const retry = async (fn, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempt ${i + 1} of ${retries}`); // Temporary log
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};
app.post('/analyst-query', async (req, res) => {
  const { userId, question } = req.body;
  if (!question || !userId) {
    return res.status(400).json({ error: 'Question and userId are required' });
  }

  try {
    if (!conversations[userId]) conversations[userId] = [];
    conversations[userId].push({ role: 'user', content: question });

    const retry = async (fn, retries = 3, delay = 1000) => {
      for (let i = 0; i < retries; i++) {
        try {
          return await fn();
        } catch (err) {
          if (i === retries - 1) throw err;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    };

    const response = await retry(() =>
      axios.post(
        API_URL,
        {
          model: 'sonar-pro',
          messages: [
            {
              role: 'system',
              content: 'You are an expert data analysis assistant. Provide a concise, practical answer to the data analysis question, include citations from reputable sources (e.g., data science blogs, documentation), and explain the reasoning step-by-step. Focus on tools like SQL, Python, PySpark, or visualization platforms (e.g., Tableau, Power BI). Format the response as JSON with fields: answer, citations, reasoning.'
            },
            ...conversations[userId]
          ],
          return_citations: true
        },
        {
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      )
    );

    const content = response.data.choices[0].message.content;
    let parsedContent;
    try {
      parsedContent = typeof content === 'string' ? JSON.parse(content) : content;
    } catch (e) {
      console.error('Parsing Error:', e.message, 'Raw Content:', content);
      parsedContent = {
        answer: content,
        citations: [],
        reasoning: ['Unable to parse reasoning; raw response provided']
      };
    }

    conversations[userId].push({ role: 'assistant', content: parsedContent });
    res.json({
      answer: parsedContent.answer || 'No answer provided',
      citations: parsedContent.citations || [],
      reasoning: parsedContent.reasoning || []
    });
  } catch (error) {
    console.error('API Error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
      request: error.config
    });
    res.status(500).json({ error: 'Failed to process question' });
  }
});
const { parse } = require('csv-parse');
const fs = require('fs');

function cleanMarkdown(content) {
  const approaches = [];
  const citations = new Set();
  let reasoning = [];

  // Split sections more reliably
  const approachSections = content.split(/\n(?=\*\*\d\.\s)/);

  approachSections.forEach(section => {
    const titleMatch = section.match(/\*\*(\d\.\s*.*?)\*\*/);
    const title = titleMatch ? titleMatch[1].trim() : '';

    const descriptionMatch = section.match(/-+\s*Approach:\s*([\s\S]*?)(?=\n-|\*\*|$)/i);
    const description = descriptionMatch ? descriptionMatch[1].trim() : '';

    const toolsMatch = section.match(/-+\s*Tools:\s*([\s\S]*?)(?=\n-|\*\*|$)/i);
    const tools = toolsMatch 
      ? toolsMatch[1].split(/,|\n/).map(t => t.trim()).filter(Boolean) 
      : [];

    const reasoningMatch = section.match(/-+\s*Reasoning:\s*([\s\S]*?)(?=\n-|\*\*|$)/i);
    const sectionReasoning = reasoningMatch 
      ? reasoningMatch[1].trim().split('\n').map(r => r.replace(/^-+\s*/, '').trim()).filter(Boolean) 
      : [];

    reasoning = reasoning.concat(sectionReasoning);

    approaches.push({ title, description, tools });
  });

  // Extract citations like [1], [2]
  const citationMatches = content.match(/\[(\d+)\]/g) || [];
  citationMatches.forEach(citation => citations.add(citation));

  return {
    approaches,
    citations: Array.from(citations),
    reasoning
  };
}


app.post('/analyze-data', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File is required' });
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  try {
    const records = [];
    fs.createReadStream(req.file.path)
      .pipe(parse({ columns: true }))
      .on('data', (record) => records.push(record))
      .on('end', async () => {
        if (!records.length) throw new Error('Empty or invalid CSV');
        const schema = Object.keys(records[0]);
        const prompt = `Given this sample data structure (columns: ${schema.join(', ')}), suggest three detailed data analysis approaches (e.g., statistical analysis, visualization, machine learning), recommend tools (e.g., SQL, Python, Tableau), include citations from reputable sources, and explain Reasoning step-by-step.`;
        if (!conversations[userId]) conversations[userId] = [];
        conversations[userId].push({ role: 'user', content: prompt });
        const response = await retry(() => axios.post(
          API_URL,
          {
            model: 'sonar-pro',
            messages: [
              { role: 'system', content: 'Provide detailed, practical data analysis recommendations.' },
              ...conversations[userId]
            ],
            return_citations: true
          },
          {
            headers: {
              'Authorization': `Bearer ${API_KEY}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          }
        ));
        const content = response.data.choices[0].message.content; // Extract content
        const cleanedContent = cleanMarkdown(content);
        conversations[userId].push({ role: 'assistant', content });
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Failed to delete file:', err);
        });
        res.json(cleanedContent);
      });
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to analyze data' });
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));