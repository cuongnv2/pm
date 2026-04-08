"use client";

import { useState } from "react";

type LoginFormProps = {
  onLogin: () => void;
};

export const LoginForm = ({ onLogin }: LoginFormProps) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (data.success) {
      localStorage.setItem("loggedIn", "true");
      onLogin();
    } else {
      setError("Invalid credentials");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface)]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-3xl border border-[var(--stroke)] bg-white p-8 shadow-[var(--shadow)]"
      >
        <h1 className="mb-6 text-center font-display text-2xl font-semibold text-[var(--navy-dark)]">
          Login
        </h1>
        {error && (
          <p className="mb-4 text-center text-sm text-red-500">{error}</p>
        )}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--gray-text)]">
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--stroke)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--blue-primary)]"
            required
          />
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--gray-text)]">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--stroke)] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--blue-primary)]"
            required
          />
        </div>
        <input
          type="submit"
          value="Sign In"
          className="w-full rounded-lg bg-blue-500 px-4 py-2 font-semibold text-white transition hover:bg-blue-700"
        />
      </form>
    </div>
  );
};