const state = {
  products: [],
  sales: [],
  editingProductId: null,
  dashboardData: null,
  charts: {
    salesTrend: null,
    stockMix: null,
  },
};

const lowStockThreshold = 5;

document.addEventListener("DOMContentLoaded", async () => {
  window.api.requireAuth();
  hydrateUserProfile();
  bindDashboardEvents();
  presetReportInputs();

  window.appUi.setLoading(true, "Loading dashboard...");

  try {
    await Promise.all([loadDashboardSummary(), loadProducts(), loadSales(), loadReports()]);
  } catch (error) {
    window.appUi.showToast(error.message, "error");
  } finally {
    window.appUi.setLoading(false);
  }
});

function hydrateUserProfile() {
  const user = window.api.getUser();
  const name = user?.name || "Store Owner";
  const email = user?.email || "owner@store.com";
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  document.getElementById("currentUserName").textContent = name;
  document.getElementById("currentUserEmail").textContent = email;
  document.getElementById("userInitials").textContent = initials || "SI";
}

function bindDashboardEvents() {
  document.getElementById("logoutBtn").addEventListener("click", () => {
    window.api.clearSession();
    window.api.redirectToLogin();
  });

  document.getElementById("refreshDashboardBtn").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    window.appUi.setButtonLoading(button, true, "Refreshing...");

    try {
      await Promise.all([loadDashboardSummary(), loadProducts(), loadSales(), loadReports()]);
      window.appUi.showToast("Dashboard refreshed.", "info");
    } catch (error) {
      window.appUi.showToast(error.message, "error");
    } finally {
      window.appUi.setButtonLoading(button, false);
    }
  });

  document.getElementById("productForm").addEventListener("submit", handleProductSubmit);
  document.getElementById("cancelProductEditBtn").addEventListener("click", resetProductForm);
  document.getElementById("saleForm").addEventListener("submit", handleSaleSubmit);

  document.getElementById("productSearch").addEventListener("input", renderProductsTable);
  document.getElementById("productCategoryFilter").addEventListener("change", renderProductsTable);
  document.getElementById("lowStockOnly").addEventListener("change", renderProductsTable);

  document.getElementById("clearFiltersBtn").addEventListener("click", () => {
    document.getElementById("productSearch").value = "";
    document.getElementById("productCategoryFilter").value = "";
    document.getElementById("lowStockOnly").checked = false;
    renderProductsTable();
  });

  document.getElementById("saleProduct").addEventListener("change", updateSalePreview);
  document.getElementById("saleQuantity").addEventListener("input", updateSalePreview);

  document.getElementById("productsTableBody").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");

    if (!button) {
      return;
    }

    const { action, id } = button.dataset;

    if (action === "edit") {
      startProductEdit(id);
      return;
    }

    if (action === "delete") {
      await handleDeleteProduct(id, button);
    }
  });

  document.getElementById("dailyReportBtn").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    window.appUi.setButtonLoading(button, true, "Loading...");

    try {
      await loadDailyReport();
    } catch (error) {
      window.appUi.showToast(error.message, "error");
    } finally {
      window.appUi.setButtonLoading(button, false);
    }
  });

  document.getElementById("monthlyReportBtn").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    window.appUi.setButtonLoading(button, true, "Loading...");

    try {
      await loadMonthlyReport();
    } catch (error) {
      window.appUi.showToast(error.message, "error");
    } finally {
      window.appUi.setButtonLoading(button, false);
    }
  });
}

function presetReportInputs() {
  const now = new Date();
  document.getElementById("dailyReportDate").value = now.toISOString().split("T")[0];
  document.getElementById("monthlyReportMonth").value = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
}

async function loadDashboardSummary() {
  const data = await window.api.request("/api/dashboard/summary", { auth: true });
  state.dashboardData = data;
  renderMetrics(data.metrics);
  renderLowStockList(data.lowStockProducts);
  renderTopSellingList(data.topSellingProducts);
  renderCharts(data.salesTrend, data.stockByCategory);
}

async function loadProducts() {
  const data = await window.api.request("/api/products", { auth: true });
  state.products = data.products || [];
  populateCategoryFilter();
  populateSaleProductOptions();
  renderProductsTable();
  updateSalePreview();
}

async function loadSales() {
  const data = await window.api.request("/api/sales", { auth: true });
  state.sales = data.sales || [];
  renderSalesTable();
}

async function loadReports() {
  await Promise.all([loadDailyReport(), loadMonthlyReport()]);
}

