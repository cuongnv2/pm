"use client";

import { useState, useEffect } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { LoginForm } from "@/components/LoginForm";
import { BoardData } from "@/lib/kanban";
import { getToken, getUserId } from "@/lib/auth";

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedToken = getToken();
    if (savedToken) {
      fetchBoard();
    }
    const isDark = localStorage.getItem("darkMode") === "true";
    setDarkMode(isDark);
    document.body.classList.toggle("dark", isDark);
  }, []);

  const toggleDarkMode = () => {
    const newDark = !darkMode;
    setDarkMode(newDark);
    localStorage.setItem("darkMode", newDark.toString());
    document.body.classList.toggle("dark", newDark);
  };

  const fetchBoard = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/board/${getUserId()}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (response.ok) {
        const data = await response.json();
        setBoardData(data);
        setLoggedIn(true);
      } else if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("loggedIn");
        localStorage.removeItem("authToken");
        localStorage.removeItem("userId");
        setLoggedIn(false);
      } else {
        setError("Failed to load board");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    await fetchBoard();
  };

  const handleLogout = () => {
    localStorage.removeItem("loggedIn");
    localStorage.removeItem("authToken");
    localStorage.removeItem("userId");
    setLoggedIn(false);
    setBoardData(null);
    setError("");
  };

  const refreshBoard = async () => {
    try {
      const response = await fetch(`/api/board/${getUserId()}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (response.ok) {
        const data = await response.json();
        setBoardData(data);
      } else if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("authToken");
        localStorage.removeItem("userId");
        setLoggedIn(false);
      } else {
        setError("Failed to refresh board");
      }
    } catch {
      setError("Failed to refresh board");
    }
  };

  const handleUpdateBoard = async (newData: BoardData) => {
    try {
      const response = await fetch(`/api/board/${getUserId()}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(newData),
      });
      if (response.ok) {
        setBoardData(newData);
      } else if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("authToken");
        localStorage.removeItem("userId");
        setLoggedIn(false);
      } else {
        setError("Failed to update board");
        await refreshBoard();
      }
    } catch {
      setError("Network error");
    }
  };

  if (!loggedIn) {
    return <LoginForm onLogin={handleLogin} />;
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  if (error || !boardData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-red-500">{error || "Board not found"}</p>
        <button
          onClick={handleLogout}
          className="rounded-lg bg-blue-500 px-4 py-2 font-semibold text-white transition hover:bg-blue-700"
        >
          Back to Login
        </button>
      </div>
    );
  }

  return (
    <KanbanBoard
      initialData={boardData}
      onUpdate={handleUpdateBoard}
      onLogout={handleLogout}
      onRefresh={refreshBoard}
      onToggleDark={toggleDarkMode}
      darkMode={darkMode}
    />
  );
}
