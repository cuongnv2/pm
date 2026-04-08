"use client";

import { useState, useEffect } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { LoginForm } from "@/components/LoginForm";
import { BoardData } from "@/lib/kanban";

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const isLoggedIn = localStorage.getItem("loggedIn") === "true";
    if (isLoggedIn) {
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
    try {
      const response = await fetch("/api/board/1");
      if (response.ok) {
        const data = await response.json();
        setBoardData(data);
        setLoggedIn(true);
      } else {
        setError("Failed to load board");
      }
    } catch (err) {
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
    setLoggedIn(false);
    setBoardData(null);
  };

  const refreshBoard = async () => {
    try {
      const response = await fetch("/api/board/1");
      if (response.ok) {
        const data = await response.json();
        setBoardData(data);
      }
    } catch (err) {
      setError("Failed to refresh board");
    }
  };

  const handleUpdateBoard = async (newData: BoardData) => {
    try {
      const response = await fetch("/api/board/1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newData),
      });
      if (response.ok) {
        setBoardData(newData);
      } else {
        setError("Failed to update board");
      }
    } catch (err) {
      setError("Network error");
    }
  };

  if (!loggedIn) {
    return <LoginForm onLogin={handleLogin} />;
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  if (error) {
    return <div className="flex min-h-screen items-center justify-center text-red-500">{error}</div>;
  }

  return <KanbanBoard initialData={boardData} onUpdate={handleUpdateBoard} onLogout={handleLogout} onRefresh={refreshBoard} onToggleDark={toggleDarkMode} darkMode={darkMode} />;
}
