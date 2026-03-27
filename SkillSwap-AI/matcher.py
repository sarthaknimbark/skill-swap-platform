"""
Skill-Swap Matcher — prioritises complementary skill overlap.

Matching logic:
  1. Exact skill overlap  (they teach what you want & you teach what they want)
  2. Semantic similarity   (bi-encoder + cross-encoder for fuzzy skill matching)
  3. Bonus signals         (availability, location, experience)

Score is 0–100, higher = better match.
"""

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer, CrossEncoder
import os
from dotenv import load_dotenv

load_dotenv()

hf_token = os.getenv("HF_TOKEN")

bi_encoder = SentenceTransformer("all-MiniLM-L6-v2")
cross_encoder = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")


# ── helpers ────────────────────────────────────────────────────────────────

def _lower_set(lst):
    """Normalise a list of strings to a lowercase set."""
    return set(s.strip().lower() for s in (lst or []) if s.strip())


def _skill_text(skills):
    """Join skills into a single string for embedding."""
    return ", ".join(sorted(skills)) if skills else ""


# ── core matching ──────────────────────────────────────────────────────────

def compute_skill_overlap(seeker, candidate):
    """
    Compute direct (exact) skill overlap score.
    Returns a dict with breakdown and a 0–1 score.
    """
    seeker_offers = _lower_set(seeker.get("skillsOffered", []))
    seeker_wants  = _lower_set(seeker.get("skillsToLearn", []))
    cand_offers   = _lower_set(candidate.get("skillsOffered", []))
    cand_wants    = _lower_set(candidate.get("skillsToLearn", []))

    # They teach what I want to learn
    they_teach_me = cand_offers & seeker_wants
    # I teach what they want to learn
    i_teach_them  = seeker_offers & cand_wants

    # Bidirectional match is the strongest signal
    total_possible = max(len(seeker_wants) + len(cand_wants), 1)
    matched = len(they_teach_me) + len(i_teach_them)
    overlap_score = min(matched / total_possible, 1.0)

    # Give extra weight when BOTH directions match (true swap)
    if they_teach_me and i_teach_them:
        overlap_score = min(overlap_score + 0.25, 1.0)

    return {
        "score": overlap_score,
        "they_teach_me": they_teach_me,
        "i_teach_them": i_teach_them,
    }


def build_skill_query(profile):
    """
    Build a text representation focused on SKILLS for semantic matching.
    """
    parts = []
    offers = profile.get("skillsOffered", [])
    wants  = profile.get("skillsToLearn", [])
    if offers:
        parts.append(f"Can teach: {', '.join(offers)}")
    if wants:
        parts.append(f"Wants to learn: {', '.join(wants)}")
    headline = (profile.get("headline") or "").strip()
    if headline:
        parts.append(headline)
    about = (profile.get("aboutMe") or "").strip()[:200]
    if about:
        parts.append(about)
    return " | ".join(parts) if parts else "No skills listed."


def compute_bonus(seeker, candidate):
    """
    Small bonus for availability overlap, location, and experience.
    Returns 0.0–1.0
    """
    bonus = 0.0

    # Availability overlap
    a_avail = _lower_set(seeker.get("availability", []))
    b_avail = _lower_set(candidate.get("availability", []))
    if a_avail and b_avail and (a_avail & b_avail):
        bonus += 0.10

    # Same location
    a_loc = (seeker.get("location") or "").strip().lower()
    b_loc = (candidate.get("location") or "").strip().lower()
    if a_loc and b_loc and a_loc == b_loc:
        bonus += 0.10

    # Active user indicator
    if candidate.get("timeCredits", 0) > 0:
        bonus += 0.05

    return min(bonus, 1.0)


