from groq import Groq
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import asyncio
from pydantic import BaseModel
from dotenv import load_dotenv
import os

app = FastAPI()
load_dotenv()

# --- CORS CONFIGURATION ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Initialize Groq Client
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

class ScanRequest(BaseModel):
    url: str
    page_content: str

@app.post("/api/ai-analyze")
async def analyze_content(request: ScanRequest):
    prompt = f"""
    ### ROLE: You are an Elite Adversarial Cybersecurity Analyst specialized in 2026-era social engineering.
    ### TASK: Analyze the content from {request.url} for high-sophistication fraud.

    ### 2026 THREAT LANDSCAPE CHECKLIST:
    1. CLICKFIX PATTERNS: Are there instructions to "copy-paste" code into a terminal or browser console to "fix" an error?
    2. STRUCTURAL DECEPTION: Are there empty <a> tags, invisible overlays, or "CAPTCHAs" that require user interaction to reveal hidden links?
    3. SENSE OF URGENCY: Does it claim a "system breach," "unauthorized payment," or "security update" is required within minutes?
    4. UNUSUAL ACTIONS: Does it ask for OAuth permissions, MFA codes, or to move the conversation to an unencrypted platform?

    ### CONTENT TO SCRUTINIZE:
    {request.page_content[:8000]}

    ### RESPONSE FORMAT (STRICT):
    **Verdict:** [Safe | Suspicious | Malicious]
    **Score:** [0-100] (0 is highly dangerous)

    **Analysis Summary:** (One concise sentence on the final conclusion.)

    **Evidence Found:**
    - [Bullet point of technical red flag 1]
    - [Bullet point of technical red flag 2]

    **Technical Verdict Logic:**
    (Explain your reasoning step-by-step. If you see "Mock content," acknowledge it but explain what specific behaviors you would flag in a real scenario to educate the user.)
    """
    
    async def stream_generator():
        try:
            chat_completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are a cybersecurity expert."},
                    {"role": "user", "content": prompt}
                ],
                stream=True,
            )

            for chunk in chat_completion:
                if chunk.choices[0].delta.content:
                    text = chunk.choices[0].delta.content
                    yield text
                    await asyncio.sleep(0.01) 

            # --- PRODUCTION FIX: Final Flush ---
            yield ""
                    
        except Exception as e:
            print(f"Groq Streaming Error: {e}")
            yield f"\n\n[Analysis Interrupted: {str(e)}]"

    return StreamingResponse(
        stream_generator(), 
        media_type="text/event-stream",
        headers={
            "X-Content-Type-Options": "nosniff",
            # "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Transfer-Encoding": "chunked", 
            "Access-Control-Allow-Origin": "*", 
        }
    )