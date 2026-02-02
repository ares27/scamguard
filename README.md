# SyncZen // ScamGuard 🛡️

**AI-Powered Behavioral Cybersecurity Analyst (v1.0.0)**

ScamGuard is a 2026-era browser extension designed to detect high-sophistication fraud, including ClickFix patterns and structural deception that traditional antivirus tools miss.

## 🚀 Architecture

- **Frontend**: React + Vite + Tailwind (Chrome Extension SidePanel)
- **Primary Backend**: Node.js/Express (Metadata & Reputation API)
- **AI Engine**: Python/FastAPI + Groq (Llama 3.3 70B)

## 🛠️ Setup

1. **Server-PY**: Navigate to `/server-py`, create a `.env` with `GROQ_API_KEY`, and run `uvicorn ai_service:app`.
2. **Server**: Navigate to `/server`, run `npm install` and `node index.js`.
3. **Client**: Run `npm run build` and load the `dist` folder into Chrome via `Developer Mode`.

## 🧠 Features

- **Live Behavioral Analysis**: Real-time scanning for social engineering tactics.
- **Neural Link UI**: Interactive Markdown reports with "Gemini-style" readability.
- **2026 Threat Database**: Specifically tuned for modern "terminal-injection" scams.
