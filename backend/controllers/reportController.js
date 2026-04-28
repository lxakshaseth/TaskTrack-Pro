const Sale = require("../models/Sale");
const asyncHandler = require("../middleware/asyncHandler");

const getDayRange = (dateValue) => {
  const baseDate = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + 1);
  return { start, end };
};

const getMonthRange = (monthValue) => {
  const baseDate = monthValue ? new Date(`${monthValue}-01T00:00:00`) : new Date();
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
  return { start, end };
};

const getDailyReport = asyncHandler(async (req, res) => {
  const { start, end } = getDayRange(req.query.date);
  const owner = req.user._id;

  const [summary, productBreakdown] = await Promise.all([
    Sale.aggregate([
      {
        $match: {
          owner,
          createdAt: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          totalTransactions: { $sum: 1 },
          totalUnitsSold: { $sum: "$quantity" },
        },
      },
    ]),
    Sale.aggregate([
      {
        $match: {
          owner,
          createdAt: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: "$productName",
          quantitySold: { $sum: "$quantity" },
          revenue: { $sum: "$totalAmount" },
        },
      },
      { $sort: { revenue: -1 } },
    ]),
  ]);

  const metrics = summary[0] || {
    totalRevenue: 0,
    totalTransactions: 0,
    totalUnitsSold: 0,
  };

  res.status(200).json({
    date: start.toISOString().split("T")[0],
    summary: {
      totalRevenue: Number((metrics.totalRevenue || 0).toFixed(2)),
      totalTransactions: metrics.totalTransactions || 0,
      totalUnitsSold: metrics.totalUnitsSold || 0,
    },
    productBreakdown: productBreakdown.map((item) => ({
      productName: item._id,
      quantitySold: item.quantitySold,
      revenue: Number(item.revenue.toFixed(2)),
    })),
  });
});

const getMonthlyReport = asyncHandler(async (req, res) => {
  const { start, end } = getMonthRange(req.query.month);
  const owner = req.user._id;

  const [summary, dailyBreakdown] = await Promise.all([
    Sale.aggregate([
      {
        $match: {
          owner,
          createdAt: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          totalTransactions: { $sum: 1 },
          totalUnitsSold: { $sum: "$quantity" },
        },
      },
    ]),
    Sale.aggregate([
      {
        $match: {
          owner,
          createdAt: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          revenue: { $sum: "$totalAmount" },
          transactions: { $sum: 1 },
          unitsSold: { $sum: "$quantity" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]),
  ]);

  const metrics = summary[0] || {
    totalRevenue: 0,
    totalTransactions: 0,
    totalUnitsSold: 0,
  };

  res.status(200).json({
    month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
    summary: {
      totalRevenue: Number((metrics.totalRevenue || 0).toFixed(2)),
      totalTransactions: metrics.totalTransactions || 0,
      totalUnitsSold: metrics.totalUnitsSold || 0,
    },
    dailyBreakdown: dailyBreakdown.map((item) => ({
      date: `${item._id.year}-${String(item._id.month).padStart(2, "0")}-${String(item._id.day).padStart(2, "0")}`,
      revenue: Number(item.revenue.toFixed(2)),
      transactions: item.transactions,
      unitsSold: item.unitsSold,
    })),
  });
});

module.exports = {
  getDailyReport,
  getMonthlyReport,
};