async function loadDailyReport() {
  const date = document.getElementById("dailyReportDate").value;
  const data = await window.api.request(`/api/reports/daily?date=${encodeURIComponent(date)}`, {
    auth: true,
  });

  document.getElementById("dailyRevenueMetric").textContent = window.appUi.formatCurrency(
    data.summary.totalRevenue
  );
  document.getElementById("dailyTransactionsMetric").textContent = data.summary.totalTransactions;
  document.getElementById("dailyUnitsMetric").textContent = data.summary.totalUnitsSold;

  const tbody = document.getElementById("dailyReportBody");

  if (!data.productBreakdown.length) {
    tbody.innerHTML = renderEmptyRow("No sales recorded for this day.", 3);
    return;
  }

  tbody.innerHTML = data.productBreakdown
    .map(
      (item) => `
        <tr>
          <td>${window.appUi.escapeHtml(item.productName)}</td>
          <td>${item.quantitySold}</td>
          <td>${window.appUi.formatCurrency(item.revenue)}</td>
        </tr>
      `
    )
    .join("");
}

async function loadMonthlyReport() {
  const month = document.getElementById("monthlyReportMonth").value;
  const data = await window.api.request(`/api/reports/monthly?month=${encodeURIComponent(month)}`, {
    auth: true,
  });

  document.getElementById("monthlyRevenueMetric").textContent = window.appUi.formatCurrency(
    data.summary.totalRevenue
  );
  document.getElementById("monthlyTransactionsMetric").textContent =
    data.summary.totalTransactions;
  document.getElementById("monthlyUnitsMetric").textContent = data.summary.totalUnitsSold;

  const tbody = document.getElementById("monthlyReportBody");

  if (!data.dailyBreakdown.length) {
    tbody.innerHTML = renderEmptyRow("No sales recorded for this month.", 4);
    return;
  }

  tbody.innerHTML = data.dailyBreakdown
    .map(
      (item) => `
        <tr>
          <td>${window.appUi.escapeHtml(item.date)}</td>
          <td>${window.appUi.formatCurrency(item.revenue)}</td>
          <td>${item.transactions}</td>
          <td>${item.unitsSold}</td>
        </tr>
      `
    )
    .join("");
}

function renderMetrics(metrics) {
  document.getElementById("metricProducts").textContent = metrics.totalProducts;
  document.getElementById("metricSales").textContent = metrics.totalTransactions;
  document.getElementById("metricRevenue").textContent = window.appUi.formatCurrency(
    metrics.totalSalesAmount
  );
  document.getElementById("metricLowStock").textContent = metrics.lowStockCount;
  document.getElementById("inventoryUnitsMetric").textContent = metrics.totalInventoryUnits;
  document.getElementById("inventoryValueMetric").textContent = window.appUi.formatCurrency(
    metrics.inventoryValue
  );
  document.getElementById("unitsSoldMetric").textContent = metrics.totalUnitsSold;
}

function renderLowStockList(products) {
  const container = document.getElementById("lowStockList");

  if (!products.length) {
    container.innerHTML = `
      <div class="empty-state">No low stock alerts. Your inventory looks healthy.</div>
    `;
    return;
  }

  container.innerHTML = products
    .map(
      (product) => `
        <div class="list-card">
          <div>
            <strong>${window.appUi.escapeHtml(product.name)}</strong>
            <p>${window.appUi.escapeHtml(product.category)}</p>
          </div>
          <span class="badge badge-danger">${product.quantity} left</span>
        </div>
      `
    )
    .join("");
}

function renderTopSellingList(products) {
  const container = document.getElementById("topSellingList");

  if (!products.length) {
    container.innerHTML = `
      <div class="empty-state">Top-selling products will appear here once sales are recorded.</div>
    `;
    return;
  }

  container.innerHTML = products
    .map(
      (product) => `
        <div class="list-card">
          <div>
            <strong>${window.appUi.escapeHtml(product.productName)}</strong>
            <p>${product.unitsSold} units sold</p>
          </div>
          <span class="badge badge-success">${window.appUi.formatCurrency(product.revenue)}</span>
        </div>
      `
    )
    .join("");
}

