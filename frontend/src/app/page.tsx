"use client";

import { useState, useEffect } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { LoginForm } from "@/components/LoginForm";
import { BoardData, BoardMeta } from "@/lib/kanban";
import { getToken, getUserId, getBoardId, setBoardId, clearAuth } from "@/lib/auth";
import { LangProvider } from "@/lib/i18nContext";

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [boards, setBoards] = useState<BoardMeta[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedToken = getToken();
    if (savedToken) {
      initSession();
    }
    const isDark = localStorage.getItem("darkMode") === "true";
    setDarkMode(isDark);
    document.body.classList.toggle("dark", isDark);
  }, []);

  const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

  const handleAuthError = () => {
    clearAuth();
    setLoggedIn(false);
    setBoardData(null);
    setBoards([]);
    setActiveBoardId(null);
  };

  const initSession = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/boards", { headers: authHeaders() });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) { handleAuthError(); return; }
        setError("Failed to load boards");
        return;
      }
      const boardList: BoardMeta[] = await res.json();
      setBoards(boardList);

      if (boardList.length === 0) { setLoggedIn(true); return; }

      const savedId = Number(getBoardId());
      const targetId = boardList.find((b) => b.id === savedId)?.id ?? boardList[0].id;
      await loadBoard(targetId, boardList);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const loadBoard = async (boardId: number, boardList?: BoardMeta[]) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/boards/${boardId}`, { headers: authHeaders() });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) { handleAuthError(); return; }
        setError("Failed to load board");
        return;
      }
      const data = await res.json();
      setBoardData(data);
      setActiveBoardId(boardId);
      setBoardId(boardId);
      if (boardList) setBoards(boardList);
      setLoggedIn(true);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    await initSession();
  };

  const handleLogout = () => {
    clearAuth();
    setLoggedIn(false);
    setBoardData(null);
    setBoards([]);
    setActiveBoardId(null);
    setError("");
  };

  const refreshBoard = async () => {
    if (!activeBoardId) return;
    try {
      const res = await fetch(`/api/boards/${activeBoardId}`, { headers: authHeaders() });
      if (res.ok) {
        setBoardData(await res.json());
      } else if (res.status === 401 || res.status === 403) {
        handleAuthError();
      }
    } catch {
      // silent refresh failure
    }
  };

  const handleUpdateBoard = async (newData: BoardData) => {
    if (!activeBoardId) return;
    try {
      const res = await fetch(`/api/boards/${activeBoardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(newData),
      });
      if (res.ok) {
        setBoardData(newData);
      } else if (res.status === 401 || res.status === 403) {
        handleAuthError();
      } else {
        await refreshBoard();
      }
    } catch {
      setError("Network error");
    }
  };

  const handleSwitchBoard = async (boardId: number) => {
    if (boardId === activeBoardId) return;
    await loadBoard(boardId);
  };

  const handleCreateBoard = async (name: string) => {
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) { setError("Failed to create board"); return; }
      const newBoard = await res.json();
      const updatedBoards = [...boards, { id: newBoard.id, name: newBoard.name, created_at: "" }];
      await loadBoard(newBoard.id, updatedBoards);
    } catch {
      setError("Network error");
    }
  };

  const handleDeleteBoard = async (boardId: number) => {
    try {
      const res = await fetch(`/api/boards/${boardId}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) { setError("Failed to delete board"); return; }
      const remaining = boards.filter((b) => b.id !== boardId);
      setBoards(remaining);
      if (activeBoardId === boardId) {
        if (remaining.length > 0) {
          await loadBoard(remaining[0].id, remaining);
        } else {
          setBoardData(null);
          setActiveBoardId(null);
        }
      }
    } catch {
      setError("Network error");
    }
  };

  const handleRenameBoard = async (boardId: number, name: string) => {
    try {
      const res = await fetch(`/api/boards/${boardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) { setError("Failed to rename board"); return; }
      setBoards((prev) => prev.map((b) => b.id === boardId ? { ...b, name } : b));
    } catch {
      setError("Network error");
    }
  };

  const toggleDarkMode = () => {
    const newDark = !darkMode;
    setDarkMode(newDark);
    localStorage.setItem("darkMode", newDark.toString());
    document.body.classList.toggle("dark", newDark);
  };

  if (!loggedIn) return <LangProvider><LoginForm onLogin={handleLogin} /></LangProvider>;

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-[var(--gray-text)]">Loading...</div>;
  }

  if (error || !boardData || activeBoardId === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-red-500">{error || "Board not found"}</p>
        <button
          onClick={handleLogout}
          className="rounded-lg bg-[var(--primary-blue)] px-4 py-2 font-semibold text-white transition hover:bg-[var(--primary-blue)]/90"
        >
          Back to Login
        </button>
      </div>
    );
  }

  return (
    <LangProvider>
      <KanbanBoard
        initialData={boardData}
        boards={boards}
        activeBoardId={activeBoardId}
        onUpdate={handleUpdateBoard}
        onLogout={handleLogout}
        onRefresh={refreshBoard}
        onToggleDark={toggleDarkMode}
        darkMode={darkMode}
        onSwitchBoard={handleSwitchBoard}
        onCreateBoard={handleCreateBoard}
        onDeleteBoard={handleDeleteBoard}
        onRenameBoard={handleRenameBoard}
      />
    </LangProvider>
  );
}
