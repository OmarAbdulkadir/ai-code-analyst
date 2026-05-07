import axios from "axios";
const API = axios.create({ baseURL: "http://localhost:8000" });
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
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
