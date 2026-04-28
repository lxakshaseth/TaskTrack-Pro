const express = require("express");
const { createSale, getSales } = require("../controllers/saleController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.route("/").get(getSales).post(createSale);

module.exports = router;
