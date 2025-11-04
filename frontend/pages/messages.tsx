import React, { useEffect, useMemo, useState } from "react";
import {
  Trash2,
  Search as SearchIcon,
  Send as SendIcon,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import DefaultUser from "../assets/user.svg?react";
import LogoMark from "../assets/SkillSwap.svg?react";

const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE ?? "https://poosd24.live/api";
const TOKEN_KEY = "token";
const USER_ID_KEY = "userId";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function getUserId() {
  const raw = localStorage.getItem(USER_ID_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}
function getQueryPartner(): number | null {
  const p = new URLSearchParams(window.location.search).get("partner");
  if (!p) return null;
  const n = Number(p);
  return Number.isFinite(n) ? n : null;
}

async function apiFetch<T>(
  path: string,
  opts: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    token?: string | null;
    body?: unknown;
  } = {}
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
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error((data as any)?.message || res.statusText);
  return data as T;
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
// ✅ Smarter version – handles capitalization and missing last names
function formatName(fullName: string) {
  if (!fullName) return "";

  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0);

  if (parts.length === 0) return "";

  const first =
    (parts[0]?.charAt(0).toUpperCase() ?? "") +
    (parts[0]?.slice(1).toLowerCase() ?? "");

  const lastInitial =
    parts.length > 1 && parts[1]?.[0]
      ? parts[1][0].toUpperCase() + "."
      : "";

  return `${first} ${lastInitial}`.trim();
}

function timeAgo(iso?: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(diff / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d >= 7)
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  if (d >= 1) return `${d}d`;
  if (h >= 1) return `${h}h`;
  if (m >= 1) return `${m}m`;
  return `${s}s`;
}

function shortTimestamp(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return (
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    ", " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  );
}

async function getMessages(): Promise<Message[]> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch<{ messages: Message[] }>("/messages", { token });
  return res.messages ?? [];
}
async function sendMessage(to: number, body: string) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  await apiFetch("/messages", { method: "POST", token, body: { to, body } });
}
async function deleteMessage(id: string) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  await apiFetch(`/messages/${id}`, { method: "DELETE", token });
}
async function searchUsers(name: string) {
  if (!name.trim()) return [];
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch<{ users?: User[] }>(
    `/users?name=${encodeURIComponent(name)}`,
    { token }
  );
  return res.users ?? [];
}

const Avatar = ({ src }: { src?: string | null }) => (
  <div className="relative inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#3F4F83] shadow overflow-hidden">
    <div className="absolute inset-0 rounded-full ring-2 ring-white/95 pointer-events-none" />
    {src ? (
      <img className="w-10 h-10 rounded-full object-cover" src={src} alt="" />
    ) : (
      <DefaultUser className="w-9 h-9 stroke-white" />
    )}
  </div>
);

