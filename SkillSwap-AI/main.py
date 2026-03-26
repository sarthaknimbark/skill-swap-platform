from fastapi import FastAPI
from matcher import compute_matches
from models import MatchRequest, MatchResponse

app = FastAPI()

@app.post("/match", response_model=list[MatchResponse])
async def match_skills(req: MatchRequest):
    results = compute_matches(req.currentUser, req.candidates)
    return results

@app.get("/health")
async def health():
    return {"status": "ok"}