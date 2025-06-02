# ⚡ Pocket Analyst

**Pocket Analyst** is a web-based data analysis platform that empowers users to explore datasets and query data analysis techniques. It offers interactive visualizations, actionable insights, and transparent citations as raw URLs.

Users can upload CSV or Excel files for analysis or ask questions about data techniques, receiving detailed responses powered by the Perplexity Sonar API. Built with React, Express, and Chart.js, Pocket Analyst combines a mobile-responsive design with a neon aesthetic, featuring Orbitron and Roboto fonts and a dark/light mode toggle.

---

## 📑 Table of Contents

- [Features](#🚀-features)
- [Getting Started](#🧰-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#🛠️-installation)
  - [Running Locally](#▶️-running-locally)
- [Usage](#📂-usage)
  - [Uploading CSV Data](#📤-uploading-csv-data)
  - [Querying Data Techniques](#❓-querying-data-techniques)
- [Technical Architecture](#🧱-technical-architecture)
  - [Frontend](#🖥️-frontend)
  - [Backend](#🧪-backend)
  - [API Integration](#🔌-api-integration)
- [File Structure](#📁-file-structure)
- [Troubleshooting](#🛠️-troubleshooting)
- [Contributing](#🤝-contributing)
- [Roadmap](#🧭-roadmap)

---

## 🚀 Features

- **CSV Data Analysis**: Upload CSV files to generate insights, business recommendations, and future analysis methods via `/analyze-data`.
- **Interactive Visualizations**: Bar charts using Chart.js.
- **Query Interface**: Ask data questions like “How to find duplicates in SQL?” via `/analyst-query`.
- **Transparent Citations**: Raw clickable URLs like `https://www.atlassian.com/...`.
- **Mobile-Responsive Design**: Styled with Tailwind CSS.
- **Future Analysis Tools**: Recommends tools like PySpark, Tableau, and methods like clustering.
- **Scalable Backend**: Express server with Sonar API integration.
- **Error Handling**: Graceful messages and console logging.

---

## 🧰 Getting Started

### Prerequisites

- Node.js v16+ [Download](https://nodejs.org/)
- Perplexity Sonar API Key [Get it here](https://www.perplexity.ai/)
- VS Code (Recommended)
- Git & Browser (Chrome, Firefox, Edge)

---

### 🛠️ Installation

```bash
git clone https://github.com/your-username/pocket-analyst.git
cd pocket-analyst
npm install express axios dotenv csv-parse multer cors
Create a .env file:

env

Collapse

Wrap

Copy
PERPLEXITY_API_KEY=your_api_key_here
▶️ Running Locally
bash

Collapse

Wrap

Run

Copy
node server.js
Then visit: http://localhost:3000

📂 Usage
📤 Uploading CSV Data
Navigate to Upload Data.
Upload a file (sample.csv):
text

Collapse

Wrap

Copy
order_id,user_id,product_id,order_date,category,product_name,price,quantity,revenue,...
1,101,201,2025-01-01,Electronics,Laptop,1000,1,1000,...
2,102,202,2025-01-02,Clothing,Shirt,50,2,100,...
Click "How can we analyze this Data?"
Output
Chart: Revenue by category (e.g., Electronics $3800)
Insights: Trends like "Electronics = 86% revenue"
Recommendations: Business strategies
Future Analysis: Tools & methods
Citations: Raw URLs or “No external sources cited”
❓ Querying Data Techniques
Navigate to Questions.
Enter a question: "How to find duplicates in SQL?"
Click Execute
Output
Results: SQL example using GROUP BY
Citations: [1] https://www.atlassian.com/...
Reasoning: Explanation from Sonar
Follow-up: Optional additional input
🧱 Technical Architecture
🖥️ Frontend
Framework: React (JSX via CDN)
Styling: Tailwind CSS with Cyberpunk theme:
Neon Pink #FF007A
Cyan #00D4FF
Purple #9D00FF
Fonts:
Orbitron (titles/buttons)
Roboto (text)
Charts: Chart.js v4
Components:
Sidebar, AnalystQueryInput, DataUpload, Chart, ResultDisplay, ThemeToggle
Error Handling: ErrorBoundary
🧪 Backend
Framework: Express.js
File Handling: Multer for CSVs, csv-parse
Endpoints:
POST /analyst-query
POST /analyze-data
Session: conversationHistories Map
CORS: Enabled
Errors: Console logs and UI alerts
🔌 API Integration
Service: Perplexity Sonar
Endpoint: https://api.perplexity.ai/chat/completions
Model: sonar-pro
Auth: Bearer Token via .env
Citations:
Inline like [1] mapped to raw URLs
📁 File Structure
text

Collapse

Wrap

Copy
pocket-analyst/
├── public/            # Static frontend
├── uploads/           # CSV uploads
├── docs/              # Screenshots
├── .env               # API keys
├── server.js          # Express backend
├── sample.csv         # Demo file
├── README.md
├── package.json
└── node_modules/
🛠️ Troubleshooting
Server won't start: Check terminal logs and .env
No citations: Inspect /analyst-query response in browser dev tools
Chart not rendering: Ensure correct CSV structure
Mobile issues: Use Chrome DevTools, inspect Tailwind sm: classes
🤝 Contributing
We welcome contributions!

bash

Collapse

Wrap

Run

Copy
# Fork + Clone
git clone https://github.com/kishanraj41/pocket-analyst.git

# Create branch
git checkout -b feature/your-feature

# Commit
git commit -m "Add your-feature"
git push origin feature/your-feature
🧭 Roadmap
✅ Short-Term
Add More Visualizations based on Data
Validate uploaded CSVs and Excel Files
Improve accessibility
Live Q/A regarding uploaded data
Browser Extension
🛤️ Mid-Term
Real-time data stream support
New API Integration for Deeper analysis
🚀 Long-Term
Mobile and Desktop app
Storage for Personalization
CI/CD and unit testing
