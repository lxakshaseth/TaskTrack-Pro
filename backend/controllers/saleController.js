const Product = require("../models/Product");
const Sale = require("../models/Sale");
const asyncHandler = require("../middleware/asyncHandler");

const createSale = asyncHandler(async (req, res) => {
  const { productId, quantity, customerName } = req.body;
  const parsedQuantity = Number(quantity);

  if (!productId || !parsedQuantity) {
    res.status(400);
    throw new Error("Product and quantity are required.");
  }

  if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
    res.status(400);
    throw new Error("Sale quantity must be a positive whole number.");
  }

  const updatedProduct = await Product.findOneAndUpdate(
    {
      _id: productId,
      owner: req.user._id,
      quantity: { $gte: parsedQuantity },
    },
    {
      $inc: { quantity: -parsedQuantity },
    },
    {
      new: true,
    }
  );

  if (!updatedProduct) {
    const existingProduct = await Product.findOne({
      _id: productId,
      owner: req.user._id,
    });

    if (!existingProduct) {
      res.status(404);
      throw new Error("Product not found.");
    }

    res.status(400);
    throw new Error("Insufficient stock for this sale.");
  }

  const sale = await Sale.create({
    product: updatedProduct._id,
    productName: updatedProduct.name,
    category: updatedProduct.category,
    unitPrice: updatedProduct.price,
    quantity: parsedQuantity,
    totalAmount: Number((updatedProduct.price * parsedQuantity).toFixed(2)),
    customerName: customerName?.trim() || "Walk-in Customer",
    owner: req.user._id,
    soldBy: req.user._id,
  });

  res.status(201).json({
    message: "Sale recorded successfully.",
    sale,
    remainingStock: updatedProduct.quantity,
  });
});

const getSales = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const query = { owner: req.user._id };

  if (from || to) {
    query.createdAt = {};

    if (from) {
      query.createdAt.$gte = new Date(from);
    }

    if (to) {
      const endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);
      query.createdAt.$lte = endDate;
    }
  }

  const sales = await Sale.find(query).sort({ createdAt: -1 });

  res.status(200).json({
    count: sales.length,
    sales,
  });
});

module.exports = {
  createSale,
  getSales,
};
