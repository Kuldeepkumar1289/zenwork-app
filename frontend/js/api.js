const API_BASE_URL = "http://127.0.0.1:8001/api/v1";

// Token management
function setAuthToken(token) {
    localStorage.setItem("zenwork_token", token);
}

function getAuthToken() {
    return localStorage.getItem("zenwork_token");
}

function logout() {
    localStorage.removeItem("zenwork_token");
    localStorage.removeItem("zenwork_user");
    window.location.href = "login.html";
}

// Universal Fetch Wrapper
async function apiRequest(endpoint, method = "GET", body = null, isFormData = false) {
    const token = getAuthToken();
    const headers = {};

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    if (!isFormData && body) {
        headers["Content-Type"] = "application/json";
    }

    const config = {
        method,
        headers,
    };

    if (body) {
        config.body = isFormData ? body : JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

        // Unauthorized -> redirect to login
        if (response.status === 401 && !endpoint.includes("/login")) {
            logout();
            return null;
        }

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || "Something went wrong");
        }
        return data;
    } catch (error) {
        console.error(`API Error [${endpoint}]:`, error.message);
        throw error;
    }
}