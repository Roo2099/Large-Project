import React, { useEffect, useState } from "react";

/* -----------------------------------------
   0) ENV / CONFIG
----------------------------------------- */
const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE ??
  // Fallback to your prod base if env not set
  "https://poosd24.live/api";

/* -----------------------------------------
   1) Tiny auth helper (JWT stored by your login)
   - Your /login page should call setToken(token) on success
----------------------------------------- */
const TOKEN_KEY = "skillswap_token";

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/* -----------------------------------------
   2) Minimal fetch wrapper with typed error
----------------------------------------- */
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

class ApiError extends Error {
  status: number;
  body?: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function apiFetch<T>(
  path: string,
  opts: {
    method?: HttpMethod;
    token?: string | null;
    body?: unknown;
    signal?: AbortSignal;
  } = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
     // harmless if you use cookies; ignored otherwise
  });

  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    throw new ApiError(data?.message || res.statusText, res.status, data);
  }
  return data as T;
}

/* -----------------------------------------
   3) Messages service (TS types are replaceable later)
   - OpenAPI doesn't define exact message shape; this is a sane template.
----------------------------------------- */
export type Message = {
  id: string | number;
  from: number;       // sender user id
  to: number;         // recipient user id
  body: string;
  createdAt: string;  // ISO timestamp
};

// GET /messages (bearer)
async function getMessages(): Promise<Message[]> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const raw = await apiFetch<{
    messages: Array<{
      _id: string;
      from: number;
      to: number;
      body: string;
      createdAt: string;
    }>;
  }>("/messages", { token });

  // Extract the array and normalize fields
  const msgs = raw.messages ?? [];

  return msgs.map((m) => ({
    id: m._id,
    from: m.from,
    to: m.to,
    body: m.body,
    createdAt: m.createdAt,
  }));
}


// POST /messages (bearer) with { to, body }
async function sendMessage(to: number, body: string): Promise<Partial<Message> & { success?: boolean }> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  return apiFetch<Partial<Message> & { success?: boolean }>("/messages", {
    method: "POST",
    token,
    body: { to, body },
  });
}

/* -----------------------------------------
   4) Small helpers (relative time, etc.)
----------------------------------------- */
function timeAgo(iso?: string) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);

  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);

  if (d >= 7) {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  if (d >= 1) return `${d}d`;
  if (h >= 1) return `${h}h`;
  if (m >= 1) return `${m}m`;
  return `${Math.max(0, s)}s`;
}

/* -----------------------------------------
   5) Single-file UI (template)
   - Minimal list + send form so you can test the API quickly
   - Style matches Tailwind; safe with plain CSS as well
----------------------------------------- */
export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Send form
  const [toId, setToId] = useState<number>(0);
  const [body, setBody] = useState<string>("");

  // Optional: quick local token testing helper (remove in prod)
  const [tokenInput, setTokenInput] = useState<string>(getToken() ?? "");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await getMessages();
      // Sort newest first (optional)
      data.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      setMessages(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Attempt to load on mount if token already present
    if (getToken()) {
      refresh();
    } else {
      setLoading(false);
    }
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!toId || !body.trim()) return;
    try {
      await sendMessage(toId, body.trim());
      setBody("");
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Failed to send message");
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 px-6 py-6">
      <div className="mx-auto w-full max-w-5xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {/* Header / mock nav */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="26" height="26" viewBox="0 0 24 24" className="text-[#3b5aa7]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 7h11l-3-3" />
              <path d="M18 7l-3 3" />
              <path d="M3 21h14a4 4 0 0 0 4-4V7" />
            </svg>
            <span className="text-lg font-semibold text-[#3b5aa7]">SkillSwap</span>
          </div>
          <nav className="hidden gap-6 text-sm text-gray-600 sm:flex">
            <a className="hover:text-gray-900" href="#">Dashboard</a>
            <a className="hover:text-gray-900" href="#">Offers</a>
            <span className="font-semibold text-gray-900">Messages</span>
            <a className="hover:text-gray-900" href="#">Profile</a>
          </nav>
          <div className="hidden items-center gap-2 text-sm text-gray-700 sm:flex">
            <span>[username]</span>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gray-200 ring-1 ring-gray-300">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="8" r="4" />
                <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
              </svg>
            </div>
          </div>
        </div>

        {/* Token tester (remove later). Lets you paste JWT and try the endpoints */}
        <details className="mb-4 rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
          <summary className="cursor-pointer select-none font-medium">Auth token (dev helper)</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr,auto]">
            <input
              className="rounded border px-3 py-2"
              placeholder="Paste JWT here..."
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                className="rounded bg-gray-900 px-3 py-2 text-white"
                onClick={() => {
                  setToken(tokenInput.trim());
                  refresh();
                }}
                type="button"
              >
                Save & Load
              </button>
              <button
                className="rounded border px-3 py-2"
                onClick={() => {
                  clearToken();
                  setTokenInput("");
                  setMessages([]);
                }}
                type="button"
              >
                Clear
              </button>
            </div>
          </div>
        </details>

        {/* Messages list */}
        <div>
          <h2 className="mb-2 text-base font-semibold">Your messages</h2>
          {loading && <div className="text-sm text-gray-500">Loading…</div>}
          {error && <div className="text-sm text-red-600">{error}</div>}
          {!loading && !error && (!messages || messages.length === 0) && (
            <div className="text-sm text-gray-500">No messages yet.</div>
          )}

          <ul className="mt-2 divide-y">
            {messages?.map((m) => (
              <li key={m.id} className="py-3">
                <div className="flex items-baseline justify-between">
                  <div className="text-sm text-gray-800">
                    <span className="font-medium">From:</span> {m.from}
                    <span className="mx-2">→</span>
                    <span className="font-medium">To:</span> {m.to}
                  </div>
                  <span className="text-xs text-gray-500">{timeAgo(m.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm text-gray-700">{m.body}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* Simple send form */}
        <form onSubmit={handleSend} className="mt-6 grid gap-3 sm:grid-cols-[140px,1fr,auto]">
          <input
            type="number"
            min={1}
            placeholder="Recipient ID"
            className="rounded border px-3 py-2 text-sm"
            value={toId || ""}
            onChange={(e) => setToId(Number(e.target.value))}
            required
          />
          <input
            type="text"
            placeholder="Type a message…"
            className="rounded border px-3 py-2 text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
          <button
            className="rounded bg-[#3b5aa7] px-4 py-2 text-sm font-semibold text-white"
            type="submit"
            disabled={!toId || !body.trim()}
          >
            Send
          </button>
        </form>
      </div>

      {/* Bottom mobile nav (visual only) */}
      <div className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t bg-white/95 py-2 text-center text-xs text-gray-600 backdrop-blur md:hidden">
        <button className="py-1">Dashboard</button>
        <button className="py-1">Offers</button>
        <button className="py-1 font-semibold text-[#3b5aa7]">Messages</button>
        <button className="py-1">Profile</button>
      </div>
    </div>
  );
}




/* -----------------------------------------
   Usage during dev:
   - Ensure VITE_API_BASE is set (or uses fallback).
   - Render in App.tsx for now:

     import MessagesPage from "./pages/messages";
     export default function App() { return <MessagesPage />; }

   - Log in somewhere else in your app and store the token with setToken(token),
     or paste the token into the dev helper at the top of this page.
----------------------------------------- */
