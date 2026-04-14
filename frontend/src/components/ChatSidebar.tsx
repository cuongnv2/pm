"use client";

import { useState } from "react";
import { getToken } from "@/lib/auth";
import { useLang } from "@/lib/i18nContext";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
}

export const ChatSidebar = ({ boardId, onRefresh, onAuthError = () => {} }: { boardId: number; onRefresh: () => void; onAuthError?: () => void }) => {
  const { t } = useLang();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { id: Date.now().toString(), text: input, isUser: true };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(`/api/ai/chat/board/${boardId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ message: userMessage.text }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), text: data.response, isUser: false }]);
        if (data.updated) onRefresh();
      } else if (response.status === 401 || response.status === 403) {
        onAuthError();
      } else {
        setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), text: `Error: ${data.error}`, isUser: false }]);
      }
    } catch {
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), text: "Network error", isUser: false }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed right-0 top-0 h-full w-72 border-l border-[var(--stroke)] bg-[var(--surface-strong)] shadow-lg z-10 flex flex-col">
      <div className="p-4 border-b border-[var(--stroke)]">
        <h2 className="text-base font-semibold text-[var(--navy-dark)]" role="heading">{t.aiAssistant}</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-xl px-3 py-2 text-sm leading-6 ${
              msg.isUser
                ? "bg-[var(--primary-blue)] text-white ml-6"
                : "bg-[var(--surface)] text-[var(--navy-dark)] mr-6"
            }`}
          >
            {msg.text}
          </div>
        ))}
        {loading && (
          <div className="text-center text-xs text-[var(--gray-text)]">{t.aiThinking}</div>
        )}
      </div>
      <div className="p-4 border-t border-[var(--stroke)]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={t.askAIPlaceholder}
            className="flex-1 rounded-lg border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-[var(--primary-blue)]/20 placeholder:text-[var(--gray-text)]/60"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-3 py-2 bg-[var(--secondary-purple)] text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition"
          >
            {t.send}
          </button>
        </div>
      </div>
    </div>
  );
};
