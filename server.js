const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const { parse } = require('csv-parse');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');

dotenv.config();
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });
const conversationHistories = new Map();

function stripMarkdown(text) {
  return text
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/(\!\[.*?\]\(.*?\))/g, '')
    .replace(/(\#+\s)/g, '');
}

function extractInlineCitations(text, apiCitations) {
  const matches = text.match(/\[(\d+)\]/g) || [];
  const uniqueRefs = [...new Set(matches.map(ref => parseInt(ref.replace(/[\[\]]/g, ''))))];
  
  const citations = uniqueRefs.map(num => {
    const apiCitation = apiCitations[num - 1];
    return {
      index: num,
      source: apiCitation || `Reference ${num}`
    };
  });

  console.log('Extracted citations:', citations);
  return citations;
}

function generateChartConfig(records, headers) {
  if (!records.length || !headers.includes('category') || !headers.includes('revenue')) {
    return null;
  }

  const categoryRevenue = records.reduce((acc, record) => {
    const category = record.category || 'Unknown';
    const revenue = parseFloat(record.revenue) || 0;
    acc[category] = (acc[category] || 0) + revenue;
    return acc;
  }, {});

  const labels = Object.keys(categoryRevenue);
  const data = Object.values(categoryRevenue);

  return {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Revenue by Category ($)',
        data,
        backgroundColor: ['#FF007A', '#00D4FF', '#9D00FF', '#FFD700', '#E6E6FA'],
        borderColor: ['#FF007A', '#00D4FF', '#9D00FF', '#FFD700', '#E6E6FA'],
        borderWidth: 1
      }]
    },
    options: {
      animation: false,
      responsive: true,
      plugins: {
        legend: { display: true, labels: { color: '#E6E6FA', font: { size: 12 } } },
        title: { display: true, text: 'Revenue by Category', color: '#E6E6FA', font: { size: 16 } }
      },
      scales: {
        x: { ticks: { color: '#E6E6FA', font: { size: 10 } }, grid: { color: '#2A2A4A' } },
        y: { ticks: { color: '#E6E6FA', font: { size: 10 } }, grid: { color: '#2A2A4A' }, beginAtZero: true }
      }
    }
  };
}

async function callSonarAPI(prompt, userId, isFollowUp = false, jsonSchema = null) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  let messages = [
    { 
      role: 'system', 
      content: 'You are an expert data analyst. Provide detailed, actionable insights with clear reasoning. Return citations as raw URLs corresponding to inline references (e.g., [1]).' 
    },
    { role: 'user', content: prompt }
  ];

  if (isFollowUp && conversationHistories.has(userId)) {
    messages = [...conversationHistories.get(userId), ...messages];
  }

  try {
    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'sonar-pro',
        messages,
        max_tokens: 4096,
        return_citations: true,
        response_format: jsonSchema ? { 
          type: 'json_schema',
          json_schema: jsonSchema
        } : undefined
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    let answer = response.data.choices[0].message.content;
    let citations = response.data.citations || [];
    
    if (jsonSchema) {
      answer = JSON.parse(answer);
    } else {
      answer = stripMarkdown(answer);
      citations = extractInlineCitations(answer, citations);
    }

    console.log('Sonar API full response:', JSON.stringify(response.data, null, 2));
    console.log('Processed answer length:', answer.length, 'Citations:', citations);
    conversationHistories.set(userId, messages.concat([{ role: 'assistant', content: JSON.stringify(answer) }]));
    return { answer, citations };
  } catch (error) {
    console.error('Sonar API error:', error.response?.data || error.message);
    throw new Error('Failed to fetch response from Sonar API');
  }
}