def compute_matches(current_user, all_profiles):
    """
    Main matching pipeline.

    Scoring breakdown (0–100):
      50%  — exact skill overlap  (they_teach_me + i_teach_them)
      35%  — semantic similarity   (bi-encoder + cross-encoder)
      15%  — bonus signals         (availability, location, activity)
    """
    if not all_profiles:
        return []

    # ── Step 1: exact skill overlap ──────────────────────────────────
    overlaps = []
    for p in all_profiles:
        overlaps.append(compute_skill_overlap(current_user, p))

    # ── Step 2: semantic similarity ──────────────────────────────────
    seeker_text    = build_skill_query(current_user)
    candidate_texts = [build_skill_query(p) for p in all_profiles]

    seeker_vec     = bi_encoder.encode([seeker_text], convert_to_numpy=True)
    candidate_vecs = bi_encoder.encode(candidate_texts, convert_to_numpy=True, batch_size=64)

    cos_scores = cosine_similarity(seeker_vec, candidate_vecs)[0]

    # Short-list top 50 by bi-encoder for cross-encoder reranking
    top_k = min(50, len(all_profiles))
    top_indices = np.argsort(cos_scores)[::-1][:top_k]

    pairs = [[seeker_text, candidate_texts[i]] for i in top_indices]
    cross_scores_raw = cross_encoder.predict(pairs)

    # Map cross-encoder scores back
    cross_map = {}
    for idx, cs in zip(top_indices, cross_scores_raw):
        cross_map[idx] = float(1 / (1 + np.exp(-cs * 0.5)))  # sigmoid normalise

    # ── Step 3: combine all signals ──────────────────────────────────
    results = []
    for idx, profile in enumerate(all_profiles):
        overlap = overlaps[idx]
        semantic = cross_map.get(idx, float(cos_scores[idx]))  # fallback to bi-encoder
        bonus = compute_bonus(current_user, profile)

        # Weighted combination → scale to 0–100
        final = (overlap["score"] * 0.50 + semantic * 0.35 + bonus * 0.15) * 100
        final = round(float(np.clip(final, 0, 100)), 1)

        # Skip profiles with zero skill relevance
        if final < 5 and not overlap["they_teach_me"] and not overlap["i_teach_them"]:
            continue

        results.append({
            "userId":  str(profile.get("userId") or profile.get("_id", "")),
            "score":   final,
            "reasons": generate_reasons(current_user, profile, overlap, final),
            "matchedSkills": {
                "theyTeachYou": sorted(overlap["they_teach_me"]),
                "youTeachThem": sorted(overlap["i_teach_them"]),
            },
        })

    # Sort by score descending
    results.sort(key=lambda r: r["score"], reverse=True)
    return results[:20]


def generate_reasons(seeker, candidate, overlap, score):
    """Human-readable reasons explaining why this is a good match."""
    reasons = []

    if overlap["they_teach_me"]:
        skills = ", ".join(sorted(overlap["they_teach_me"])[:3])
        reasons.append(f"They can teach you: {skills}")

    if overlap["i_teach_them"]:
        skills = ", ".join(sorted(overlap["i_teach_them"])[:3])
        reasons.append(f"You can teach them: {skills}")

    if overlap["they_teach_me"] and overlap["i_teach_them"]:
        reasons.append("Perfect two-way skill swap!")

    # Availability
    a_avail = _lower_set(seeker.get("availability", []))
    b_avail = _lower_set(candidate.get("availability", []))
    shared = a_avail & b_avail
    if shared:
        reasons.append(f"Shared availability: {', '.join(sorted(shared))}")

    # Location
    a_loc = (seeker.get("location") or "").strip()
    b_loc = (candidate.get("location") or "").strip()
    if a_loc and b_loc and a_loc.lower() == b_loc.lower():
        reasons.append(f"Same location: {b_loc}")

    # Experience context
    experience = candidate.get("experience", [])
    if experience:
        top = experience[0]
        title = (top.get("title") or "").strip()
        company = (top.get("company") or "").strip()
        if title and company:
            reasons.append(f"Has experience as {title} at {company}")

    # Score-based summary
    if score > 80:
        reasons.append("Excellent skill compatibility")
    elif score > 60:
        reasons.append("Good complementary skill overlap")
    elif score > 40:
        reasons.append("Some matching skill interests")

    return reasons