function renderCharts(salesTrend, stockByCategory) {
  if (typeof Chart === "undefined") {
    return;
  }

  const salesCanvas = document.getElementById("salesTrendChart");
  const stockCanvas = document.getElementById("stockCategoryChart");

  if (state.charts.salesTrend) {
    state.charts.salesTrend.destroy();
  }

  if (state.charts.stockMix) {
    state.charts.stockMix.destroy();
  }

  state.charts.salesTrend = new Chart(salesCanvas, {
    type: "line",
    data: {
      labels: salesTrend.map((item) => item.label),
      datasets: [
        {
          label: "Revenue",
          data: salesTrend.map((item) => item.totalRevenue),
          borderColor: "#eb6b2d",
          backgroundColor: "rgba(235, 107, 45, 0.18)",
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: "#17797e",
        },
      ],
    },
    options: chartOptions(),
  });

  state.charts.stockMix = new Chart(stockCanvas, {
    type: "doughnut",
    data: {
      labels: stockByCategory.length ? stockByCategory.map((item) => item._id) : ["No Data"],
      datasets: [
        {
          data: stockByCategory.length ? stockByCategory.map((item) => item.totalUnits) : [1],
          backgroundColor: ["#eb6b2d", "#17797e", "#e2a93b", "#2d3f4f", "#f0c27b", "#5db1b5"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      ...chartOptions(),
      cutout: "62%",
    },
  });
}

function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "#50606f",
          font: {
            family: "Manrope",
            weight: "700",
          },
        },
      },
      tooltip: {
        backgroundColor: "#1d2f3a",
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#66727e",
        },
        grid: {
          color: "rgba(29, 47, 58, 0.06)",
        },
      },
      y: {
        ticks: {
          color: "#66727e",
          callback(value) {
            return window.appUi.formatCurrency(value);
          },
        },
        grid: {
          color: "rgba(29, 47, 58, 0.06)",
        },
      },
    },
  };
}

function getFilteredProducts() {
  const searchTerm = document.getElementById("productSearch").value.trim().toLowerCase();
  const category = document.getElementById("productCategoryFilter").value.trim().toLowerCase();
  const lowStockOnly = document.getElementById("lowStockOnly").checked;

  return state.products.filter((product) => {
    const matchesSearch =
      !searchTerm ||
      product.name.toLowerCase().includes(searchTerm) ||
      product.category.toLowerCase().includes(searchTerm);
    const matchesCategory = !category || product.category.toLowerCase() === category;
    const matchesLowStock = !lowStockOnly || product.quantity <= lowStockThreshold;

    return matchesSearch && matchesCategory && matchesLowStock;
  });
}

