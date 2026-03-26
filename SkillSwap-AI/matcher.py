import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer, CrossEncoder
import os
from dotenv import load_dotenv  

load_dotenv()

hf_token = os.getenv("HF_TOKEN")

bi_encoder = SentenceTransformer('all-MiniLM-L6-v2')
cross_encoder = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')


def build_skill_text(profile):

    offers = ", ".join(profile.get("skillsOffered", []))
    wants  = ", ".join(profile.get("skillsToLearn", []))
    headline = profile.get("headline", "").strip()
    about    = profile.get("aboutMe", "").strip()[:200]
    location = profile.get("location", "").strip()
    avail    = ", ".join(profile.get("availability", []))

    experience = profile.get("experience", [])
    exp_text = ""
    if experience:
        top = experience[0]
        title   = top.get("title", "").strip()
        company = top.get("company", "").strip()
        if title and company:
            exp_text = f"Works as {title} at {company}."
        elif title:
            exp_text = f"Works as {title}."

    education = profile.get("education", [])
    edu_text = ""
    if education:
        top = education[0]
        degree      = top.get("degree", "").strip()
        institution = top.get("institution", "").strip()
        if degree and institution:
            edu_text = f"Studied {degree} at {institution}."

    parts = []
    if offers:   parts.append(f"Teaches and offers: {offers}.")
    if wants:    parts.append(f"Wants to learn: {wants}.")
    if headline: parts.append(f"Headline: {headline}.")
    if about:    parts.append(f"About: {about}.")
    if exp_text: parts.append(exp_text)
    if edu_text: parts.append(edu_text)
    if avail:    parts.append(f"Available: {avail}.")
    if location: parts.append(f"Location: {location}.")

    return " ".join(parts) if parts else "No profile information."


def compute_matches(current_user, all_profiles):
    if not all_profiles:
        return []
    current_text    = build_skill_text(current_user)
    candidate_texts = [build_skill_text(p) for p in all_profiles]

    current_vec    = bi_encoder.encode([current_text], convert_to_numpy=True)
    candidate_vecs = bi_encoder.encode(candidate_texts, convert_to_numpy=True, batch_size=64)

    scores      = cosine_similarity(current_vec, candidate_vecs)[0]
    top_indices = np.argsort(scores)[::-1][:min(50, len(all_profiles))]

    # Step 3: cross-encoder reranks top 50 (slow but accurate)
    pairs = [
        [current_text, candidate_texts[i]]
        for i in top_indices
    ]
    cross_scores = cross_encoder.predict(pairs)

    # Step 4: combine transformer score + bonus score → normalize to 0–100
    results = []
    for idx, cross_score in sorted(
        zip(top_indices, cross_scores),
        key=lambda x: x[1],
        reverse=True
    ):
        profile = all_profiles[idx]

        # Normalize cross-encoder output to 0–1
        normalized = float(1 / (1 + np.exp(-cross_score * 0.5)))

        # ✅ NEW: bonus from exact field overlap
        bonus = compute_bonus(current_user, profile)

        # 70% transformer + 30% bonus → scale to 0–100
        final_score = round(float(np.clip((normalized * 0.7 + bonus * 0.3) * 100, 0, 100)), 1)

        # ✅ FIXED: userId field instead of _id
        results.append({
            "userId":  str(profile.get("userId") or profile.get("_id", "")),
            "score":   final_score,
            "reasons": generate_reasons(current_user, profile, final_score),
            # ✅ NEW: matched skills breakdown for frontend badge
            "matchedSkills": {
                "theyTeachYou": sorted(
                    set(s.lower() for s in profile.get("skillsOffered", []))
                    & set(s.lower() for s in current_user.get("skillsToLearn", []))
                ),
                "youTeachThem": sorted(
                    set(s.lower() for s in current_user.get("skillsOffered", []))
                    & set(s.lower() for s in profile.get("skillsToLearn", []))
                ),
            }
        })

    return results[:20]


def compute_bonus(current_user, candidate):
    """
    Extra signal from exact UserProfile field matches.
    Returns 0.0 to 1.0, added on top of transformer score.
    """
    bonus = 0.0

    a_offers = set(s.lower() for s in current_user.get("skillsOffered", []))
    a_wants  = set(s.lower() for s in current_user.get("skillsToLearn", []))  # ✅ FIXED
    b_offers = set(s.lower() for s in candidate.get("skillsOffered", []))
    b_wants  = set(s.lower() for s in candidate.get("skillsToLearn", []))     # ✅ FIXED

    # Bidirectional skill match — strongest signal
    they_teach_me = b_offers & a_wants
    i_teach_them  = a_offers & b_wants
    if they_teach_me:
        bonus += 0.3 * min(len(they_teach_me), 3) / 3   # up to +0.30
    if i_teach_them:
        bonus += 0.3 * min(len(i_teach_them), 3) / 3    # up to +0.30

    # Availability overlap
    a_avail = set(s.lower() for s in current_user.get("availability", []))
    b_avail = set(s.lower() for s in candidate.get("availability", []))
    if a_avail and b_avail and (a_avail & b_avail):
        bonus += 0.15

    # Same location
    a_loc = current_user.get("location", "").strip().lower()
    b_loc = candidate.get("location", "").strip().lower()
    if a_loc and b_loc and a_loc == b_loc:
        bonus += 0.10

    # Has time credits (shows active platform user)
    if candidate.get("timeCredits", 0) > 0:
        bonus += 0.05

    return min(bonus, 1.0)


def generate_reasons(user_a, user_b, score):
    reasons = []

    a_offers = set(s.lower() for s in user_a.get("skillsOffered", []))
    a_wants  = set(s.lower() for s in user_a.get("skillsToLearn", []))  # ✅ FIXED
    b_offers = set(s.lower() for s in user_b.get("skillsOffered", []))
    b_wants  = set(s.lower() for s in user_b.get("skillsToLearn", []))  # ✅ FIXED

    mutual_teach = a_offers & b_wants   # you offer what they want
    mutual_learn = b_offers & a_wants   # they offer what you want

    if mutual_learn:
        reasons.append(f"They can teach you: {', '.join(sorted(mutual_learn)[:3])}")
    if mutual_teach:
        reasons.append(f"You can teach them: {', '.join(sorted(mutual_teach)[:3])}")

    # ✅ NEW: availability reason
    a_avail = set(s.lower() for s in user_a.get("availability", []))
    b_avail = set(s.lower() for s in user_b.get("availability", []))
    shared_avail = a_avail & b_avail
    if shared_avail:
        reasons.append(f"Shared availability: {', '.join(sorted(shared_avail))}")

    # ✅ NEW: location reason
    a_loc = user_a.get("location", "").strip()
    b_loc = user_b.get("location", "").strip()
    if a_loc and b_loc and a_loc.lower() == b_loc.lower():
        reasons.append(f"Same location: {b_loc}")

    # ✅ NEW: experience context from candidate
    experience = user_b.get("experience", [])
    if experience:
        top = experience[0]
        title   = top.get("title", "").strip()
        company = top.get("company", "").strip()
        if title and company:
            reasons.append(f"Has experience as {title} at {company}")

    # Score-based general reason
    if score > 80:
        reasons.append("Very high skill compatibility overall")
    elif score > 60:
        reasons.append("Good complementary skill overlap")
    else:
        reasons.append("Some overlapping interests in skill areas")

    return reasons
