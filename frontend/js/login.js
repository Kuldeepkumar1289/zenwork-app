if (getAuthToken()) {
  window.location.href = "index.html";
}

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
    isRegister ? "Register company workspace" : "Welcome back";
  document.getElementById("formSubheading").textContent =
    isRegister ? "Create your organization workspace, then invite employees from Admin Control."
               : "Sign in with your company email and password.";
  document.getElementById("toggleText").innerHTML = isRegister
    ? `Already have an account? <button type="button" onclick="toggleAuthMode('login')" class="link">Sign in</button>`
    : `Setting up a new company? <button type="button" onclick="toggleAuthMode('register')" class="link">Register company workspace</button>`;
}

function toggleForgotPanel(showForgot) {
  document.getElementById("alertBox").classList.add("hidden");
  document.getElementById("registerForm").classList.add("hidden");
  document.getElementById("loginForm").classList.toggle("hidden", showForgot);
  document.getElementById("forgotForm").classList.toggle("hidden", !showForgot);

  const otpFields = document.getElementById("otpVerifyFields");
  const submitBtn = document.getElementById("forgotSubmitBtn");
  const emailInput = document.getElementById("forgotEmail");
  const sendBtn = document.getElementById("sendOtpBtn");
  if (otpFields) otpFields.classList.add("hidden");
  if (emailInput) emailInput.readOnly = false;
  if (sendBtn) sendBtn.textContent = "Send OTP";
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add("opacity-60", "cursor-not-allowed");
  }

  document.getElementById("formHeading").textContent =
    showForgot ? "Reset password" : "Welcome back";
  document.getElementById("formSubheading").textContent =
    showForgot ? "Verify your registered work email with a 6-digit OTP."
               : "Sign in with your company email and password.";
}

async function requestResetOtp() {
  const email = document.getElementById("forgotEmail").value.trim();
  if (!email) {
    showAlert("Please enter your registered work email first.", true);
    return;
  }

  const sendBtn = document.getElementById("sendOtpBtn");
  sendBtn.disabled = true;
  sendBtn.textContent = "Sending...";

  try {
    const res = await apiRequest("/users/forgot-password/send-otp", "POST", { email });
    showAlert(res.message, false);

    document.getElementById("forgotEmail").readOnly = true;
    document.getElementById("otpVerifyFields").classList.remove("hidden");
    document.getElementById("forgotOtp").required = true;
    document.getElementById("forgotNewPassword").required = true;

    const submitBtn = document.getElementById("forgotSubmitBtn");
    submitBtn.disabled = false;
    submitBtn.classList.remove("opacity-60", "cursor-not-allowed");
    sendBtn.textContent = "Resend OTP";
  } catch (err) {
    showAlert(err.message, true);
    sendBtn.textContent = "Send OTP";
  } finally {
    sendBtn.disabled = false;
  }
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("loginSubmitBtn");
  btn.disabled = true;
  btn.textContent = "Signing in...";

  try {
    const formData = new URLSearchParams();
    formData.append("username", document.getElementById("loginEmail").value.trim());
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

document.getElementById("forgotForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("forgotSubmitBtn");
  btn.disabled = true;
  btn.textContent = "Verifying OTP...";

  try {
    const email = document.getElementById("forgotEmail").value.trim();
    const otp = document.getElementById("forgotOtp").value.trim();
    const new_password = document.getElementById("forgotNewPassword").value;

    const res = await apiRequest("/users/forgot-password/verify-reset", "POST", {
      email,
      otp,
      new_password
    });

    showAlert(res.message, false);
    document.getElementById("forgotForm").reset();
    setTimeout(() => toggleForgotPanel(false), 1500);
  } catch (err) {
    showAlert(err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Verify OTP & Reset";
  }
});

document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("regSubmitBtn");
  btn.disabled = true;
  btn.textContent = "Creating workspace...";

  try {
    const companyName = document.getElementById("regCompanyName").value.trim();
    const companyCode = document.getElementById("regCompanyCode").value.trim().toUpperCase();

    const created = await apiRequest("/users/register", "POST", {
      company_name: companyName,
      company_code: companyCode || null,
      full_name:    document.getElementById("regName").value.trim(),
      email:        document.getElementById("regEmail").value.trim(),
      designation:  "Organization Admin",
      password:     document.getElementById("regPassword").value
    });

    showAlert(
      `Company "${created.company_name}" (${created.company_code}) created! Sign in to onboard your employees.`,
      false
    );
    document.getElementById("registerForm").reset();
    setTimeout(() => toggleAuthMode("login"), 1600);
  } catch (err) {
    showAlert(err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Create Company Workspace →";
  }
});