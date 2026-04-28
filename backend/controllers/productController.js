const Product = require("../models/Product");
const asyncHandler = require("../middleware/asyncHandler");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findConflictingProduct = async (ownerId, name, excludeId) => {
  const query = {
    owner: ownerId,
    name: { $regex: `^${escapeRegex(name.trim())}$`, $options: "i" },
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return Product.findOne(query);
};

const getProducts = asyncHandler(async (req, res) => {
  const { search = "", category = "", lowStock = "" } = req.query;
  const lowStockThreshold = Number(process.env.LOW_STOCK_THRESHOLD || 5);

  const query = { owner: req.user._id };

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
    ];
  }

  if (category) {
    query.category = { $regex: `^${escapeRegex(category)}$`, $options: "i" };
  }

  if (lowStock === "true") {
    query.quantity = { $lte: lowStockThreshold };
  }

  const products = await Product.find(query).sort({ updatedAt: -1 });

  res.status(200).json({
    count: products.length,
    products,
  });
});

const createProduct = asyncHandler(async (req, res) => {
  const { name, price, quantity, category } = req.body;

  if (!name || price === undefined || quantity === undefined || !category) {
    res.status(400);
    throw new Error("Name, price, quantity, and category are required.");
  }

  if (Number(price) < 0 || Number(quantity) < 0) {
    res.status(400);
    throw new Error("Price and quantity must be non-negative.");
  }

  const existingProduct = await findConflictingProduct(req.user._id, name);

  if (existingProduct) {
    res.status(409);
    throw new Error("A product with this name already exists.");
  }

  const product = await Product.create({
    name: name.trim(),
    price: Number(price),
    quantity: Number(quantity),
    category: category.trim(),
    owner: req.user._id,
  });

  res.status(201).json({
    message: "Product created successfully.",
    product,
  });
});

const updateProduct = asyncHandler(async (req, res) => {
  const { name, price, quantity, category } = req.body;

  const product = await Product.findOne({
    _id: req.params.id,
    owner: req.user._id,
  });

  if (!product) {
    res.status(404);
    throw new Error("Product not found.");
  }

  if (name) {
    const existingProduct = await findConflictingProduct(req.user._id, name, product._id);

    if (existingProduct) {
      res.status(409);
      throw new Error("Another product with this name already exists.");
    }

    product.name = name.trim();
  }

  if (price !== undefined) {
    if (Number(price) < 0) {
      res.status(400);
      throw new Error("Price must be non-negative.");
    }

    product.price = Number(price);
  }

  if (quantity !== undefined) {
    if (Number(quantity) < 0) {
      res.status(400);
      throw new Error("Quantity must be non-negative.");
    }

    product.quantity = Number(quantity);
  }

  if (category) {
    product.category = category.trim();
  }

  const updatedProduct = await product.save();

  res.status(200).json({
    message: "Product updated successfully.",
    product: updatedProduct,
  });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOneAndDelete({
    _id: req.params.id,
    owner: req.user._id,
  });

  if (!product) {
    res.status(404);
    throw new Error("Product not found.");
  }

  res.status(200).json({
    message: "Product deleted successfully.",
  });
});

module.exports = {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
};
