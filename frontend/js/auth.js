document.addEventListener("DOMContentLoaded", () => {
  if (window.api.getToken()) {
    window.api.redirectToDashboard();
    return;
  }

  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const tabButtons = document.querySelectorAll("[data-tab]");

  const toggleTab = (tab) => {
    tabButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === tab);
    });

    loginForm.classList.toggle("hidden", tab !== "login");
    registerForm.classList.toggle("hidden", tab !== "register");
  };

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => toggleTab(button.dataset.tab));
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = loginForm.querySelector('button[type="submit"]');

    window.appUi.setButtonLoading(submitButton, true, "Signing in...");

    try {
      const payload = await window.api.request("/api/auth/login", {
        method: "POST",
        body: {
          email: document.getElementById("loginEmail").value.trim(),
          password: document.getElementById("loginPassword").value,
        },
      });

      window.api.setSession(payload);
      window.appUi.showToast("Login successful. Opening dashboard...", "success");
      setTimeout(() => window.api.redirectToDashboard(), 500);
    } catch (error) {
      window.appUi.showToast(error.message, "error");
    } finally {
      window.appUi.setButtonLoading(submitButton, false);
    }
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = registerForm.querySelector('button[type="submit"]');

    window.appUi.setButtonLoading(submitButton, true, "Creating account...");

    try {
      const payload = await window.api.request("/api/auth/register", {
        method: "POST",
        body: {
          name: document.getElementById("registerName").value.trim(),
          email: document.getElementById("registerEmail").value.trim(),
          password: document.getElementById("registerPassword").value,
        },
      });

      window.api.setSession(payload);
      window.appUi.showToast("Account created successfully.", "success");
      setTimeout(() => window.api.redirectToDashboard(), 500);
    } catch (error) {
      window.appUi.showToast(error.message, "error");
    } finally {
      window.appUi.setButtonLoading(submitButton, false);
    }
  });
});
