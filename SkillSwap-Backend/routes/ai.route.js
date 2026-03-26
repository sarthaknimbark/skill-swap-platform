const express = require("express");
const aiController = require("../controllers/ai.controller");

const router = express.Router();

// POST /api/ai/match-skills
router.post("/match-skills", aiController.matchSkills);

module.exports = router;