app.post('/analyst-query', async (req, res) => {
  const { userId, question } = req.body;
  if (!userId || !question) {
    return res.status(400).json({ error: 'userId and question are required' });
  }

  try {
    const prompt = `${question}\nProvide a detailed response with specific examples. Return citations as raw URLs corresponding to inline references (e.g., [1]).`;
    const { answer, citations } = await callSonarAPI(prompt, userId, false);
    const reasoning = [`Queried Sonar API with: "${question}"`, 'Generated detailed response with citations.'];
    const formattedAnswer = answer.split('\n').filter(line => line.trim()).map(line => line.trim());
    res.json({ answer: formattedAnswer, reasoning, citations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/analyze-data', upload.single('file'), async (req, res) => {
  const { userId } = req.body;
  const file = req.file;

  if (!userId || !file) {
    return res.status(400).json({ error: 'userId and file are required' });
  }

  const filePath = file.path;
  try {
    const parser = fs.createReadStream(filePath).pipe(parse({ columns: true }));
    let records = [];
    let headers = null;
    let summary = { unique: {}, totals: {} };

    for await (const record of parser) {
      if (!headers) headers = Object.keys(record);
      records.push(record);
      headers.forEach(col => {
        if (!summary.unique[col]) summary.unique[col] = new Set();
        summary.unique[col].add(record[col]);
        if (!isNaN(parseFloat(record[col]))) {
          summary.totals[col] = (summary.totals[col] || 0) + parseFloat(record[col]);
        }
      });
      if (records.length >= 10) break;
    }

    if (!headers || records.length === 0) {
      throw new Error('Failed to parse CSV or empty file');
    }

    console.log('Parsed schema:', headers);
    const sampleData = JSON.stringify(records, null, 2);
    const summaryText = Object.entries(summary.unique).map(([col, vals]) => 
      `${col}: ${vals.size} unique values`
    ).join('\n') + '\n' + Object.entries(summary.totals).map(([col, total]) => 
      `${col}: total ${total}`
    ).join('\n');

    const chartConfig = generateChartConfig(records, headers);

    const jsonSchema = {
      name: 'ecommerce_analysis',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          insights: { type: 'array', items: { type: 'string' } },
          recommendations: { type: 'array', items: { type: 'string' } },
          methods: { type: 'array', items: { type: 'string' } },
          future_analysis: { type: 'array', items: { type: 'string' } },
          tools: { type: 'array', items: { type: 'string' } }
        },
        required: ['insights', 'recommendations', 'methods', 'future_analysis', 'tools'],
        additionalProperties: false
      }
    };

    const prompt = `
      You are a data analyst analyzing an e-commerce CSV dataset.
      - Columns: ${headers.join(', ')}
      - Sample data (up to 10 rows): ${sampleData}
      - Summary: ${summaryText}
      Provide a detailed analysis with:
      - Insights: Specific trends, patterns, or outliers (e.g., revenue by category, payment method distribution, return rates by device or country, seasonal trends in order_date).
      - Recommendations: Actionable business strategies (e.g., optimize shipping for high-cost regions, target high-return devices, promote popular payment methods).
      - Analysis Methods: Methods used (e.g., aggregation, frequency analysis).
      - Future Analysis: Detailed methods with best practices (e.g., ANOVA in PySpark for category revenue, k-means clustering in scikit-learn for customer segmentation, interactive Tableau dashboards with filters).
      - Tools: Tools for future analysis (e.g., PySpark, Tableau, scikit-learn).
      Ensure each section is comprehensive with specific examples. Return citations as raw URLs corresponding to inline references (e.g., [1]).
      Return a JSON object matching the schema provided in the response_format.
    `;

    const { answer, citations } = await callSonarAPI(prompt, userId, false, jsonSchema);
    const reasoning = [
      `Parsed CSV with schema: ${headers.join(', ')}`,
      `Summarized data: ${summaryText.split('\n').slice(0, 2).join('; ')}...`,
      `Generated detailed analysis with Sonar API`
    ];

    const formattedInsights = [
      {
        title: 'Key Insights',
        description: answer.insights?.join('\n') || 'No insights provided'
      },
      {
        title: 'Business Recommendations',
        description: answer.recommendations?.join('\n') || 'No recommendations provided'
      },
      {
        title: 'Analysis Methods',
        description: answer.methods?.join('\n') || 'No methods provided'
      },
      {
        title: 'Future Analysis',
        description: answer.future_analysis?.join('\n') || 'No future analysis provided',
        tools: answer.tools || ['None specified']
      }
    ];

    res.json({ insights: formattedInsights, reasoning, citations, chartConfig });
  } catch (error) {
    console.error('Error processing file:', error.message);
    res.status(500).json({ error: error.message });
  } finally {
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting file:', err.message);
    });
  }
});

app.listen(port, () => console.log(`Server running on port ${port}`));