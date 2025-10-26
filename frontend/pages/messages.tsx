import React, { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

const API_BASE = (import.meta as any)?.env?.VITE_API_BASE ?? "https://poosd24.live/api";
const TOKEN_KEY = "token";

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

async function apiFetch<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PUT" | "DELETE"; token?: string | null; body?: unknown } = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : null,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

type Message = {
  _id: string;
  from: number;
  to: number;
  fromName?: string;
  toName?: string;
  body: string;
  createdAt: string;
};
type User = { UserID: number; FirstName: string; LastName: string };

function timeAgo(iso?: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d >= 7) return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (d >= 1) return `${d}d`;
  if (h >= 1) return `${h}h`;
  if (m >= 1) return `${m}m`;
  return `${Math.floor(diff / 1000)}s`;
}

// ===== API Calls =====
async function getMessages(): Promise<Message[]> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch<{ messages: Message[] }>("/messages", { token });
  return res.messages ?? [];
}
async function sendMessage(to: number, body: string): Promise<void> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  await apiFetch("/messages", { method: "POST", token, body: { to, body } });
}
async function deleteMessage(id: string): Promise<void> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  await apiFetch(`/messages/${id}`, { method: "DELETE", token });
}
async function searchUsers(name: string): Promise<User[]> {
  if (!name.trim()) return [];
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch<{ users?: User[] }>(`/users?name=${encodeURIComponent(name)}`, { token });
  return res.users ?? [];
}

// ===== Main Component =====
export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toName, setToName] = useState("");
  const [body, setBody] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  async function refreshMessages() {
    try {
      const data = await getMessages();
      data.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      setMessages(data);
    } catch (err: any) {
      setError(err.message ?? "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!getToken()) {
      window.location.assign("/login");
      return;
    }
    refreshMessages();
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId || !body.trim()) return;
    try {
      await sendMessage(selectedUserId, body.trim());
      setBody("");
      setToName("");
      setSelectedUserId(null);
      setSearchResults([]);
      await refreshMessages();
    } catch (err: any) {
      setError(err.message ?? "Failed to send message");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this message?")) return;
    try {
      await deleteMessage(id);
      setMessages((prev) => prev.filter((m) => m._id !== id));
    } catch (err: any) {
      setError(err.message ?? "Failed to delete message");
    }
  }

  async function handleSearch(name: string) {
    setToName(name);
    setSelectedUserId(null);
    if (name.trim().length === 0) return setSearchResults([]);
    try {
      const users = await searchUsers(name);
      setSearchResults(users);
    } catch {
      setSearchResults([]);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-200">
      <div className="bg-white text-black rounded-2xl shadow-lg w-[min(1100px,92vw)] h-auto min-h-[78vh] overflow-hidden flex flex-col">
        
        {/* Navbar */}
        <header className="flex justify-between items-center py-4 px-6 bg-white border-b border-gray-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-semibold text-[#3F4F83]">SkillSwap</span>
          </div>
          <nav className="flex items-center gap-2 text-sm text-[#313131]">
            <a href="/dashboard" className="px-2 hover:text-[#3F4F83]">Dashboard</a>
            <span>•</span>
            <a href="/offers" className="px-2 hover:text-[#3F4F83]">Offers</a>
            <span>•</span>
            <span className="font-semibold text-[#3F4F83]">Messages</span>
            <span>•</span>
            <a href="/profile" className="px-2 hover:text-[#3F4F83]">Profile</a>
          </nav>
        </header>

        {/* Content */}
        <main className="flex-1 bg-[#F7F8FC] px-6 py-6">
          <h1 className="text-2xl font-semibold text-gray-800 mb-4">Messages</h1>

          {loading && <div className="text-gray-600 text-sm">Loading…</div>}
          {error && <div className="text-red-600 text-sm">{error}</div>}
          {!loading && !error && messages.length === 0 && (
            <div className="text-gray-500 text-sm mb-4">No messages yet.</div>
          )}

          <ul className="divide-y divide-gray-200 mb-6">
            {messages.map((m) => (
              <li key={m._id} className="py-3">
                <div className="flex justify-between items-center text-sm text-gray-800">
                  <div>
                    <span className="font-medium">From:</span> {m.fromName}
                    <span className="mx-2">→</span>
                    <span className="font-medium">To:</span> {m.toName}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{timeAgo(m.createdAt)}</span>
                    <button
                      className="text-gray-400 hover:text-red-600"
                      onClick={() => handleDelete(m._id)}
                      title="Delete message"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-sm text-gray-700">{m.body}</p>
              </li>
            ))}
          </ul>

          {/* Send Form */}
          <form onSubmit={handleSend} className="grid gap-3 sm:grid-cols-[200px,1fr,auto] relative">
            <div className="relative">
              <input
                type="text"
                placeholder="Recipient name"
                className="rounded border border-gray-300 px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#3F4F83]"
                value={toName}
                onChange={(e) => handleSearch(e.target.value)}
                required
              />
              {searchResults.length > 0 && (
                <ul className="absolute left-0 right-0 bg-white border border-gray-300 rounded shadow mt-1 z-10 max-h-40 overflow-y-auto">
                  {searchResults.map((u) => (
                    <li
                      key={u.UserID}
                      className="px-3 py-1 text-sm hover:bg-gray-100 cursor-pointer"
                      onClick={() => {
                        setToName(`${u.FirstName} ${u.LastName}`);
                        setSelectedUserId(u.UserID);
                        setSearchResults([]);
                      }}
                    >
                      {u.FirstName} {u.LastName} <span className="text-gray-400 text-xs">(ID {u.UserID})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <input
              type="text"
              placeholder="Type a message…"
              className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3F4F83]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
            <button
              className="rounded bg-[#3F4F83] text-white px-4 py-2 text-sm font-semibold hover:bg-gray-600 disabled:opacity-50"
              type="submit"
              disabled={!selectedUserId || !body.trim()}
            >
              Send
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
