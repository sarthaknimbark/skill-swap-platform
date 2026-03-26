const axios = require("axios");

const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || "http://localhost:8001").replace(
  /\/$/,
  ""
);

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
// Render free tier can take 50–90s to wake the AI service; wait long enough
const AI_REQUEST_TIMEOUT_MS = 90_000;

exports.matchSkills = async (req, res) => {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/match-skills`,
      req.body,
      { timeout: AI_REQUEST_TIMEOUT_MS }
    );

    return res.json(response.data);
  } catch (error) {
    const isTimeout = error.code === "ECONNABORTED" || error.message?.includes("timeout");
    const isUnreachable =
      error.code === "ECONNREFUSED" ||
      error.code === "ENOTFOUND" ||
      error.response?.status >= 502;

    console.error("AI matchSkills error:", {
      aiServiceUrl: AI_SERVICE_URL,
      code: error.code,
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    if (isTimeout || isUnreachable) {
      return res.status(503).json({
        message:
          "AI service is starting up or temporarily unavailable. Please try again in 30–60 seconds.",
        code: "AI_SERVICE_UNAVAILABLE",
      });
    }

    const status = error.response?.status || 500;
    return res.status(status).json({
      message: "AI service error",
      details: error.response?.data || error.message,
    });
  }
};

