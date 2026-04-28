const Product = require("../models/Product");
const Sale = require("../models/Sale");
const asyncHandler = require("../middleware/asyncHandler");

const buildSalesTrend = (records) => {
  const labels = [];
  const totalsMap = new Map();
  const current = new Date();

  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(current.getFullYear(), current.getMonth() - offset, 1);
    const label = date.toLocaleString("en-US", {
      month: "short",
      year: "numeric",
    });
    labels.push(label);
    totalsMap.set(`${date.getFullYear()}-${date.getMonth() + 1}`, 0);
  }

  records.forEach((record) => {
    totalsMap.set(`${record._id.year}-${record._id.month}`, Number(record.totalRevenue.toFixed(2)));
  });

  return labels.map((label, index) => {
    const date = new Date(current.getFullYear(), current.getMonth() - (5 - index), 1);
    return {
      label,
      totalRevenue: totalsMap.get(`${date.getFullYear()}-${date.getMonth() + 1}`) || 0,
    };
  });
};

const getDashboardSummary = asyncHandler(async (req, res) => {
  const owner = req.user._id;
  const lowStockThreshold = Number(process.env.LOW_STOCK_THRESHOLD || 5);

  const [totalProducts, inventorySummary, salesSummary, lowStockProducts, salesTrendRaw, stockByCategory, topSellingProducts] =
    await Promise.all([
      Product.countDocuments({ owner }),
      Product.aggregate([
        { $match: { owner } },
        {
          $group: {
            _id: null,
            totalInventoryUnits: { $sum: "$quantity" },
            inventoryValue: { $sum: { $multiply: ["$price", "$quantity"] } },
          },
        },
      ]),
      Sale.aggregate([
        { $match: { owner } },
        {
          $group: {
            _id: null,
            totalSalesAmount: { $sum: "$totalAmount" },
            totalUnitsSold: { $sum: "$quantity" },
            totalTransactions: { $sum: 1 },
          },
        },
      ]),
      Product.find({ owner, quantity: { $lte: lowStockThreshold } })
        .sort({ quantity: 1, updatedAt: -1 })
        .limit(6),
      Sale.aggregate([
        { $match: { owner } },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            totalRevenue: { $sum: "$totalAmount" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      Product.aggregate([
        { $match: { owner } },
        {
          $group: {
            _id: "$category",
            totalUnits: { $sum: "$quantity" },
            totalProducts: { $sum: 1 },
          },
        },
        { $sort: { totalUnits: -1 } },
      ]),
      Sale.aggregate([
        { $match: { owner } },
        {
          $group: {
            _id: "$productName",
            unitsSold: { $sum: "$quantity" },
            revenue: { $sum: "$totalAmount" },
          },
        },
        { $sort: { unitsSold: -1 } },
        { $limit: 5 },
      ]),
    ]);

  const inventoryMetrics = inventorySummary[0] || {
    totalInventoryUnits: 0,
    inventoryValue: 0,
  };
  const salesMetrics = salesSummary[0] || {
    totalSalesAmount: 0,
    totalUnitsSold: 0,
    totalTransactions: 0,
  };

  res.status(200).json({
    metrics: {
      totalProducts,
      totalInventoryUnits: inventoryMetrics.totalInventoryUnits || 0,
      inventoryValue: Number((inventoryMetrics.inventoryValue || 0).toFixed(2)),
      totalSalesAmount: Number((salesMetrics.totalSalesAmount || 0).toFixed(2)),
      totalUnitsSold: salesMetrics.totalUnitsSold || 0,
      totalTransactions: salesMetrics.totalTransactions || 0,
      lowStockCount: lowStockProducts.length,
    },
    lowStockProducts,
    salesTrend: buildSalesTrend(salesTrendRaw),
    stockByCategory,
    topSellingProducts: topSellingProducts.map((item) => ({
      productName: item._id,
      unitsSold: item.unitsSold,
      revenue: Number(item.revenue.toFixed(2)),
    })),
  });
});

module.exports = {
  getDashboardSummary,
};
