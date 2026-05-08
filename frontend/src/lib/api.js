import axios from "axios";
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});
API.interceptors.response.use(
  (res) => res,
  (err) => {
    const isAuthRoute = err.config?.url?.startsWith("/auth/");
    if (err.response?.status === 401 && !isAuthRoute) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);
export const analyzeCode = (code, description) =>
  API.post("/analyze", { code, description });
export const signup = (email, password, display_name) =>
  API.post("/auth/signup", { email, password, display_name });
export const login = (email, password) =>
  API.post("/auth/login", { email, password });
export const logoutApi = () => API.post("/auth/logout");
export const getMe = () => API.get("/auth/me");
export const getSessions = () => API.get("/sessions");
export const getSession = (id) => API.get(`/sessions/${id}`);
export const getStats = () => API.get("/sessions/stats");
export default API;
