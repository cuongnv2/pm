export const getToken = () => {
  try {
    return localStorage.getItem("authToken") || "";
  } catch {
    return "";
  }
};

export const getUserId = (): string => {
  try {
    return localStorage.getItem("userId") ?? "";
  } catch {
    return "";
  }
};
