export const getToken = () => localStorage.getItem("access_token");
export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};
export const isLoggedIn = () => !!getToken();
export const saveAuth = (token, user) => {
  localStorage.setItem("access_token", token);
  localStorage.setItem("user", JSON.stringify(user));
};
export const clearAuth = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user");
};
