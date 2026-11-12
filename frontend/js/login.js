

if (getAuthToken()) {
  window.location.href = "index.html";
}

// Sync login page background & accent colors automatically with current time of day
document.addEventListener("DOMContentLoaded", () => {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  if (typeof DaylightTheme !== "undefined") {
    DaylightTheme.apply(hour);
  }
  const hr = now.getHours();
  const badge = document.getElementById("loginGreetingBadge");
  if (badge) {
    badge.textContent = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : hr < 20 ? "Good evening" : "Good night";
  }
});

/* ---------- Helpers ---------- */
function showAlert(msg, isError = true) {
  const box = document.getElementById("alertBox");
  box.textContent = msg;
  box.style.background = isError ? "rgba(220, 38, 38, 0.14)" : "rgba(29, 107, 82, 0.16)";
  box.style.border = isError ? "1px solid rgba(220, 38, 38, 0.35)" : "1px solid var(--line)";
  box.style.color = isError ? "#b91c1c" : "var(--ink)";
  box.classList.remove("hidden");
}

function togglePassVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  const isHidden = input.type === "password";
  input.type = isHidden ? "text" : "password";
  btn.textContent = isHidden ? "Hide" : "Show";
}

function toggleAuthMode(mode) {
  document.getElementById("alertBox").classList.add("hidden");
  document.getElementById("forgotForm").classList.add("hidden");
  const isRegister = mode === "register";

  document.getElementById("loginForm").classList.toggle("hidden", isRegister);
  document.getElementById("registerForm").classList.toggle("hidden", !isRegister);

  document.getElementById("formHeading").textContent =
    isRegister ? "Create your account" : "Welcome back";
  document.getElementById("formSubheading").textContent =
    isRegister ? "Join your company workspace on Zenwork."
               : "Sign in to access your tasks, attendance, and team workspace.";
  document.getElementById("toggleText").innerHTML = isRegister
    ? `Already have an account? <button type="button" onclick="toggleAuthMode('login')" class="link">Sign in</button>`
    : `Don't have an account? <button type="button" onclick="toggleAuthMode('register')" class="link">Sign up</button>`;
}

function toggleForgotPanel(showForgot) {
  document.getElementById("alertBox").classList.add("hidden");
  document.getElementById("registerForm").classList.add("hidden");
  document.getElementById("loginForm").classList.toggle("hidden", showForgot);
  document.getElementById("forgotForm").classList.toggle("hidden", !showForgot);

  document.getElementById("formHeading").textContent =
    showForgot ? "Reset password" : "Welcome back";
  document.getElementById("formSubheading").textContent =
    showForgot ? "Enter your registered work email to set a new password."
               : "Sign in to access your tasks, attendance, and team workspace.";
}

/* ---------- Sign In ---------- */
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("loginSubmitBtn");
  btn.disabled = true;
  btn.textContent = "Signing in...";

  try {
    const formData = new URLSearchParams();
    formData.append("username", document.getElementById("loginEmail").value);
    formData.append("password", document.getElementById("loginPassword").value);

    const response = await fetch(`${API_BASE_URL}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Invalid email or password");

    setAuthToken(data.access_token);
    const profile = await apiRequest("/users/me");
    localStorage.setItem("zenwork_user", JSON.stringify(profile));
    window.location.href = "index.html";
  } catch (err) {
    showAlert(err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign in to workspace →";
  }
});

/* ---------- Inline Forgot Password ---------- */
document.getElementById("forgotForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("forgotSubmitBtn");
  btn.disabled = true;
  btn.textContent = "Resetting...";

  try {
    const email = document.getElementById("forgotEmail").value;
    const new_password = document.getElementById("forgotNewPassword").value;
    const res = await apiRequest("/users/forgot-password", "POST", { email, new_password });
    showAlert(res.message, false);
    document.getElementById("forgotForm").reset();
    setTimeout(() => toggleForgotPanel(false), 1400);
  } catch (err) {
    showAlert(err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Reset password";
  }
});

/* ---------- Sign Up ---------- */
document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("regSubmitBtn");
  btn.disabled = true;
  btn.textContent = "Creating account...";

  try {
    await apiRequest("/users/register", "POST", {
      full_name:   document.getElementById("regName").value,
      email:       document.getElementById("regEmail").value,
      designation: document.getElementById("regDesignation").value,
      role_tier:   document.getElementById("regRole").value,
      password:    document.getElementById("regPassword").value
    });
    showAlert("Account created successfully! Please sign in now.", false);
    document.getElementById("registerForm").reset();
    setTimeout(() => toggleAuthMode("login"), 1200);
  } catch (err) {
    showAlert(err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Create account";
  }
});