"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  ts: Date;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your AI health coordinator. I'm here to help with your medications, answer health questions, and support your care plan. How are you feeling today?",
      ts: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load patientId from session
  useEffect(() => {
    fetch("/api/patients/me")
      .then((r) => r.json())
      .then((d) => setPatientId(d.id ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: "user", content: input.trim(), ts: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          message: userMsg.content,
          history,
        }),
      });

      if (!res.ok) throw new Error("Request failed");

      const data = await res.json();
      const aiMsg: Message = {
        role: "assistant",
        content: data.response,
        ts: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      if (data.requiresEscalation) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "⚠️ I've alerted your care team about what you shared. If this is an emergency, please call 911 immediately.",
            ts: new Date(),
          },
        ]);
      }
    } catch {
      setError("Sorry, I couldn't connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 60px - 3rem)",
        background: "white",
        borderRadius: "0.75rem",
        border: "1px solid #e2e8f0",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "1rem 1.25rem",
          borderBottom: "1px solid #e2e8f0",
          background: "linear-gradient(135deg, #212070, #06ABEB)",
          color: "white",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.25rem",
          }}
        >
          🤖
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "1rem" }}>AI Health Coordinator</div>
          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.8)" }}>
            ClawHealth · Mount Sinai West Cardiology
          </div>
        </div>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.75rem",
            color: "rgba(255,255,255,0.8)",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#10b981",
              display: "inline-block",
            }}
          />
          Online
        </div>
      </div>

      {/* HIPAA notice */}
      <div
        style={{
          padding: "0.5rem 1rem",
          background: "#f0fdf4",
          borderBottom: "1px solid #bbf7d0",
          fontSize: "0.75rem",
          color: "#15803d",
          textAlign: "center",
        }}
      >
        🔒 HIPAA Compliant — All messages encrypted end-to-end
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.875rem",
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              gap: "0.5rem",
              alignItems: "flex-end",
            }}
          >
            {msg.role === "assistant" && (
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #212070, #06ABEB)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.875rem",
                  flexShrink: 0,
                }}
              >
                🤖
              </div>
            )}
            <div
              style={{
                maxWidth: "75%",
                padding: "0.75rem 1rem",
                borderRadius:
                  msg.role === "user"
                    ? "1rem 1rem 0 1rem"
                    : "1rem 1rem 1rem 0",
                background: msg.role === "user" ? "#212070" : "#f1f5f9",
                color: msg.role === "user" ? "white" : "#1e293b",
                fontSize: "0.9375rem",
                lineHeight: 1.55,
              }}
            >
              {msg.content}
              <div
                style={{
                  marginTop: "0.25rem",
                  fontSize: "0.6875rem",
                  color: msg.role === "user" ? "rgba(255,255,255,0.6)" : "#94a3b8",
                  textAlign: "right",
                }}
              >
                {msg.ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #212070, #06ABEB)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.875rem",
              }}
            >
              🤖
            </div>
            <div
              style={{
                padding: "0.875rem 1rem",
                borderRadius: "1rem 1rem 1rem 0",
                background: "#f1f5f9",
                display: "flex",
                gap: "0.25rem",
                alignItems: "center",
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#94a3b8",
                    animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "0.75rem 1rem",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "0.5rem",
              color: "#dc2626",
              fontSize: "0.875rem",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: "0.875rem 1rem",
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          gap: "0.75rem",
          alignItems: "flex-end",
          background: "white",
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send)"
          rows={1}
          disabled={loading}
          style={{
            flex: 1,
            resize: "none",
            border: "1px solid #e2e8f0",
            borderRadius: "0.75rem",
            padding: "0.75rem 1rem",
            fontSize: "0.9375rem",
            color: "#1e293b",
            outline: "none",
            lineHeight: 1.5,
            maxHeight: "120px",
            overflowY: "auto",
            fontFamily: "inherit",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "0.75rem",
            border: "none",
            background:
              loading || !input.trim() ? "#e2e8f0" : "#DC298D",
            color: loading || !input.trim() ? "#94a3b8" : "white",
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.25rem",
            flexShrink: 0,
          }}
        >
          ➤
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
