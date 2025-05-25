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

// Retry function for API calls
const retry = async (fn, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempt ${i + 1} of ${retries}`); // Debug log
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Endpoint for general data analysis questions
app.post('/analyst-query', async (req, res) => {
  const { userId, question } = req.body;
  if (!question || !userId) {
    return res.status(400).json({ error: 'Question and userId are required' });
  }

  try {
    if (!conversations[userId]) conversations[userId] = [];
    conversations[userId].push({ role: 'user', content: question });

    const response = await retry(() =>
      axios.post(
        API_URL,
        {
          model: 'sonar-pro',
          messages: [
            {
              role: 'system',
              content: 'You are an expert data analysis assistant. Provide a concise, practical answer to the data analysis question, include citations from reputable sources (e.g., data science blogs, documentation), and explain the reasoning step-by-step. Focus on tools like SQL, Python, PySpark, or visualization platforms (e.g., Tableau, Power BI). Format the response as JSON with fields: answer (string), citations (array of strings), reasoning (array of strings).'
            },
            ...conversations[userId]
          ],
          return_citations: true
        },
        {
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      )
    );

    let parsedContent;
    try {
      parsedContent = JSON.parse(response.data.choices[0].message.content);
    } catch (e) {
      console.error('Parsing Error:', e.message, 'Raw Content:', response.data.choices[0].message.content);
      parsedContent = {
        answer: response.data.choices[0].message.content,
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
      message: error.message
    });
    res.status(500).json({ error: 'Failed to process question' });
  }
});

// Endpoint for sample data analysis
app.post('/analyze-data', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File is required' });
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const records = [];
    const parser = fs.createReadStream(req.file.path).pipe(parse({ columns: true }));
    
    parser
      .on('data', (record) => records.push(record))
      .on('end', async () => {
        try {
          if (!records.length) throw new Error('Empty or invalid CSV');
          const schema = Object.keys(records[0]);
          console.log('Parsed Schema:', schema); // Debug log

          const prompt = `Given this sample data structure (columns: ${schema.join(', ')}), suggest three detailed data analysis approaches (e.g., statistical analysis, visualization, machine learning). For each approach, provide a title, a detailed description, recommended tools (e.g., SQL, Python, Tableau), and citations from reputable sources. Include a step-by-step reasoning explanation for all approaches. Return the response in JSON format with fields: approaches (array of {title: string, description: string, tools: array of strings}), citations (array of strings), reasoning (array of strings).`;

          if (!conversations[userId]) conversations[userId] = [];
          conversations[userId].push({ role: 'user', content: prompt });

          const response = await retry(() =>
            axios.post(
              API_URL,
              {
                model: 'sonar-pro',
                messages: [
                  {
                    role: 'system',
                    content: 'Provide detailed, practical data analysis recommendations in JSON format.'
                  },
                  ...conversations[userId]
                ],
                return_citations: true
              },
              {
                headers: {
                  Authorization: `Bearer ${API_KEY}`,
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                }
              }
            )
          );

          let parsedContent;
          try {
            parsedContent = JSON.parse(response.data.choices[0].message.content);
          } catch (e) {
            console.error('Parsing Error:', e.message, 'Raw Content:', response.data.choices[0].message.content);
            parsedContent = {
              approaches: [],
              citations: [],
              reasoning: ['Unable to parse response; raw content logged']
            };
          }

          conversations[userId].push({ role: 'assistant', content: parsedContent });
          res.json({
            approaches: parsedContent.approaches || [],
            citations: parsedContent.citations || [],
            reasoning: parsedContent.reasoning || []
          });
        } catch (error) {
          console.error('Processing Error:', error.message);
          res.status(500).json({ error: 'Failed to analyze data' });
        } finally {
          fs.unlink(req.file.path, (err) => {
            if (err) console.error('Failed to delete file:', err);
          });
        }
      })
      .on('error', (error) => {
        console.error('CSV Parse Error:', error.message);
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Failed to delete file:', err);
        });
        res.status(500).json({ error: 'Failed to parse CSV' });
      });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'Failed to analyze data' });
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));