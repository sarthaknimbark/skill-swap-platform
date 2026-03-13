from typing import List, Optional

from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer, util
import numpy as np


app = FastAPI(
    title="SkillSwap AI Service",
    description="Transformer-based skill matching for Skill Swap platform",
    version="1.0.0",
)


class ProfileIn(BaseModel):
    user_id: str
    fullname: Optional[str] = None
    headline: Optional[str] = None
    about_me: Optional[str] = None
    skills_offered: List[str] = []
    skills_to_learn: List[str] = []
    location: Optional[str] = None


class MatchQuery(BaseModel):
    seeker: ProfileIn
    candidates: List[ProfileIn]
    top_k: int = 10


class MatchResult(BaseModel):
    user_id: str
    score: float
    reason: str


class MatchResponse(BaseModel):
    matches: List[MatchResult]


_model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    """
    Lazy-load the transformer model once per process.
    Uses a lightweight sentence-transformer suitable for semantic similarity.
    """
    global _model
    if _model is None:
        _model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    return _model


def build_profile_text(profile: ProfileIn, focus: str = "offered") -> str:
    """Convert a profile into a single text string for embedding."""
    parts: list[str] = []

    if profile.fullname:
        parts.append(profile.fullname)
    if profile.headline:
        parts.append(profile.headline)
    if profile.about_me:
        parts.append(profile.about_me)

    if focus == "offered":
        skills = profile.skills_offered
    else:
        skills = profile.skills_to_learn

    if skills:
        parts.append("Skills: " + ", ".join(skills))

    if profile.location:
        parts.append(f"Location: {profile.location}")

    return " | ".join(parts)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/match-skills", response_model=MatchResponse)
async def match_skills(payload: MatchQuery) -> MatchResponse:
    """
    Rank candidate profiles for a seeker using semantic similarity.

    Intuition:
    - We want people whose **skills_offered** match what the seeker wants to learn.
    - We also lightly reward overlap between offered skills (mutual expertise).
    """
    if not payload.candidates:
        return MatchResponse(matches=[])

    model = get_model()

    # Text standing for "what the seeker is looking for"
    seeker_need_text = build_profile_text(payload.seeker, focus="to_learn")
    seeker_offer_text = build_profile_text(payload.seeker, focus="offered")

    # Fallbacks if seeker fields are empty
    if not seeker_need_text.strip():
        seeker_need_text = seeker_offer_text or "general learning interests"
    if not seeker_offer_text.strip():
        seeker_offer_text = seeker_need_text or "general skills"

    seeker_need_emb = model.encode(seeker_need_text, convert_to_tensor=True)
    seeker_offer_emb = model.encode(seeker_offer_text, convert_to_tensor=True)

    cand_need_texts: list[str] = []
    cand_offer_texts: list[str] = []

    for c in payload.candidates:
        cand_need_texts.append(build_profile_text(c, focus="to_learn"))
        cand_offer_texts.append(build_profile_text(c, focus="offered"))

    cand_need_embs = model.encode(cand_need_texts, convert_to_tensor=True)
    cand_offer_embs = model.encode(cand_offer_texts, convert_to_tensor=True)

    # Core scores:
    # 1) How well candidate's offered skills match seeker's learning needs
    need_match_scores = util.cos_sim(seeker_need_emb, cand_offer_embs)[0]
    # 2) How well candidate wants to learn what seeker can offer (mutual exchange)
    mutual_match_scores = util.cos_sim(seeker_offer_emb, cand_need_embs)[0]

    # Weighted combination
    need_weight = 0.7
    mutual_weight = 0.3
    combined = need_weight * need_match_scores + mutual_weight * mutual_match_scores

    combined_np = combined.cpu().numpy().astype(float)

    # Sort by score desc, keep top_k
    top_k = min(payload.top_k, len(payload.candidates))
    top_indices = np.argsort(-combined_np)[:top_k]

    matches: list[MatchResult] = []
    for idx in top_indices:
        c = payload.candidates[int(idx)]
        score = float(combined_np[int(idx)])
        reason = (
            "Strong match between their offered skills and what you want to learn; "
            "plus some alignment in mutual learning interests."
        )
        matches.append(
            MatchResult(
                user_id=c.user_id,
                score=round(score, 4),
                reason=reason,
            )
        )

    return MatchResponse(matches=matches)


# For local development:
# uvicorn app.main:app --host 0.0.0.0 --port 8001