function renderProductsTable() {
  const tbody = document.getElementById("productsTableBody");
  const filteredProducts = getFilteredProducts();

  if (!filteredProducts.length) {
    tbody.innerHTML = renderEmptyRow("No products match your current filters.", 6);
    return;
  }

  tbody.innerHTML = filteredProducts
    .map((product) => {
      const statusClass = product.quantity <= lowStockThreshold ? "low" : "good";
      const statusLabel = product.quantity <= lowStockThreshold ? "Low stock" : "In stock";

      return `
        <tr>
          <td><strong>${window.appUi.escapeHtml(product.name)}</strong></td>
          <td>${window.appUi.escapeHtml(product.category)}</td>
          <td>${window.appUi.formatCurrency(product.price)}</td>
          <td><span class="status-pill ${statusClass}">${product.quantity} • ${statusLabel}</span></td>
          <td>${window.appUi.formatShortDate(product.updatedAt)}</td>
          <td>
            <div class="product-row-actions">
              <button type="button" class="btn btn-secondary" data-action="edit" data-id="${product._id}">Edit</button>
              <button type="button" class="btn btn-danger" data-action="delete" data-id="${product._id}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderSalesTable() {
  const tbody = document.getElementById("salesTableBody");

  if (!state.sales.length) {
    tbody.innerHTML = renderEmptyRow("No sales recorded yet.", 5);
    return;
  }

  tbody.innerHTML = state.sales
    .slice(0, 10)
    .map(
      (sale) => `
        <tr>
          <td>${window.appUi.escapeHtml(sale.productName)}</td>
          <td>${window.appUi.escapeHtml(sale.customerName || "Walk-in Customer")}</td>
          <td>${sale.quantity}</td>
          <td>${window.appUi.formatCurrency(sale.totalAmount)}</td>
          <td>${window.appUi.formatDate(sale.createdAt)}</td>
        </tr>
      `
    )
    .join("");
}

function populateCategoryFilter() {
  const select = document.getElementById("productCategoryFilter");
  const currentValue = select.value;
  const categories = [...new Set(state.products.map((product) => product.category))].sort((a, b) =>
    a.localeCompare(b)
  );

  select.innerHTML = `
    <option value="">All categories</option>
    ${categories
      .map(
        (category) =>
          `<option value="${window.appUi.escapeHtml(category)}">${window.appUi.escapeHtml(category)}</option>`
      )
      .join("")}
  `;

  if (categories.includes(currentValue)) {
    select.value = currentValue;
  }
}

function populateSaleProductOptions() {
  const select = document.getElementById("saleProduct");
  const currentValue = select.value;
  const inStockProducts = state.products
    .filter((product) => product.quantity > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  select.innerHTML = inStockProducts.length
    ? `
      <option value="">Choose a product</option>
      ${inStockProducts
        .map(
          (product) => `
            <option value="${product._id}">
              ${window.appUi.escapeHtml(product.name)} (${product.quantity} in stock)
            </option>
          `
        )
        .join("")}
    `
    : `<option value="">No products with available stock</option>`;

  if (inStockProducts.some((product) => product._id === currentValue)) {
    select.value = currentValue;
  }
}

function updateSalePreview() {
  const productId = document.getElementById("saleProduct").value;
  const quantity = Number(document.getElementById("saleQuantity").value || 0);
  const product = state.products.find((item) => item._id === productId);
  const previewTotal = document.getElementById("salePreviewTotal");
  const previewHint = document.getElementById("salePreviewHint");

  if (!product) {
    previewTotal.textContent = window.appUi.formatCurrency(0);
    previewHint.textContent = "Choose a product to preview sale value and stock status.";
    return;
  }

  const total = quantity > 0 ? product.price * quantity : product.price;
  previewTotal.textContent = window.appUi.formatCurrency(total);

  if (quantity > product.quantity) {
    previewHint.textContent = `Only ${product.quantity} units available in stock.`;
    return;
  }

  previewHint.textContent = `${product.quantity} units available in ${product.category}.`;
}

function startProductEdit(productId) {
  const product = state.products.find((item) => item._id === productId);

  if (!product) {
    return;
  }

  state.editingProductId = product._id;
  document.getElementById("productName").value = product.name;
  document.getElementById("productCategory").value = product.category;
  document.getElementById("productPrice").value = product.price;
  document.getElementById("productQuantity").value = product.quantity;
  document.getElementById("productFormHeading").textContent = `Edit ${product.name}`;
  document.getElementById("productSubmitBtn").textContent = "Update Product";
  document.getElementById("cancelProductEditBtn").classList.remove("hidden");
  document.getElementById("productForm").scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetProductForm() {
  state.editingProductId = null;
  document.getElementById("productForm").reset();
  document.getElementById("productFormHeading").textContent = "Add a new product";
  document.getElementById("productSubmitBtn").textContent = "Save Product";
  document.getElementById("cancelProductEditBtn").classList.add("hidden");
}

async function handleProductSubmit(event) {
  event.preventDefault();

  const submitButton = document.getElementById("productSubmitBtn");
  const isEditing = Boolean(state.editingProductId);

  window.appUi.setButtonLoading(submitButton, true, isEditing ? "Updating..." : "Saving...");

  try {
    const payload = {
      name: document.getElementById("productName").value.trim(),
      category: document.getElementById("productCategory").value.trim(),
      price: Number(document.getElementById("productPrice").value),
      quantity: Number(document.getElementById("productQuantity").value),
    };

    const endpoint = isEditing ? `/api/products/${state.editingProductId}` : "/api/products";
    const method = isEditing ? "PUT" : "POST";

    await window.api.request(endpoint, {
      method,
      auth: true,
      body: payload,
    });

    resetProductForm();
    await Promise.all([loadDashboardSummary(), loadProducts()]);
    window.appUi.showToast(
      isEditing ? "Product updated successfully." : "Product created successfully.",
      "success"
    );
  } catch (error) {
    window.appUi.showToast(error.message, "error");
  } finally {
    window.appUi.setButtonLoading(submitButton, false);
  }
}

async function handleDeleteProduct(productId, button) {
  const product = state.products.find((item) => item._id === productId);
  const confirmed = window.confirm(
    `Delete "${product?.name || "this product"}"? This action cannot be undone.`
  );

  if (!confirmed) {
    return;
  }

  window.appUi.setButtonLoading(button, true, "Deleting...");

  try {
    await window.api.request(`/api/products/${productId}`, {
      method: "DELETE",
      auth: true,
    });

    if (state.editingProductId === productId) {
      resetProductForm();
    }

    await Promise.all([loadDashboardSummary(), loadProducts()]);
    window.appUi.showToast("Product deleted successfully.", "success");
  } catch (error) {
    window.appUi.showToast(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Delete";
  }
}

async function handleSaleSubmit(event) {
  event.preventDefault();
  const submitButton = document.getElementById("saleSubmitBtn");
  window.appUi.setButtonLoading(submitButton, true, "Creating sale...");

  try {
    await window.api.request("/api/sales", {
      method: "POST",
      auth: true,
      body: {
        productId: document.getElementById("saleProduct").value,
        quantity: Number(document.getElementById("saleQuantity").value),
        customerName: document.getElementById("customerName").value.trim(),
      },
    });

    document.getElementById("saleForm").reset();
    await Promise.all([loadDashboardSummary(), loadProducts(), loadSales(), loadReports()]);
    updateSalePreview();
    window.appUi.showToast("Sale recorded successfully.", "success");
  } catch (error) {
    window.appUi.showToast(error.message, "error");
  } finally {
    window.appUi.setButtonLoading(submitButton, false);
  }
}

function renderEmptyRow(message, colspan) {
  return `<tr><td colspan="${colspan}" class="empty-state">${window.appUi.escapeHtml(message)}</td></tr>`;
}
