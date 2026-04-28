(function bootstrapAppApi() {
  const TOKEN_KEY = "smart_inventory_token";
  const USER_KEY = "smart_inventory_user";

  // ✅ Use Vite env (NO meta tag anymore)
  const API_BASE_URL = "https://tasktrack-pro-nl6i.onrender.com";

  const parseJson = (value) => {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

  const buildApiUrl = (endpoint) => {
    if (/^https?:\/\//i.test(endpoint)) return endpoint;

    const base = API_BASE_URL.replace(/\/+$/, "");
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

    return `${base}${path}`;
  };

  const ui = {
    showToast(message, type = "success") {
      const container = document.getElementById("toastContainer");
      if (!container) return;

      const toast = document.createElement("div");
      toast.className = `toast ${type}`;
      toast.textContent = message;
      container.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-8px)";
      }, 2600);

      setTimeout(() => toast.remove(), 3000);
    },

    setLoading(isLoading, message = "Working...") {
      const overlay = document.getElementById("loadingOverlay");
      const text = document.getElementById("loadingText");

      if (!overlay) return;

      overlay.classList.toggle("hidden", !isLoading);
      if (text) text.textContent = message;
    },

    setButtonLoading(button, isLoading, label = "Please wait...") {
      if (!button) return;

      if (!button.dataset.defaultLabel) {
        button.dataset.defaultLabel = button.textContent;
      }

      button.disabled = isLoading;
      button.textContent = isLoading
        ? label
        : button.dataset.defaultLabel;
    },

    formatCurrency(value) {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
      }).format(Number(value || 0));
    },

    formatDate(value) {
      if (!value) return "N/A";

      return new Date(value).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    },

    formatShortDate(value) {
      if (!value) return "N/A";

      return new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    },

    escapeHtml(value = "") {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    },
  };

  const api = {
    getToken() {
      return localStorage.getItem(TOKEN_KEY);
    },

    getUser() {
      return parseJson(localStorage.getItem(USER_KEY));
    },

    setSession(payload) {
      if (payload?.token) {
        localStorage.setItem(TOKEN_KEY, payload.token);
      }

      if (payload?.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
      }
    },

    clearSession() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },

    redirectToLogin() {
      window.location.href = "./index.html";
    },

    redirectToDashboard() {
      window.location.href = "./dashboard.html";
    },

    requireAuth() {
      if (!this.getToken()) {
        this.redirectToLogin();
      }
    },

    async request(endpoint, options = {}) {
      const { method = "GET", body, auth = false, headers = {} } = options;

      const requestHeaders = { ...headers };

      if (body !== undefined) {
        requestHeaders["Content-Type"] = "application/json";
      }

      if (auth) {
        requestHeaders.Authorization = `Bearer ${this.getToken()}`;
      }

      let response;

      try {
        response = await fetch(buildApiUrl(endpoint), {
          method,
          headers: requestHeaders,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
      } catch (error) {
        throw new Error(
          "Unable to reach the API. Check backend URL or server status."
        );
      }

      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        if (response.status === 401) {
          this.clearSession();

          if (!window.location.pathname.endsWith("index.html")) {
            this.redirectToLogin();
          }
        }

        throw new Error(data?.message || "Request failed.");
      }

      return data;
    },
  };

  window.api = api;
  window.appUi = ui;
})();