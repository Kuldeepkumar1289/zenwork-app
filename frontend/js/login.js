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

/* Helpers */
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

function handleCompanyModeChange(mode) {
  const roleWrap = document.getElementById("regRoleSelectWrap");
  const desigInput = document.getElementById("regDesignation");
  if (mode === "create") {
    if (roleWrap) roleWrap.classList.add("hidden");
    if (desigInput && !desigInput.value) desigInput.value = "Founder & Admin";
  } else {
    if (roleWrap) roleWrap.classList.remove("hidden");
    if (desigInput && desigInput.value === "Founder & Admin") desigInput.value = "";
  }
}

function toggleAuthMode(mode) {
  document.getElementById("alertBox").classList.add("hidden");
  document.getElementById("forgotForm").classList.add("hidden");
  const isRegister = mode === "register";

  document.getElementById("loginForm").classList.toggle("hidden", isRegister);
  document.getElementById("registerForm").classList.toggle("hidden", !isRegister);

  document.getElementById("formHeading").textContent =
    isRegister ? "Register your organization" : "Welcome back";
  document.getElementById("formSubheading").textContent =
    isRegister ? "Create a company workspace first, then add employees inside Admin Control."
               : "Sign in to access your tasks, attendance, and team workspace.";
  document.getElementById("toggleText").innerHTML = isRegister
    ? `Already registered? <button type="button" onclick="toggleAuthMode('login')" class="link">Sign in</button>`
    : `New organization? <button type="button" onclick="toggleAuthMode('register')" class="link">Register organization</button>`;
}

/* Organization Sign Up */
document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("regSubmitBtn");
  btn.disabled = true;
  btn.textContent = "Creating organization...";

  try {
    const companyName = document.getElementById("regCompanyName").value.trim();

    await apiRequest("/users/register", "POST", {
      company_name:   companyName,
      is_new_company: true,
      full_name:      document.getElementById("regName").value.trim(),
      email:          document.getElementById("regEmail").value.trim(),
      designation:    document.getElementById("regDesignation").value.trim() || "Organization Admin",
      role_tier:      "ADMIN",
      password:       document.getElementById("regPassword").value
    });

    showAlert(`Organization "${companyName}" registered! Sign in as Admin to create employee accounts.`, false);
    document.getElementById("registerForm").reset();
    setTimeout(() => toggleAuthMode("login"), 1400);
  } catch (err) {
    showAlert(err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Register Organization →";
  }
});

/* Step 1: Request 6-Digit Email OTP */
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

/* Sign In */
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

/* Step 2: Verify OTP & Reset Password */
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

/* Multi-Company Sign Up */
document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("regSubmitBtn");
  btn.disabled = true;
  btn.textContent = "Setting up workspace...";

  try {
    const modeEl = document.getElementById("regCompanyMode");
    const isNewCompany = modeEl ? modeEl.value === "create" : false;
    const companyName = document.getElementById("regCompanyName").value.trim();

    await apiRequest("/users/register", "POST", {
      company_name:   companyName,
      is_new_company: isNewCompany,
      full_name:      document.getElementById("regName").value.trim(),
      email:          document.getElementById("regEmail").value.trim(),
      designation:    document.getElementById("regDesignation").value.trim() || "Team Member",
      role_tier:      isNewCompany ? "ADMIN" : document.getElementById("regRole").value,
      password:       document.getElementById("regPassword").value
    });

    showAlert(
      isNewCompany
        ? `Workspace "${companyName}" created! Sign in as Admin to manage your team.`
        : `Account created under "${companyName}"! Please sign in now.`,
      false
    );
    document.getElementById("registerForm").reset();
    handleCompanyModeChange("join");
    setTimeout(() => toggleAuthMode("login"), 1400);
  } catch (err) {
    showAlert(err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Create workspace account";
  }
});