"use client";

import { useState } from "react";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
}

export const ChatSidebar = ({ onRefresh }: { onRefresh: () => void }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      isUser: true,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat/1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage.text }),
      });
      const data = await response.json();
      if (response.ok) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: data.response,
          isUser: false,
        };
        setMessages((prev) => [...prev, aiMessage]);
        if (data.updated) {
          onRefresh();
        }
      } else {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: `Error: ${data.error}`,
          isUser: false,
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (err) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Network error",
        isUser: false,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-white border-l border-[var(--stroke)] shadow-lg z-10 flex flex-col">
      <div className="p-4 border-b border-[var(--stroke)]">
        <h2 className="text-lg font-semibold text-[var(--navy-dark)]">AI Assistant</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`p-3 rounded-lg ${
              msg.isUser
                ? "bg-[var(--primary-blue)] text-white ml-8"
                : "bg-[var(--surface)] text-[var(--navy-dark)] mr-8"
            }`}
          >
            {msg.text}
          </div>
        ))}
        {loading && (
          <div className="text-center text-[var(--gray-text)]">AI is thinking...</div>
        )}
      </div>
      <div className="p-4 border-t border-[var(--stroke)]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask the AI..."
            className="flex-1 px-3 py-2 border border-[var(--stroke)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-[var(--secondary-purple)] text-white rounded-lg hover:bg-[var(--secondary-purple)]/90 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};