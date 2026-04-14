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

export const getBoardId = (): string => {
  try {
    return localStorage.getItem("boardId") ?? "";
  } catch {
    return "";
  }
};

export const setBoardId = (boardId: number | string) => {
  try {
    localStorage.setItem("boardId", String(boardId));
  } catch {
    // ignore
  }
};

export const clearAuth = () => {
  try {
    localStorage.removeItem("loggedIn");
    localStorage.removeItem("authToken");
    localStorage.removeItem("userId");
    localStorage.removeItem("boardId");
  } catch {
    // ignore
  }
};
