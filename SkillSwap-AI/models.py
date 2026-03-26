# models.py
from pydantic import BaseModel

class UserProfile(BaseModel):
    _id: str
    skillsOffered: list[str]
    skillsWanted: list[str]

class MatchRequest(BaseModel):
    currentUser: UserProfile
    candidates: list[UserProfile]

class MatchResponse(BaseModel):
    userId: str
    score: float
    reasons: list[str]