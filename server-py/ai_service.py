from groq import Groq
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi import Header, HTTPException
import asyncio
from pydantic import BaseModel
from typing import Dict, Any, Optional
from dotenv import load_dotenv
import os

class ScanRequest(BaseModel):
    url: str
    page_content: str
    dossier: Dict[str, Any] = {} # Handles the structured metadata object

app = FastAPI()
load_dotenv()

# --- CORS CONFIGURATION ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["Content-Type", "X-ScamGuard-Secret"],
    expose_headers=["*"]
)

# Initialize Groq Client
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

class ScanRequest(BaseModel):
    url: str
    page_content: str

@app.post("/api/ai-analyze")
async def analyze_content(request: ScanRequest, x_scamguard_secret: str = Header(None)):

    dossier = request.dossier
    
    # 1. MITIGATE ABUSE: Verify the secret handshake
    expected_secret = os.getenv("APP_SECRET", "default_fallback_secret")
    
    if x_scamguard_secret != expected_secret:
        raise HTTPException(status_code=403, detail="Unauthorized request source.")
    
    prompt = f"""
    ### ROLE: Elite Adversarial Cybersecurity Analyst (2026 Specialization)
    ### CONTEXT: You are analyzing {request.url}. 
    
    ### TECHNICAL DOSSIER (GROUND TRUTH):
    The following infrastructure data was captured via server-side fingerprinting. Use this to verify or debunk the claims made in the page content:
    - Domain Age: {dossier.get('domain_age', 'Unknown')}
    - Trustpilot Score: {dossier.get('trustpilot_score', 'N/A')}/5
    - Hosting Provider: {dossier.get('provider', 'Unknown')}
    - Asset Hotlinking Alert: {dossier.get('hotlink_alert', 'False')}
    - Assets Stolen From: {dossier.get('stolen_from', 'None')}

    ### PAGE CONTENT TO ANALYZE:
    {request.page_content[:6000]}

    ### ADVERSARIAL ANALYSIS INSTRUCTIONS:
    1. CROSS-REFERENCE: Does the 'Page Content' claim to be a reputable brand (e.g., Amazon, Chase, Microsoft) while the 'Assets Stolen From' or 'Domain Age' indicates it is a clone?
    2. INFRASTRUCTURE MISMATCH: If 'Hotlink Alert' is TRUE, assume the site is a phishing template mirroring a legitimate service.
    3. NEW DOMAIN BIAS: If 'Domain Age' is < 6 months, treat any 'Sense of Urgency' or 'Payment Requests' as high-probability fraud.
    4. CLICKFIX/SOCIAL ENGINEERING: Look for instructions asking the user to run scripts or bypass browser security.

    ### RESPONSE FORMAT (STRICT):
    **Verdict:** [Safe | Suspicious | Malicious]
    **Score:** [0-100] (0 is critical danger)

    **Analysis Summary:** (One concise sentence. Example: "Infrastructure mismatch detected: Site claims to be [Brand] but steals assets from [Domain].")

    **Evidence Found:**
    - [Infrastructure Flag]: Compare Dossier data to Page Content.
    - [Behavioral Flag]: Specific social engineering tactics found in text.

    **Technical Verdict Logic:**
    (Explain the correlation between the Technical Dossier and the Page Content. Focus on why the infrastructure does or does not support the legitimacy of the site's claims. Max 100 words.)
    """
    
    async def stream_generator():
        try:
            chat_completion = client.chat.completions.create(
                model="llama3-8b-8192",  # cheaper model for development 
                # model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are a cybersecurity expert."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5,
                max_tokens=150,  # Hard limit to prevent long, expensive responses
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