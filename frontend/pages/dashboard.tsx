import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";

// ---------- Assets ----------
import LogoMark from "../assets/SkillSwap.svg?react";
import SearchIcon from "../assets/search.svg";
import DefaultUser from "../assets/user.svg";

// ---------- API setup ----------
// Support either VITE_API_URL (used by login) or VITE_API_BASE.
const API_ROOT =
  (import.meta as any)?.env?.VITE_API_URL
    ? `${(import.meta as any).env.VITE_API_URL}/api`
    : ((import.meta as any)?.env?.VITE_API_BASE ?? "https://poosd24.live/api");

// Match the keys written by the login page.
const TOKEN_KEY = "token";
const USER_ID_KEY = "userId";
const FIRST_NAME_KEY = "firstName";
const LAST_NAME_KEY = "lastName";

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
function getUserId(): number | null {
  const raw = localStorage.getItem(USER_ID_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

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
  opts: { method?: HttpMethod; token?: string | null; body?: unknown } = {}
): Promise<T> {
  const url = `${API_ROOT}${path}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : null,
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

  if (!res.ok) throw new ApiError((data as any)?.message || res.statusText, res.status, data);
  return data as T;
}

// ---------- Types ----------
type Skill = { SkillName: string; Type?: "offer" | "need" };
type Message = { id: string; from: number; to: number; body: string; createdAt: string };
type Match = { _id: number; skills: string[] };
type CurrentUser = { id?: number | null; firstName?: string | null; lastName?: string | null };

type PersonRowData = {
  userId: number;
  name: string;
  avatarUrl?: string | null;
  offerMain?: string | null;
  wantMain?: string | null;
};

// ---------- Helpers ----------
function safeName(first?: string | null, last?: string | null) {
  const f = first ?? "";
  const l = last ?? "";
  if (!f && !l) return "Firstname L.";
  if (f && l) return `${f} ${l[0]}.`;
  return f || l || "Firstname L.";
}
function timeMs(iso?: string) {
  return iso ? +new Date(iso) : 0;
}
const EM_DASH = "—";

// ---------- API calls ----------
async function getMySkills(): Promise<Skill[]> {
  const token = getToken();
  if (!token) return [];
  const raw = await apiFetch<{ mySkills: Skill[] }>("/myskills", { token });
  return raw.mySkills ?? [];
}

async function getMessages(): Promise<Message[]> {
  const token = getToken();
  if (!token) return [];
  const raw = await apiFetch<{
    messages: Array<{ _id: string; from: number; to: number; body: string; createdAt: string }>;
  }>("/messages", { token });
  return (raw.messages ?? []).map((m) => ({
    id: m._id,
    from: m.from,
    to: m.to,
    body: m.body,
    createdAt: m.createdAt,
  }));
}

async function getMatchSkills(): Promise<Match[]> {
  const token = getToken();
  if (!token) return [];
  const raw = await apiFetch<{ matches: Match[] }>("/matchskills", { token });
  return raw.matches ?? [];
}

// ---------- Small UI bits ----------
const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[12px] leading-[1.15] text-gray-800 max-w-[12rem] truncate align-middle">
    {children}
  </span>
);

// Small chip for the user summary (tighter font/height)
const ChipSmall = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span
    className={`inline-block rounded-full bg-gray-100 px-[6px] py-[2px] text-[11px] leading-[1.1] text-gray-800 max-w-[10rem] truncate align-middle ${className}`}
  >
    {children}
  </span>
);

// Avatar: blue circular background; default user.svg rendered larger; wrapper clips overflow.
const Avatar = ({ src }: { src?: string | null }) => (
  <div className="relative inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#3F4F83] shadow overflow-hidden">
    <div className="absolute inset-0 rounded-full ring-2 ring-white/95 pointer-events-none" />
    {src ? (
      <img className="w-10 h-10 rounded-full object-cover" src={src} alt="" />
    ) : (
      <img className="w-9 h-9 object-contain" src={DefaultUser} alt="" />
    )}
  </div>
);

// ---------- One-line, no-wrap chips row with +N overflow (zoom/resize robust) ----------
type InlineChipsRowProps = {
  label: string;
  items: string[];
  rightInsetPx?: number; // how much to leave on the right (line stops short)
  className?: string;
};

function InlineChipsRow({ label, items, rightInsetPx = 16, className = "" }: InlineChipsRowProps) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);

  const [visible, setVisible] = useState<string[]>([]);
  const [plusText, setPlusText] = useState<string | null>(null);

  // constants for measurement must match ChipSmall CSS
  const CHIP_FONT_PX = 11;
  const CHIP_PAD_X = 6; // each side
  const CHIP_GAP = 4; // tiny gap between chips

  const measureChipWidth = useCallback(
    (text: string) => {
      const canvas =
        (measureChipWidth as any)._canvas ||
        ((measureChipWidth as any)._canvas = document.createElement("canvas"));
      const ctx = canvas.getContext("2d");
      if (!ctx) return 40;
      ctx.font = `${CHIP_FONT_PX}px Rubik, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial`;
      const w = Math.ceil(ctx.measureText(text).width);
      // chip total = text + left/right padding + gap after chip
      return w + CHIP_PAD_X * 2 + CHIP_GAP;
    },
    [CHIP_FONT_PX, CHIP_PAD_X, CHIP_GAP]
  );

  const recompute = useCallback(() => {
    const rowEl = rowRef.current;
    const labelEl = labelRef.current;
    if (!rowEl || !labelEl) return;

    const total = rowEl.clientWidth;
    const labelW = labelEl.offsetWidth;
    const leftGap = 4; // tiny spacer between label and first chip
    const available = Math.max(0, total - labelW - leftGap - rightInsetPx);

    let used = 0;
    const vis: string[] = [];
    for (const name of items) {
      const w = measureChipWidth(name);
      if (used + w <= available) {
        vis.push(name);
        used += w;
      } else {
        break;
      }
    }

    const hiddenCount = Math.max(0, items.length - vis.length);
    if (hiddenCount > 0) {
      const plus = `+${hiddenCount}`;
      const plusW = measureChipWidth(plus);
      // Ensure +N fits; if not, drop last visible until it fits
      while (vis.length > 0 && used + plusW > available) {
        const last = vis.pop()!;
        used -= measureChipWidth(last);
      }
      // If still no room for +N, render nothing (label only)
      if (vis.length === 0 && plusW > available) {
        setVisible([]);
        setPlusText(null);
        return;
      }
      setVisible(vis);
      setPlusText(plus);
    } else {
      setVisible(vis);
      setPlusText(null);
    }
  }, [items, measureChipWidth, rightInsetPx]);

  // Robust recompute: ResizeObserver + window/visualViewport + DPR changes + initial frame
  useEffect(() => {
    recompute();

    const el = rowRef.current;
    const ro = el ? new ResizeObserver(() => recompute()) : null;
    if (ro && el) ro.observe(el);

    const onWinResize = () => recompute();
    window.addEventListener("resize", onWinResize);

    let vv: VisualViewport | null = null;
    const onVvResize = () => recompute();
    if (window.visualViewport) {
      vv = window.visualViewport;
      vv.addEventListener("resize", onVvResize);
    }

    let lastDPR = window.devicePixelRatio;
    const dprTimer = window.setInterval(() => {
      if (window.devicePixelRatio !== lastDPR) {
        lastDPR = window.devicePixelRatio;
        recompute();
      }
    }, 300);

    // after fonts/layout settle
    const raf = requestAnimationFrame(() => recompute());

    return () => {
      if (ro && el) ro.disconnect();
      window.removeEventListener("resize", onWinResize);
      if (vv) vv.removeEventListener("resize", onVvResize);
      clearInterval(dprTimer);
      cancelAnimationFrame(raf);
    };
  }, [recompute]);

  return (
    <div ref={rowRef} className={`whitespace-nowrap overflow-hidden ${className}`}>
      <span ref={labelRef} className="text-[11px] text-gray-600 align-middle">
        {label}
      </span>
      <span className="inline-block w-1" aria-hidden="true" />
      {visible.map((name, i) => (
        <ChipSmall key={`${name}-${i}`} className="mr-1.5 last:mr-0">
          {name}
        </ChipSmall>
      ))}
      {plusText && <ChipSmall className="mr-0">{plusText}</ChipSmall>}
    </div>
  );
}

// Shared row for both sections (Recent / Suggested)
function PersonRow({ data }: { data: PersonRowData }) {
  const { name, avatarUrl, offerMain, wantMain } = data;
  return (
    <div
      role="listitem"
      className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 p-3 shadow-sm"
    >
      <Avatar src={avatarUrl ?? null} />
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">{name}</div>
        <div className="text-xs text-gray-700 mt-0.5 flex items-center gap-2 flex-wrap">
          <span className="text-gray-600">Offers:</span>
          {offerMain ? <Chip>{offerMain}</Chip> : <span className="text-gray-500">{EM_DASH}</span>}
          <span className="text-gray-400 mx-1" aria-hidden="true">
            |
          </span>
          <span className="text-gray-600">Wants:</span>
          {wantMain ? <Chip>{wantMain}</Chip> : <span className="text-gray-500">{EM_DASH}</span>}
        </div>
      </div>
    </div>
  );
}

// ---------- Dashboard ----------
export default function DashboardPage() {
  // Redirect if not logged in
  useEffect(() => {
    if (!getToken()) {
      window.location.assign("/");
    }
  }, []);

  // Read name/id the same way Login writes them
  const currentUser: CurrentUser = useMemo(
    () => ({
      id: getUserId(),
      firstName: localStorage.getItem(FIRST_NAME_KEY),
      lastName: localStorage.getItem(LAST_NAME_KEY),
    }),
    []
  );

  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [skillsError, setSkillsError] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[] | null>(null);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const [matches, setMatches] = useState<Match[] | null>(null);
  const [matchesError, setMatchesError] = useState<string | null>(null);

  // Load everything on mount
  useEffect(() => {
    if (!getToken()) return;

    (async () => {
      try {
        const [s, m, x] = await Promise.all([getMySkills(), getMessages(), getMatchSkills()]);
        setSkills(s);
        m.sort((a, b) => timeMs(b.createdAt) - timeMs(a.createdAt));
        setMessages(m);
        setMatches(x);
      } catch {
        try {
          const s = await getMySkills();
          setSkills(s);
        } catch (err: any) {
          setSkillsError(err?.message ?? "Failed to load skills");
        }
        try {
          const m = await getMessages();
          m.sort((a, b) => timeMs(b.createdAt) - timeMs(a.createdAt));
          setMessages(m);
        } catch (err: any) {
          setMessagesError(err?.message ?? "Failed to load messages");
        }
        try {
          const x = await getMatchSkills();
          setMatches(x);
        } catch (err: any) {
          setMatchesError(err?.message ?? "Failed to load suggestions");
        }
      }
    })();
  }, []);

  // Derive current user's skills
  const offerSkills = useMemo(
    () =>
      (skills ?? [])
        .filter((s) => s.Type === "offer")
        .map((s) => s.SkillName)
        .filter(Boolean) as string[],
    [skills]
  );
  const needSkills = useMemo(
    () =>
      (skills ?? [])
        .filter((s) => s.Type === "need")
        .map((s) => s.SkillName)
        .filter(Boolean) as string[],
    [skills]
  );
  const mainSkill = useMemo(() => offerSkills[0] ?? skills?.[0]?.SkillName ?? null, [offerSkills, skills]);

  // Recent connections -> pick most recent two partners (we only have IDs from /messages)
  const recentPartnerIds = useMemo(() => {
    if (!messages || messages.length === 0) return [] as number[];

    // Prefer the stored user id (set by Login)
    let meId: number | null = currentUser.id ?? null;

    // Fallback: infer the participant that appears most often
    if (meId == null) {
      const counts = new Map<number, number>();
      for (const m of messages) {
        counts.set(m.from, (counts.get(m.from) ?? 0) + 1);
        counts.set(m.to, (counts.get(m.to) ?? 0) + 1);
      }
      let bestId: number | null = null;
      let bestCount = -1;
      for (const [id, cnt] of counts) {
        if (cnt > bestCount) {
          bestCount = cnt;
          bestId = id;
        }
      }
      if (bestId != null) meId = bestId;
    }

    if (meId == null) return [];

    const latestByPartner = new Map<number, number>();
    for (const m of messages) {
      const partnerId = m.from === meId ? m.to : m.from;
      const t = timeMs(m.createdAt);
      const prev = latestByPartner.get(partnerId) ?? 0;
      if (t > prev) latestByPartner.set(partnerId, t);
    }

    return Array.from(latestByPartner.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([userId]) => userId);
  }, [messages, currentUser.id]);

  // Map Recent Connections to PersonRowData (without profile/skills endpoints, show placeholders)
  const recentPeople: PersonRowData[] = useMemo(
    () =>
      recentPartnerIds.map((id) => ({
        userId: id,
        name: "Firstname L.",
        avatarUrl: null,
        offerMain: null,
        wantMain: null,
      })),
    [recentPartnerIds]
  );

  // Map Suggested Connections to PersonRowData
  // /matchskills returns { _id, skills: string[] } (no typed offer/need), so use a simple fallback:
  // offers = first skill, wants = second skill (if present).
  const suggestedPeople: PersonRowData[] = useMemo(() => {
    if (!matches || matches.length === 0) return [];
    return matches.map((m) => ({
      userId: m._id,
      name: "Firstname L.",
      avatarUrl: null,
      offerMain: m.skills?.[0] ?? null,
      wantMain: m.skills?.[1] ?? null,
    }));
  }, [matches]);

  // ----- Navbar dropdown state (click-to-toggle, click-outside/esc to close) -----
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const onToggleClick = useCallback(() => setMenuOpen((v) => !v), []);
  const onGlobalPointerDown = useCallback(
    (e: MouseEvent | PointerEvent) => {
      if (!menuOpen) return;
      const t = e.target as Node | null;
      if (menuRef.current && menuRef.current.contains(t)) return;
      if (toggleRef.current && toggleRef.current.contains(t)) return;
      setMenuOpen(false);
    },
    [menuOpen]
  );
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && menuOpen) setMenuOpen(false);
    },
    [menuOpen]
  );

  useEffect(() => {
    document.addEventListener("pointerdown", onGlobalPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onGlobalPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onGlobalPointerDown, onKeyDown]);

  // ---------- Render ----------
  return (
    <div className="min-h-screen grid place-items-center bg-slate-200">
      {/* App Shell (one window) */}
      <div className="bg-white text-black rounded-2xl shadow-lg w-[min(1100px,92vw)] h-auto min-h-[78vh] overflow-hidden flex flex-col">
        {/* Navbar */}
        <header className="grid grid-cols-[1fr_auto_1fr] items-center py-4 px-6 bg-white text-[#313131] border-b border-gray-200">
          {/* Left: logo + title in brand blue */}
          <div className="flex items-center gap-3 justify-self-start">
            <LogoMark className="w-8 h-8 text-[#3F4F83]" style={{ fill: "none" }} aria-hidden="true" />
            <span className="text-2xl sm:text-3xl font-semibold text-[#3F4F83]">SkillSwap</span>
          </div>

          {/* Center: nav items, horizontally centered, with black bullets */}
          <nav className="flex items-center justify-center gap-0 text-sm">
            {[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Offers", href: "/dashboard" },
              { label: "Messages", href: "/messages" },
              { label: "Profile", href: "/dashboard" },
            ].map((item, idx) => {
              const isActive = item.label === "Dashboard";
              const base =
                "no-underline focus:outline-none focus:ring-2 focus:ring-[#3F4F83] rounded-sm px-2 py-1";
              const cls = isActive
                ? `font-semibold !text-[#3F4F83] ${base}`
                : `font-normal !text-[#313131] ${base}`;
              return (
                <div key={item.label} className="flex items-center">
                  <a href={item.href} className={cls} aria-current={isActive ? "page" : undefined}>
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

          {/* Right: username + avatar (no background box), click to toggle dropdown */}
          <div className="relative justify-self-end">
            <button
              ref={toggleRef}
              type="button"
              onClick={onToggleClick}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls="account-menu"
              className="flex items-center gap-3 text-[#313131]
                         !bg-transparent hover:!bg-transparent active:!bg-transparent focus:!bg-transparent
                         shadow-none hover:shadow-none active:shadow-none
                         focus:outline-none focus:ring-2 focus:ring-[#3F4F83] focus:ring-offset-0 rounded-sm"
            >
              <span className="hidden sm:inline-block text-sm">
                {safeName(currentUser.firstName, currentUser.lastName)}
              </span>
              <Avatar />
            </button>

            {menuOpen && (
              <div
                id="account-menu"
                ref={menuRef}
                role="menu"
                className="absolute right-0 mt-2 !bg-white text-[#313131] rounded-md shadow-lg border border-gray-200 min-w-40 z-50"
              >
                <button
                  onClick={() => (window.location.href = "/signout")}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 !bg-white hover:bg-red-50 rounded-md"
                  role="menuitem"
                  type="button"
                >
                  Sign Out
                </button>

              </div>
            )}
          </div>
        </header>

        {/* Body (Off-White surface; NO extra inner white container) */}
        <main className="flex-1 bg-[#F7F8FC] px-6 py-6">
          <h1 className="sr-only">Dashboard</h1>

          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
            {/* LEFT */}
            <div className="flex flex-col gap-6">
              {/* User summary */}
              <div className="bg-white rounded-xl shadow p-4 sm:p-5 border border-gray-200">
                <div className="grid grid-cols-[40px_1fr] grid-rows-[auto_auto] gap-x-4">
                  {/* Avatar spans rows and centers between Name & Main skill */}
                  <div className="row-span-2 self-center">
                    <Avatar />
                  </div>

                  {/* Row 1: Name */}
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium text-gray-900 truncate">
                      {safeName(currentUser.firstName, currentUser.lastName)}
                    </div>
                  </div>

                  {/* Row 2: Main skill */}
                  <div className="min-w-0">
                    <span className="text-[11px] text-gray-600 align-middle">Main skill:</span>
                    <span className="inline-block w-1" aria-hidden="true" />
                    {mainSkill ? (
                      <ChipSmall>{mainSkill}</ChipSmall>
                    ) : (
                      <span className="text-[11px] text-gray-500">{EM_DASH}</span>
                    )}
                  </div>

                  {/* Delimiter */}
                  <div className="col-start-2 my-2">
                    <div className="border-t border-gray-200 mr-4" />
                  </div>

                  {/* Offering */}
                  <div className="col-start-2">
                    {offerSkills.length > 0 ? (
                      <InlineChipsRow label="Offering:" items={offerSkills} rightInsetPx={16} />
                    ) : (
                      <div className="text-[11px] text-gray-600">
                        <span>Offering:</span> <span className="text-gray-500">{EM_DASH}</span>
                      </div>
                    )}
                  </div>

                  {/* Looking for */}
                  <div className="col-start-2 mt-0.5">
                    {needSkills.length > 0 ? (
                      <InlineChipsRow label="Looking for:" items={needSkills} rightInsetPx={16} />
                    ) : (
                      <div className="text-[11px] text-gray-600">
                        <span>Looking for:</span> <span className="text-gray-500">{EM_DASH}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Connections */}
              <section aria-labelledby="recent-connections">
                <h2 id="recent-connections" className="text-lg sm:text-xl font-medium text-gray-800 mb-3">
                  Recent Connections
                </h2>
                {messagesError && <div className="text-sm text-red-600">{messagesError}</div>}
                {messages === null ? (
                  <div className="text-sm text-gray-500">Loading…</div>
                ) : recentPeople.length === 0 ? (
                  <div className="h-24 grid place-items-center text-gray-500">Make connections!</div>
                ) : (
                  <div role="list" className="grid gap-3">
                    {recentPeople.map((p) => (
                      <PersonRow key={p.userId} data={p} />
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* RIGHT */}
            <div className="flex flex-col gap-6">
              {/* Search (UI only) */}
              <div className="w-full">
                <label htmlFor="dashSearch" className="block text-sm font-medium text-gray-800 mb-2">
                  Search for users, skills, etc.
                </label>
                <div className="flex items-stretch gap-2">
                  <input
                    id="dashSearch"
                    className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3F4F83]"
                    placeholder="Search for users, skills, etc…"
                    aria-describedby="searchHelp"
                  />
                  <button
                    type="button"
                    className="shrink-0 w-10 h-10 rounded-full bg-[#3F4F83] grid place-items-center hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3F4F83]"
                    aria-label="Search (not wired yet)"
                  >
                    <img src={SearchIcon} alt="" className="w-5 h-5 filter invert" />
                  </button>
                </div>
                <p id="searchHelp" className="sr-only">
                  Press Enter or the button to search.
                </p>
              </div>

              {/* Suggested Connections */}
              <section aria-labelledby="suggested-connections">
                <h2 id="suggested-connections" className="text-lg sm:text-xl font-medium text-gray-800 mb-3">
                  Suggested Connections
                </h2>
                {matchesError && <div className="text-sm text-red-600">{matchesError}</div>}
                {matches === null ? (
                  <div className="text-sm text-gray-500">Loading…</div>
                ) : suggestedPeople.length === 0 ? (
                  <div className="text-sm text-gray-500">No suggestions yet.</div>
                ) : (
                  <div role="list" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {suggestedPeople.map((p) => (
                      <PersonRow key={p.userId} data={p} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}