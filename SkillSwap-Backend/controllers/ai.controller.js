const axios = require("axios");

const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL || "http://localhost:8001";

/**
 * Proxy endpoint that forwards skill matching requests
 * from the Node backend to the Python FastAPI service.
 *
 * Expects body:
 * {
 *   seeker: { user_id, fullname, headline, about_me, skills_offered, skills_to_learn, location },
 *   candidates: [ { ...same as seeker... } ],
 *   top_k?: number
 * }
 */
exports.matchSkills = async (req, res) => {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/match-skills`,
      req.body,
      { timeout: 10_000 }
    );

    return res.json(response.data);
  } catch (error) {
    console.error("AI matchSkills error:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    return res
      .status(status)
      .json({ message: "AI service error", details: error.response?.data || error.message });
  }
};

