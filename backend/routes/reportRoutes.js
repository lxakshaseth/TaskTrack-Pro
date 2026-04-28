const express = require("express");
const {
  getDailyReport,
  getMonthlyReport,
} = require("../controllers/reportController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.get("/daily", getDailyReport);
router.get("/monthly", getMonthlyReport);

module.exports = router;