export default function MessagesPage() {
  const me = getUserId();
  const partnerId = getQueryPartner();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // list-view composer/search
  const [toName, setToName] = useState("");
  const [body, setBody] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [inboxSearch, setInboxSearch] = useState("");

  // list pagination
  const [inboxPage, setInboxPage] = useState(1);
  const INBOX_PAGE_SIZE = 6;

  // delete modal
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      window.location.assign("/login");
      return;
    }
    refreshMessages();
  }, []);

  useEffect(() => {
    if (partnerId != null) setSelectedUserId(partnerId);
  }, [partnerId]);

  // reset list page when search text changes
  useEffect(() => {
    setInboxPage(1);
  }, [inboxSearch]);

 async function refreshMessages() {
  try {
    const data = await getMessages();
    data.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    // ✅ Apply proper capitalization and last initial formatting
    const formatted: Message[] = data.map((m) => ({
      ...m,
      fromName: formatName(m.fromName ?? ""),
      toName: formatName(m.toName ?? ""),
    }));


    setMessages(formatted);
  } catch (err: any) {
    setError(err.message ?? "Failed to load messages");
  } finally {
    setLoading(false);
  }
}

  // inbox rows (latest per partner)
  const inboxRows = useMemo(() => {
    if (!messages.length) return [];
    const latest = new Map<number, Message>();
    for (const m of messages) {
      const pid = m.from === me ? m.to : m.from;
      const prev = latest.get(pid);
      if (!prev || +new Date(m.createdAt) > +new Date(prev.createdAt)) {
        latest.set(pid, m);
      }
    }
    return Array.from(latest.entries())
      .map(([pid, m]) => ({
        id: m._id,
        partnerId: pid,
        partnerName:
        m.from === me
        ? formatName(m.toName ?? `User ${m.to}`)
        : formatName(m.fromName ?? `User ${m.from}`),

        preview: m.body,
        createdAt: m.createdAt,
      }))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [messages, me]);

  // filter by search
  const filteredInboxRows = useMemo(() => {
    const q = inboxSearch.toLowerCase().trim();
    if (!q) return inboxRows;
    return inboxRows.filter(
      (r) =>
        r.partnerName.toLowerCase().includes(q) ||
        r.preview.toLowerCase().includes(q)
    );
  }, [inboxRows, inboxSearch]);

  // list pagination math
  const totalInboxPages = Math.max(
    1,
    Math.ceil(filteredInboxRows.length / INBOX_PAGE_SIZE)
  );

  // clamp current page if data shrinks (e.g., after delete)
  useEffect(() => {
    setInboxPage((p) => Math.min(Math.max(1, p), totalInboxPages));
  }, [totalInboxPages]);

  const visibleInbox = useMemo(() => {
    const start = (inboxPage - 1) * INBOX_PAGE_SIZE;
    return filteredInboxRows.slice(start, start + INBOX_PAGE_SIZE);
  }, [filteredInboxRows, inboxPage]);

  // full thread (no pagination)
  const fullThread = useMemo(() => {
    if (partnerId == null) return [];
    return messages
      .filter(
        (m) =>
          (m.from === me && m.to === partnerId) ||
          (m.to === me && m.from === partnerId)
      )
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  }, [messages, partnerId, me]);

  const visibleThread = fullThread;

  async function handleSendList(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId || !body.trim()) return;
    await sendMessage(selectedUserId, body.trim());
    setBody("");
    setToName("");
    setSelectedUserId(null);
    setSearchResults([]);
    await refreshMessages();
  }

  async function handleSendThread(e: React.FormEvent) {
    e.preventDefault();
    const targetId = partnerId;
    if (!targetId || !body.trim()) return;
    await sendMessage(targetId, body.trim());
    setBody("");
    await refreshMessages();
  }

  async function handleRecipientType(name: string) {
    setToName(name);
    setSelectedUserId(null);
    if (!name.trim()) return setSearchResults([]);
    try {
      const users = await searchUsers(name);
      setSearchResults(users);
    } catch {
      setSearchResults([]);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmId) return;
    await deleteMessage(confirmId);
    setConfirmId(null);
    await refreshMessages();
  }

  // partner name = the OTHER person
  const partnerName = useMemo(() => {
    if (partnerId == null) return "";
    const row = inboxRows?.find((r) => r.partnerId === partnerId);
    if (row?.partnerName) return row.partnerName;
    const any = messages.find((m) => m.from === partnerId || m.to === partnerId);
    if (!any) return `User ${partnerId}`;
    if (any.from === partnerId) return any.fromName ?? `User ${partnerId}`;
    return any.toName ?? `User ${partnerId}`;
  }, [partnerId, inboxRows, messages]);

  const isThread = partnerId != null;

  return (
    <div className="min-h-screen grid place-items-center bg-slate-200">
      <div className="bg-white text-black rounded-2xl shadow-lg w-[min(1100px,92vw)] min-h-[78vh] overflow-hidden flex flex-col">
        {/* NAVBAR */}
       <header className="flex justify-between items-center py-4 px-6 bg-white border-b border-gray-200">
        {/* Left side: Logo + text */}
        <div className="flex items-center gap-3">
          <LogoMark className="w-8 h-8 text-[#3F4F83]" />
          <h1 className="text-2xl font-semibold text-[#3F4F83]">SkillSwap</h1>
        </div>

        {/* Right side: Navigation */}
        <nav className="flex items-center gap-0 text-sm">
          {[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Offers", href: "/offers" },
            { label: "Messages", href: "/messages" },
            { label: "Profile", href: "/profile" },
          ].map((item, idx) => {
            const isActive = item.label === "Messages";
            const base =
              "no-underline focus:outline-none focus:ring-2 focus:ring-[#3F4F83] rounded-sm px-2 py-1";
            const cls = isActive
              ? `font-semibold !text-[#3F4F83] ${base}`
              : `font-normal !text-[#313131] ${base}`;
            return (
              <div key={item.label} className="flex items-center">
                <a
                  href={item.href}
                  className={cls}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </a>
                {idx < 3 && (
                  <span className="mx-2 text-black opacity-80" aria-hidden="true">
                    •
                  </span>
                )}
              </div>
            );
          })}
        </nav>
      </header>


        <main className="flex-1 bg-[#F7F8FC] px-6 py-6">
          {!isThread ? (
            <>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1F2A44] mb-5">
                Messages
              </h1>

              {/* COMPOSER (LIST VIEW) */}
              <section className="bg-white rounded-xl border border-gray-200 shadow w-full mb-5 p-4">
                <form
                  onSubmit={handleSendList}
                  className="grid gap-3 sm:grid-cols-[260px,1fr,auto] items-center"
                >
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Recipient name"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#3F4F83]"
                      value={toName}
                      onChange={(e) => handleRecipientType(e.target.value)}
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
                            {u.FirstName} {u.LastName}{" "}
                            <span className="text-gray-400 text-xs">(ID {u.UserID})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder="Type a message…"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3F4F83]"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    required
                  />

                  <button
                    type="submit"
                    className="rounded-lg !bg-[#3F4F83] !text-white px-5 py-2 text-sm font-semibold hover:!bg-[#2e3b6b] disabled:opacity-60 inline-flex items-center gap-2"
                    disabled={!selectedUserId || !body.trim()}
                    title={!selectedUserId ? "Select a recipient" : "Send message"}
                  >
                    <SendIcon size={16} />
                    Send
                  </button>
                </form>
              </section>

              {/* SEARCH BAR */}
              <div className="flex items-stretch gap-2 w-full mb-4">
                <input
                  value={inboxSearch}
                  onChange={(e) => setInboxSearch(e.target.value)}
                  placeholder="Search messages..."
                  className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3F4F83] bg-white"
                />
                <button
                  type="button"
                  className="shrink-0 px-4 h-10 rounded-full !bg-[#3F4F83] !text-white grid place-items-center hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3F4F83]"
                  aria-label="Search messages"
                >
                  <SearchIcon size={18} />
                </button>
              </div>

              {/* INBOX LIST + PAGINATION */}
              <section className="bg-white rounded-xl border border-gray-200 shadow w-full divide-y divide-gray-100">
                {loading && (
                  <div className="py-8 text-center text-gray-500 text-sm">Loading…</div>
                )}
                {error && <div className="py-4 px-4 text-red-600 text-sm">{error}</div>}

                {!loading &&
                  !error &&
                  visibleInbox.map((r) => (
                    <div
                      key={r.id}
                      className="group flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition cursor-pointer"
                      onClick={() =>
                        (window.location.href = `/messages?partner=${r.partnerId}`)
                      }
                    >
                      <Avatar />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-gray-900 truncate">
                            {formatName(r.partnerName)}
                            <span className="text-gray-500 text-xs font-normal ml-1">ID: {r.partnerId}</span>
                          </span>
                          <div className="text-xs text-gray-400 shrink-0">
                            {timeAgo(r.createdAt)}
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 truncate">{r.preview}</div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmId(r.id);
                        }}
                        className="!text-red-600 !border !border-red-200 hover:!border-red-300 hover:!bg-red-50 rounded-lg text-sm px-3 py-1 inline-flex items-center gap-1"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  ))}

                {!loading && !error && filteredInboxRows.length === 0 && (
                  <div className="py-12 text-center text-gray-500 text-sm">
                    No messages yet.
                  </div>
                )}
              </section>

              {/* LIST PAGINATION CONTROLS */}
              {filteredInboxRows.length > INBOX_PAGE_SIZE && (
                <div className="flex justify-between items-center mt-4">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md !bg-[#3F4F83] !text-white px-3 py-1.5 text-sm disabled:opacity-50"
                    onClick={() => setInboxPage((p) => Math.max(1, p - 1))}
                    disabled={inboxPage <= 1}
                  >
                    <ChevronLeft size={16} />
                    Prev
                  </button>
                  <div className="text-sm text-gray-600">
                    Page {inboxPage} of {totalInboxPages}
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md !bg-[#3F4F83] !text-white px-3 py-1.5 text-sm disabled:opacity-50"
                    onClick={() =>
                      setInboxPage((p) => Math.min(totalInboxPages, p + 1))
                    }
                    disabled={inboxPage >= totalInboxPages}
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* THREAD VIEW */}
              <button
                type="button"
                onClick={() => (window.location.href = "/messages")}
                className="inline-flex items-center gap-2 rounded-lg !bg-[#3F4F83] !text-white px-3 py-2 text-sm hover:!bg-[#2e3b6b] mb-4"
              >
                <ArrowLeft size={16} /> Back
              </button>

              <div className="flex items-center justify-between mb-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1F2A44]">
                Conversation with <span>{formatName(partnerName)}</span>
              </h1>
              <span className="text-gray-500 text-base font-normal">ID: {partnerId}</span>
            </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow divide-y divide-gray-100 mb-4">
                {visibleThread.map((m) => {
                  const mine = m.from === me;
                  return (
                    <div key={m._id} className="px-4 py-3">
                      <div
                        className={`flex gap-3 ${
                          mine ? "justify-end" : "justify-start"
                        }`}
                      >
                        {!mine && <Avatar />}
                        <div
                          className={`max-w-[680px] rounded-xl px-3 py-2 ${
                            mine
                              ? "!bg-[#3F4F83] !text-white"
                              : "bg-gray-100 text-gray-900"
                          }`}
                        >
                          <div className="text-sm break-words">
                            {m.body}
                            <div
                              className={`mt-1 text-[11px] ${
                                mine
                                  ? "text-white/80 text-right"
                                  : "text-gray-500 text-left"
                              }`}
                            >
                              {shortTimestamp(m.createdAt)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {visibleThread.length === 0 && (
                  <div className="px-4 py-6 text-sm text-gray-500">
                    No messages in this range.
                  </div>
                )}
              </div>

              {/* THREAD COMPOSER */}
              <form
                onSubmit={handleSendThread}
                className="grid gap-3 sm:grid-cols-[1fr,auto] items-center bg-white p-4 rounded-xl border border-gray-200 shadow"
              >
                <input
                  type="text"
                  placeholder="Type a message…"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#3F4F83]"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                />
                <button
                  type="submit"
                  className="rounded-lg !bg-[#3F4F83] !text-white px-5 py-2 text-sm font-semibold hover:!bg-[#2e3b6b] disabled:opacity-60 inline-flex items-center gap-2"
                  disabled={!body.trim()}
                >
                  <SendIcon size={16} />
                  Send
                </button>
              </form>
            </>
          )}
        </main>
      </div>

      {/* DELETE MODAL */}
      {confirmId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-[min(420px,90vw)] border border-gray-200">
            <h3 className="text-lg font-semibold text-[#3F4F83] mb-2">
              Delete message?
            </h3>
            <p className="text-sm text-gray-700 mb-4">This can’t be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                className="px-4 py-2 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm rounded-md !bg-red-600 !text-white hover:!bg-red-700"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
