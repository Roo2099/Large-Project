import React, { useEffect, useMemo, useState, useRef, useCallback, useLayoutEffect } from "react";
import { Link } from "react-router-dom";

// ---------- Assets ----------
import LogoMark from "../assets/SkillSwap.svg?react";
import SearchIcon from "../assets/search.svg?react";
import DefaultUser from "../assets/user.svg?react";

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

type SearchUser = {
  id: number;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null; // server may omit; we'll gracefully fall back
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
async function sendFriendRequest(toUserId: number): Promise<void> {
  const token = getToken();
  if (!token) throw new ApiError("Unauthorized", 401);
  await apiFetch<void>(`/friend-request/${toUserId}`, { method: "POST", token });
}

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

async function getUserProfile(userId: number) {
  const token = getToken();
  if (!token) return null;
  try {
    const data = await apiFetch<{ id: number; firstName: string; lastName: string; skills: any[] }>(
      `/user/${userId}`,
      { token }
    );
    return data;
  } catch (err) {
    console.error("Failed to fetch user profile:", err);
    return null;
  }
}

async function getMatchSkills(): Promise<Match[]> {
  const token = getToken();
  if (!token) return [];
  const raw = await apiFetch<{ matches: Match[] }>("/matchskills", { token });
  return raw.matches ?? [];
}

// === REPLACEMENT: coerce toUserId to number to avoid mismatches ===
async function getOutgoingFriendRequests(): Promise<number[]> {
  const token = getToken();
  if (!token) return [];
  const raw = await apiFetch<{ requests: Array<{ toUserId: number | string; status?: string }> }>(
    "/friend-requests/outgoing",
    { token }
  );
  return (raw.requests ?? [])
    .map((r) => Number((r as any).toUserId))
    .filter((n) => Number.isFinite(n));
}

// INSERT AFTER: getOutgoingFriendRequests()

// Accept/Decline an incoming friend request by id
async function respondToOffer(
  requestId: string,
  action: "accept" | "decline"
): Promise<void> {
  const token = getToken();
  if (!token) throw new ApiError("Unauthorized", 401);
  await apiFetch(`/friend-request/${requestId}/respond`, {
    method: "POST",
    token,
    body: { action },
  });
}

// Fetch pending incoming friend requests → Map<fromUserId, requestId>
async function getIncomingFriendRequests(): Promise<Map<number, string>> {
  const token = getToken();
  if (!token) return new Map();

  const raw = await apiFetch<{
    requests: Array<{ _id: string; fromUserId: number | string; status?: string }>;
  }>("/friend-requests", { token });

  const m = new Map<number, string>();
  for (const r of raw.requests ?? []) {
    const from = Number((r as any).fromUserId);
    if (Number.isFinite(from)) m.set(from, (r as any)._id);
  }
  return m;
}

async function searchUsersAPI(query: string): Promise<SearchUser[]> {
  const token = getToken(); // not required by current API, but harmless if sent
  const q = query.trim();
  if (!q) return [];

  const url = `/users?name=${encodeURIComponent(q)}`;
  const raw = await apiFetch<{ users: Array<{ UserID: number; FirstName?: string; LastName?: string; Login?: string }> }>(
    url,
    token ? { token } : {}
  );

  return (raw.users ?? []).map(u => ({
    id: Number(u.UserID),
    firstName: u.FirstName ?? null,
    lastName:  u.LastName  ?? null,
    email: (u as any).Login ?? null, // present if API was extended; else null
  }));
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
      <DefaultUser className="w-9 h-9 stroke-white"/>
    )}
  </div>
);

// ---------- Toasts (minimal, accessible) ----------
type ToastKind = "success" | "error" | "info";
type ToastMsg = { id: number; kind: ToastKind; message: string };

function ToastHost({
  toasts,
  onDismiss,
}: {
  toasts: ToastMsg[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      className="fixed bottom-4 right-4 z-[999] space-y-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
          "min-w-[220px] max-w-[360px] rounded-xl px-4 py-3 text-white shadow-xl border-l-4",
          t.kind === "success" ? "bg-green-500/95 border-green-700" :
          t.kind === "error"   ? "bg-red-500/95 border-red-700"   :
                                "bg-[#3F4F83]/95 border-[#2f3a63]"
        ].join(" ")}
          role="alert"
        >
          <div className="flex items-start gap-3">
            <span className="text-sm leading-5">{t.message}</span>
			<button
			  type="button"
			  aria-label="Close"
			  onClick={() => onDismiss(t.id)}
			  className="ml-auto inline-flex items-center justify-center text-white/85 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-sm !bg-transparent !border-0 !shadow-none !outline-none p-0 leading-none"
			  // Inline style to nuke any global button styling that might slip through
			  style={{ background: 'transparent', border: 0, boxShadow: 'none', lineHeight: 1 }}
			>
			  ×
			</button>
          </div>
        </div>
      ))}
    </div>
  );
}

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

 const chipsRef = useRef<HTMLDivElement | null>(null);
const [canScrollLeft, setCanScrollLeft] = useState(false);
const [canScrollRight, setCanScrollRight] = useState(false);

const onChevronLeft = () => {
  chipsRef.current?.scrollBy({ left: -160, behavior: "smooth" });
};

const onChevronRight = () => {
  chipsRef.current?.scrollBy({ left: 160, behavior: "smooth" });
};
useEffect(() => {
  const el = chipsRef.current;
  if (!el) return;

  const checkScroll = () => {
    const hasOverflow = el.scrollWidth > el.clientWidth + 2;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);

    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(hasOverflow && el.scrollLeft < maxScroll - 2);
  };

  // run once + on resize + on scroll
  checkScroll();
  el.addEventListener("scroll", checkScroll);
  window.addEventListener("resize", checkScroll);

  const resizeObserver = new ResizeObserver(checkScroll);
  resizeObserver.observe(el);

  return () => {
    el.removeEventListener("scroll", checkScroll);
    window.removeEventListener("resize", checkScroll);
    resizeObserver.disconnect();
  };
}, []);

return (
    <div
      role="listitem"
      className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 p-3 shadow-sm"
    >
      <Avatar src={avatarUrl ?? null} />

      <div className="min-w-0 w-full">
        <div className="text-sm font-medium text-gray-900 truncate">{name}</div>

        {/* Scrollable chips with left/right chevrons */}
        <div className="relative mt-0.5 overflow-visible max-w-[200px] ml-auto">
          <div
            ref={chipsRef}
            className="overflow-x-auto no-scrollbar"
            style={{
              scrollBehavior: "smooth",
              paddingRight: "1.5rem",
            }}
          >
            <div className="flex items-center gap-2 text-xs text-gray-700 whitespace-nowrap w-max">
              <span className="text-gray-600">Offers:</span>
              {offerMain ? (
                <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[12px] text-gray-800">
                  {offerMain}
                </span>
              ) : (
                <span className="text-gray-500">—</span>
              )}
              <span className="text-gray-400 mx-1" aria-hidden="true">|</span>
              <span className="text-gray-600">Wants:</span>
              {wantMain ? (
                <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[12px] text-gray-800">
                  {wantMain}
                </span>
              ) : (
                <span className="text-gray-500">—</span>
              )}
            </div>
          </div>

          {/* Left chevron */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={onChevronLeft}
              aria-label="Scroll left"
              className="absolute left-[-0.75rem] top-1/2 -translate-y-1/2 z-40
                        flex items-center justify-center w-6 h-6 rounded-full
                        !bg-white border border-gray-300 shadow-sm text-gray-600
                        hover:text-[#3F4F83] hover:border-[#3F4F83]
                        transition-all duration-150"
            >
              ‹
            </button>
          )}

          {/* Right chevron */}
          {canScrollRight && (
            <button
              type="button"
              onClick={onChevronRight}
              aria-label="Scroll right"
              className="absolute top-1/2 -translate-y-1/2 z-40
                        flex items-center justify-center w-6 h-6 rounded-full
                        !bg-white border border-gray-300 shadow-sm text-gray-600
                        hover:text-[#3F4F83] hover:border-[#3F4F83]
                        transition-all duration-150"
              style={{
                right: '-1.25rem',
              }}
            >
              ›
            </button>
          )}
        </div>
      </div>
    </div>
  );

}

// ——— anchor: SuggestedPersonButton props ———
function SuggestedPersonButton({
  data,
  onSendRequest,
  onAcceptRequest,
  isBusy,
  isSent,
  isIncoming,
  incomingRequestId,
}: {
  data: PersonRowData;
  onSendRequest: (userId: number) => void;
  onAcceptRequest: (requestId: string, userId: number) => void;
  isBusy: boolean;
  isSent: boolean;
  isIncoming: boolean;
  incomingRequestId?: string | undefined;
}) {

  const { name, avatarUrl, offerMain, wantMain, userId } = data;

  const chipsRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
const [canScrollRight, setCanScrollRight] = useState(false);

const onChevronRight = () => {
  const el = chipsRef.current;
  if (el) el.scrollBy({ left: 120, behavior: "smooth" });
};
const onChevronLeft = () => {
  const el = chipsRef.current;
  if (el) el.scrollBy({ left: -120, behavior: "smooth" });
};

// detect overflow and chevron visibility
useEffect(() => {
  const el = chipsRef.current;
  if (!el) return;

  const checkScroll = () => {
    // Detect total overflow width
    const hasOverflow = el.scrollWidth > el.clientWidth + 2;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);

    // Update scroll states
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(hasOverflow && el.scrollLeft < maxScroll - 2);
  };

  // Initial check after render and again after a small delay
  const initial = requestAnimationFrame(checkScroll);
  const delayed = setTimeout(checkScroll, 250); // catches late text/font rendering

  // Listen for changes
  el.addEventListener("scroll", checkScroll);
  window.addEventListener("resize", checkScroll);

  const resizeObserver = new ResizeObserver(checkScroll);
  resizeObserver.observe(el);

  return () => {
    cancelAnimationFrame(initial);
    clearTimeout(delayed);
    el.removeEventListener("scroll", checkScroll);
    window.removeEventListener("resize", checkScroll);
    resizeObserver.disconnect();
  };
}, [chipsRef]);

  // Decide action for the invisible pill
  const onOverlayClick = () => {
    if (isBusy) return;
    if (isIncoming && incomingRequestId) {
      onAcceptRequest(incomingRequestId, userId);
    } else if (!isSent) {
      onSendRequest(userId);
    }
  };

  const cardStateClasses = isBusy || isSent ? "opacity-60" : "";
  const overlayCursor =
    isBusy || (isSent && !isIncoming) ? "cursor-not-allowed" : "cursor-pointer";

  // --- Overlay sizing from visible pill ---
  const cardRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLButtonElement | null>(null);

  const measureAndFitOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    const card = cardRef.current;
    if (!overlay || !card) return;

    const pill = overlay.previousElementSibling as HTMLElement | null;
    if (!pill) return;

    const pillRect = pill.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();

    const inset = 1;
    const left = pillRect.left - cardRect.left + inset;
    const top = pillRect.top - cardRect.top + inset;
    const width = Math.max(0, pillRect.width - inset * 2);
    const height = Math.max(0, pillRect.height - inset * 2);

    const s = overlay.style;
    s.left = `${left}px`;
    s.top = `${top}px`;
    s.width = `${width}px`;
    s.height = `${height}px`;
    s.padding = "0";
    s.transform = "none";
  }, []);

  useLayoutEffect(() => {
    measureAndFitOverlay();
    const id = requestAnimationFrame(() => measureAndFitOverlay());
    return () => cancelAnimationFrame(id);
    // include isIncoming so label swap re-measures
  }, [measureAndFitOverlay, isBusy, isSent, isIncoming, name]);

  useEffect(() => {
    const onResize = () => measureAndFitOverlay();
    window.addEventListener("resize", onResize);

    const vv = window.visualViewport;
    vv?.addEventListener("resize", onResize);

    let last = window.devicePixelRatio;
    const dprTimer = window.setInterval(() => {
      if (window.devicePixelRatio !== last) {
        last = window.devicePixelRatio;
        measureAndFitOverlay();
      }
    }, 300);

    return () => {
      window.removeEventListener("resize", onResize);
      vv?.removeEventListener("resize", onResize);
      clearInterval(dprTimer);
    };
  }, [measureAndFitOverlay]);

  const onCardHoverOrFocus = useCallback(() => {
    requestAnimationFrame(() => measureAndFitOverlay());
  }, [measureAndFitOverlay]);

  // Derive label
  const label = isBusy
    ? isIncoming
      ? "Accepting…"
      : "Sending…"
    : isIncoming
      ? "Accept Request"
      : isSent
        ? "Requested"
        : "Send Request";

  const ariaLabel = isIncoming
    ? `Accept request from ${name}`
    : isSent
      ? `Request already sent to ${name}`
      : `Send Request: ${name}`;

return (
  <div role="listitem">
    <div
      ref={cardRef}
      className={`group relative w-full text-left
                  flex items-center gap-3
                  bg-white hover:!bg-white active:!bg-white
                  rounded-lg border border-gray-200 p-3 shadow-sm
                  hover:shadow-md ${cardStateClasses}
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3F4F83]
                  transition`}
      aria-disabled={isBusy || (isSent && !isIncoming)}
      onMouseEnter={onCardHoverOrFocus}
      onFocus={onCardHoverOrFocus}
    >
      <Avatar src={avatarUrl ?? null} />

      <div className="min-w-0">
  {/* Name above chips */}
  <div className="text-sm font-medium text-gray-900 truncate mb-1">{name}</div>

  {/* Chip container */}
  <div className="relative mt-0.5 overflow-visible max-w-[200px] ml-auto">

  {/* Scrollable area */}
  <div
    ref={chipsRef}
    className="overflow-x-auto no-scrollbar"
    style={{
      scrollBehavior: "smooth",
      paddingRight: "1.5rem", // keeps last chip from clipping
    }}
  >
    <div className="flex items-center gap-2 text-xs text-gray-700 whitespace-nowrap w-max">
      <span className="text-gray-600">Offers:</span>
      {offerMain ? (
        <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[12px] text-gray-800">
          {offerMain}
        </span>
      ) : (
        <span className="text-gray-500">—</span>
      )}
      <span className="text-gray-400 mx-1" aria-hidden="true">|</span>
      <span className="text-gray-600">Wants:</span>
      {wantMain ? (
        <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[12px] text-gray-800">
          {wantMain}
        </span>
      ) : (
        <span className="text-gray-500">—</span>
      )}
    </div>
  </div>

  {/* Left chevron */}
  {canScrollLeft && (
    <button
      type="button"
      onClick={onChevronLeft}
      aria-label="Scroll left"
      className="absolute left-[-0.75rem] top-1/2 -translate-y-1/2 z-40
                 flex items-center justify-center w-6 h-6 rounded-full
                 !bg-white border border-gray-300 shadow-sm text-gray-600
                 hover:text-[#3F4F83] hover:border-[#3F4F83]
                 transition-all duration-150"
    >
      ‹
    </button>
  )}

  {/* Right chevron */}
  {canScrollRight && (
    <button
      type="button"
      onClick={onChevronRight}
      aria-label="Scroll right"
      className="absolute top-1/2 -translate-y-1/2 z-40
                 flex items-center justify-center w-6 h-6 rounded-full
                 !bg-white border border-gray-300 shadow-sm text-gray-600
                 hover:text-[#3F4F83] hover:border-[#3F4F83]
                 transition-all duration-150"
      style={{
        right: '-3.6rem', // edge of the card
      }}
    >
      ›
    </button>
  )}
</div>
        {/* Visible pill (not clickable) */}
        <span
          aria-hidden="true"
          className={[
            "pointer-events-none absolute top-2 right-3 rounded-full px-2 py-1 text-xs font-medium shadow",
            isSent && !isIncoming
              ? "bg-gray-300 text-gray-800"
              : "bg-[#3F4F83] text-white",
            isBusy
              ? "opacity-100"
              : "opacity-0 -translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 group-focus-visible:opacity-100 group-focus-visible:translate-y-0",
            "transition",
          ].join(" ")}
          style={{ transform: "scale(0.9)", transformOrigin: "top right" }}
        >
          {label}
        </span>

        {/* Invisible overlay over the pill (actual click target) */}
        <button
          ref={overlayRef}
          type="button"
          onClick={onOverlayClick}
          disabled={isBusy || (isSent && !isIncoming)}
          aria-label={ariaLabel}
          className={`absolute z-10 rounded-full
                      focus:outline-none !bg-transparent !border-0 !shadow-none text-transparent select-none overflow-hidden
                      ${overlayCursor}`}
          style={{
            position: "absolute",
            background: "transparent",
            border: 0,
            boxShadow: "none",
            lineHeight: 1,
          }}
        >
          .
        </button>
      </div> {/* closes inner content wrapper */}
    </div>   {/* closes outer card container */}
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
  const [recentPeople, setRecentPeople] = useState<PersonRowData[]>([]);

      useEffect(() => {
        if (recentPartnerIds.length === 0) return;

        (async () => {
          const people = await Promise.all(
            recentPartnerIds.map(async (id) => {
              const profile = await getUserProfile(id);
              if (!profile) return null;
				// ANCHOR: recent-people-name-guard (REPLACE the object you return per partner)
				// --- REPLACEMENT inside recentPartnerIds.map(...) callback ---
				return {
				  userId: id,
				  name: safeName(profile.firstName, profile.lastName),
				  avatarUrl: null,
				  offerMain: profile.skills.find((s: any) => s.Type?.toLowerCase() === "offer")?.SkillName || null,
				  wantMain:  profile.skills.find((s: any) => s.Type?.toLowerCase() === "need")?.SkillName  || null,
				};
            })
          );
          setRecentPeople(people.filter(Boolean) as PersonRowData[]);
        })();
      }, [recentPartnerIds]);

  // Map Suggested Connections to PersonRowData
  // /matchskills returns { _id, skills: string[] } (no typed offer/need), so use a simple fallback:
  // offers = first skill, wants = second skill (if present).
	// ANCHOR: suggested-people-map-harden (REPLACE the whole useEffect)
// ANCHOR: suggested-people-map-harden (REPLACE the whole useEffect)
const [suggestedPeople, setSuggestedPeople] = useState<PersonRowData[]>([]);

	// === REPLACEMENT: suggested people mapping with safeName & Type casing ===
	useEffect(() => {
	  if (!matches || matches.length === 0) {
		setSuggestedPeople([]);
		return;
	  }

	  (async () => {
		try {
		  const results = await Promise.all(
			matches.map(async (m) => {
			  const id = Number((m as any)._id);
			  if (!Number.isFinite(id)) return null;

			  const profile = await getUserProfile(id);
			  if (!profile) return null;

			  return {
				userId: id,
				name: safeName(profile.firstName, profile.lastName),
				avatarUrl: null,
				offerMain: profile.skills.find((s: any) => s.Type?.toLowerCase() === "offer")?.SkillName || null,
				wantMain:  profile.skills.find((s: any) => s.Type?.toLowerCase() === "need")?.SkillName  || null,
			  } as PersonRowData;
			})
		  );

		  setSuggestedPeople(results.filter(Boolean) as PersonRowData[]);
		} catch (err) {
		  console.error("Failed to build suggested people:", err);
		  setSuggestedPeople([]);
		}
	  })();
	}, [matches]);

// ----- Friend requests + toasts (state and handlers) -----
const [requestInFlight, setRequestInFlight] = useState<Set<number>>(new Set());
const [requestSent, setRequestSent] = useState<Set<number>>(new Set());
// INSERT AFTER: const [requestSent, setRequestSent] = useState<Set<number>>(new Set());
const [incomingMap, setIncomingMap] = useState<Map<number, string>>(new Map());

// [INSERT AFTER] const [incomingMap, setIncomingMap] = useState<Map<number, string>>(new Map());

// Build a set of ALL chat partners (exclude these from search results)
const partnerSet = useMemo(() => {
  const s = new Set<number>();
  if (messages && messages.length > 0) {
    let meId = currentUser.id ?? null;
    if (meId == null) {
      // infer my id by frequency, same fallback as earlier
      const counts = new Map<number, number>();
      for (const m of messages) {
        counts.set(m.from, (counts.get(m.from) ?? 0) + 1);
        counts.set(m.to,   (counts.get(m.to)   ?? 0) + 1);
      }
      let best: number | null = null, bestCnt = -1;
      for (const [id, cnt] of counts) if (cnt > bestCnt) { best = id; bestCnt = cnt; }
      meId = best;
    }
    if (meId != null) {
      for (const m of messages) s.add(m.from === meId ? m.to : m.from);
      s.delete(meId); // safety
    }
  }
  return s;
}, [messages, currentUser.id]);

// --- Search UI state ---
const [searchQuery, setSearchQuery] = useState("");
const [searchOpen, setSearchOpen] = useState(false); // dropdown visibility
const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
const searchWrapRef = useRef<HTMLDivElement | null>(null);
const searchInputRef = useRef<HTMLInputElement | null>(null);

// rank results by simple heuristic so "closest" appears first
const rankedResults = useMemo(() => {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return [];

  // Exclude myself and anyone I already have messages with
  const meId = currentUser.id ?? -999999;
  const filtered = searchResults.filter(u => u.id !== meId && !partnerSet.has(u.id));

  const score = (u: SearchUser) => {
    const first = (u.firstName ?? "").toLowerCase();
    const last  = (u.lastName  ?? "").toLowerCase();
    const mail  = (u.email     ?? "").toLowerCase();
    const full  = (first + " " + last).trim();

    if (full === q || mail === q) return 0;
    if (first.startsWith(q) || last.startsWith(q) || mail.startsWith(q)) return 10;
    if (full.startsWith(q)) return 12;
    if (first.includes(q) || last.includes(q) || mail.includes(q) || full.includes(q)) return 20;
    return 50;
  };

  return [...filtered].sort((a, b) => score(a) - score(b)).slice(0, 10);
}, [searchQuery, searchResults, partnerSet, currentUser.id]);

// Debounced fetch when typing (only if the input is non-empty and dropdown is open)
useEffect(() => {
  const q = searchQuery.trim();
  if (!q || !searchOpen) {
    setSearchResults([]);
    return;
  }
  let cancelled = false;
  const t = window.setTimeout(async () => {
    try {
      const res = await searchUsersAPI(q);
      if (!cancelled) setSearchResults(res);
    } catch (e) {
      if (!cancelled) setSearchResults([]);
    }
  }, 200);
  return () => { cancelled = true; clearTimeout(t); };
}, [searchQuery, searchOpen]);

// Close dropdown when clicking outside the search area
useEffect(() => {
  const onDocDown = (e: MouseEvent | PointerEvent) => {
    const t = e.target as Node | null;
    const host = searchWrapRef.current;
    if (!host || !t) return;
    if (!host.contains(t)) setSearchOpen(false);
  };
  document.addEventListener("pointerdown", onDocDown);
  return () => document.removeEventListener("pointerdown", onDocDown);
}, []);

const toastIdRef = useRef(0);
const [toasts, setToasts] = useState<ToastMsg[]>([]);
const dismissToast = useCallback((id: number) => {
  setToasts((t) => t.filter((x) => x.id !== id));
}, []);
const showToast = useCallback((kind: ToastKind, message: string) => {
  const id = ++toastIdRef.current;
  setToasts((t) => [...t, { id, kind, message }]);
  window.setTimeout(() => dismissToast(id), 3600);
}, [dismissToast]);

// Seed "Requested" from server-side outgoing requests (fetch full set, merge into state)
useEffect(() => {
  const token = getToken();
  if (!token) return;

  let cancelled = false;
  (async () => {
    try {
      const outgoing = await getOutgoingFriendRequests(); // array of toUserId
      if (cancelled) return;

      setRequestSent((prev) => {
        const merged = new Set(prev);
        for (const id of outgoing) merged.add(id);
        return merged;
      });
    } catch {
      // Silent fail: UI still renders; items remain unrequested until user interacts or next load.
    }
  })();

  return () => { cancelled = true; };
  // Runs on mount. If you support account switching in-session, add currentUser.id to deps.
}, []);

// INSERT AFTER: the useEffect that seeds requestSent from /friend-requests/outgoing
useEffect(() => {
  const token = getToken();
  if (!token) return;

  let cancelled = false;
  (async () => {
    try {
      const map = await getIncomingFriendRequests(); // Map<fromUserId, requestId>
      if (cancelled) return;
      setIncomingMap(map);
    } catch {
      // silently ignore; dashboard still works
    }
  })();

  return () => {
    cancelled = true;
  };
}, []);

// Send request: optimistic mark + informative toasts
const onSendRequest = useCallback(async (userId: number) => {
  if (requestInFlight.has(userId) || requestSent.has(userId)) return;

  setRequestInFlight((prev) => {
    const n = new Set(prev);
    n.add(userId);
    return n;
  });

  try {
    await sendFriendRequest(userId);

    setRequestSent((prev) => {
      const n = new Set(prev);
      n.add(userId); // immediate gray + "Requested" and will re-order to bottom
      return n;
    });

    showToast("success", "Request sent");
  } catch (e: any) {
    if (e instanceof ApiError) {
      if (e.status === 400) {
        const raw = (e.body as any)?.error || e.message || "";
        const already = /exist|already/i.test(raw);

        if (already) {
          // Reflect server truth locally so card re-orders to bottom
          setRequestSent((prev) => {
            const n = new Set(prev);
            n.add(userId);
            return n;
          });

          // Optional hardening: refetch authoritative outgoing list and merge
          try {
            const fresh = await getOutgoingFriendRequests(); // array<number>
            setRequestSent((prev) => {
              const merged = new Set(prev);
              for (const id of fresh) merged.add(id);
              return merged;
            });
          } catch {
            // ignore; UI remains usable
          }
        }

        const friendly = already ? "Already requested or already friends" : (raw || "Bad request");
        showToast("info", friendly);
      } else if (e.status === 401 || e.status === 403) {
        showToast("error", "Please sign in again to send requests");
      } else {
        showToast("error", "Could not send request. Try again later.");
      }
    } else {
      showToast("error", "Could not send request. Try again later.");
    }
  } finally {
    setRequestInFlight((prev) => {
      const n = new Set(prev);
      n.delete(userId);
      return n;
    });
  }
}, [requestInFlight, requestSent, showToast]);

// INSERT AFTER: onSendRequest handler
const onAcceptIncoming = useCallback(
  async (requestId: string, userId: number) => {
    if (requestInFlight.has(userId)) return;

    setRequestInFlight((prev) => {
      const n = new Set(prev);
      n.add(userId);
      return n;
    });

    try {
      await respondToOffer(requestId, "accept");
      // Remove from incoming map; server also deletes the pending request
      setIncomingMap((prev) => {
        const n = new Map(prev);
        n.delete(userId);
        return n;
      });
      showToast("success", "Request accepted");
      // Open Messages like the Offers page behavior
      window.location.assign("/messages");
    } catch (e: any) {
      showToast("error", e?.message ?? "Failed to accept request");
    } finally {
      setRequestInFlight((prev) => {
        const n = new Set(prev);
        n.delete(userId);
        return n;
      });
    }
  },
  [requestInFlight, showToast]
);

// ----- Suggested vs. Recent alignment helpers (order + cap + conditional justify) -----
const recentsListRef = useRef<HTMLDivElement | null>(null);
const [justifySuggested, setJustifySuggested] = useState(false);
const [suggestedMinHeight, setSuggestedMinHeight] = useState<number | undefined>(undefined);

// Stable-partition: unrequested first, requested later (preserve original order within groups)
const suggestedOrdered = useMemo(() => {
  if (!suggestedPeople || suggestedPeople.length === 0) return [] as PersonRowData[];
  const unrequested: PersonRowData[] = [];
  const requested: PersonRowData[] = [];
  for (const p of suggestedPeople) {
    (requestSent.has(p.userId) ? requested : unrequested).push(p);
  }
  return unrequested.concat(requested);
}, [suggestedPeople, requestSent]);

// Cap AFTER ordering (2 cols × 3 rows = 6)
const suggestedCapped = useMemo(() => suggestedOrdered.slice(0, 6), [suggestedOrdered]);

useEffect(() => {
  const mql = window.matchMedia("(min-width: 1024px)"); // Tailwind 'lg'
  const compute = () => {
    const isDesktop = mql.matches;
    const recentRows = recentPeople.length;                      // one per row, max 2
    const suggestedRows = Math.ceil(suggestedCapped.length / 2); // 2 cols at ≥sm
    const shouldJustify = isDesktop && recentRows === 2 && suggestedRows === 3;

    setJustifySuggested(shouldJustify);

    if (shouldJustify && recentsListRef.current) {
      setSuggestedMinHeight(recentsListRef.current.offsetHeight);
    } else {
      setSuggestedMinHeight(undefined);
    }
  };

  compute();
  mql.addEventListener("change", compute);
  window.addEventListener("resize", compute);
  return () => {
    mql.removeEventListener("change", compute);
    window.removeEventListener("resize", compute);
  };
}, [recentPeople.length, suggestedCapped.length]);

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
      <div className="bg-white text-black rounded-2xl shadow-lg w-[min(1100px,92vw)] overflow-hidden flex flex-col">
        {/* Navbar */}
        <header className="grid grid-cols-[1fr_auto_1fr] items-center py-2 pl-8 pr-6 bg-white text-[#313131] border-b border-gray-200">
          {/* Left: logo + title in brand blue */}
          <div className="flex items-center gap-3 justify-self-start">
                            <Link
                    to="/dashboard"
                    className="flex items-center space-x-2 text-[#3F4F83] hover:opacity-90 transition-all duration-200"
                >
                    <LogoMark className="w-8 h-8 text-current" />
                    <h3 className="text-2xl text-current px-3">SkillSwap</h3>
                    </Link>
          </div>

          {/* Center: nav items, horizontally centered, with black bullets */}
          <nav className="flex items-center justify-center gap-0 text-sm">
            {[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Offers", href: "/offers" },
              { label: "Messages", href: "/messages" },
              { label: "Profile", href: "/profile" },
            ].map((item, idx) => {
              const isActive = item.label === "Dashboard";
				const base =
				  "no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3F4F83] rounded-sm px-2 py-1";
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
						 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3F4F83] focus-visible:ring-offset-0 rounded-sm"
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
        <main className="flex-1 bg-[#F7F8FC] px-6 pt-4 pb-6">
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
                  <div role="list" ref={recentsListRef} className="grid gap-3">
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
				<div className="w-full" ref={searchWrapRef}>
				  {/* White pill input container (positioning anchor) */}
				  <div className="relative bg-white rounded-full shadow-sm border border-gray-300 pl-4 pr-16 py-2 overflow-visible">
					<input
					  ref={searchInputRef}
					  id="dashSearch"
					  className="w-full bg-transparent border-0 outline-none text-sm text-[#313131] placeholder:text-gray-500"
					  placeholder="Search for users"
					  aria-describedby="searchHelp"
					  value={searchQuery}
					  onChange={(e) => setSearchQuery(e.target.value)}
					  onFocus={() => setSearchOpen(true)}
					/>

					{/* Circular button docked flush to the right INSIDE the pill (cosmetic only) */}
					<button
					  type="button"
					  className="absolute right-0 top-1/2 -translate-y-1/2
								 w-10 h-10 p-0 rounded-full
								 !bg-transparent !border-0 !shadow-none appearance-none leading-none
								 hover:opacity-90 focus:outline-none
								 focus-visible:ring-2 focus-visible:ring-[#3F4F83] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
					  aria-label="Search"
					>
					  {/* Blue circle fills the button area exactly */}
					  <span className="absolute inset-0 rounded-full bg-[#3F4F83] overflow-hidden" />
					  {/* Icon centered within the circle */}
					  <SearchIcon
						className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
								   w-7 h-7 text-white block pointer-events-none"
						aria-hidden="true"
					  />
					</button>

					{/* Dropdown (only when input has content and is focused/open) */}
					{searchOpen && searchQuery.trim() && rankedResults.length > 0 && (
					  <div
              role="listbox"
              aria-label="User search results"
              className="absolute left-0 right-0 top-[calc(100%+6px)] z-40
                        bg-white border border-gray-200 rounded-xl shadow-lg
                        max-h-[320px] overflow-y-auto"
            >

						{rankedResults.map((u) => {
						  const incomingId = incomingMap.get(u.id);
						  const isIncoming = Boolean(incomingId);
						  const alreadySent = requestSent.has(u.id);
						  const label = isIncoming ? "Accept Request" : (alreadySent ? "Requested" : "Send Request");

						  const onAction = () => {
              if (isIncoming && incomingId) {
                onAcceptIncoming(incomingId, u.id);
              } else if (!alreadySent) {
                onSendRequest(u.id);
                showToast("success", "Request sent");
              }
            };

						  const rightPillDisabled = isIncoming ? false : alreadySent;

						  return (
							<div
							  key={u.id}
							  role="option"
							  className="group relative flex items-center justify-between px-3 py-2 border-b last:border-b-0 border-gray-100 hover:bg-gray-50"
							>
							  <div className="flex items-center gap-2 min-w-0">
								<Avatar />
								<div className="min-w-0">
								  <div className="text-sm font-medium text-gray-900 truncate">
									{safeName(u.firstName, u.lastName)}
								  </div>
								  <div className="text-xs text-gray-600 truncate">
									{u.email ? u.email : `ID #${u.id}`}
								  </div>
								</div>
							  </div>
								<span
								  role="button"
								  tabIndex={rightPillDisabled ? -1 : 0}
								  aria-disabled={rightPillDisabled || undefined}
								  onClick={() => { if (!rightPillDisabled) onAction(); }}
								  onKeyDown={(e) => {
									if (!rightPillDisabled && (e.key === "Enter" || e.key === " ")) {
									  e.preventDefault();
									  onAction();
									}
								  }}
								  className={[
									// hover-in reveal (keeps the same behavior)
									"opacity-0 group-hover:opacity-100 transition mr-1",
									"inline-flex items-center justify-center rounded-full text-xs font-medium",
									// spacing kept deliberately small for a compact pill
									"px-2 py-1",
									// focus ring for a11y
									"focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3F4F83]",
									// cursor state
									rightPillDisabled ? "cursor-not-allowed" : "cursor-pointer"
								  ].join(" ")}
								  // Inline styles ensure global .button selectors cannot override the pill
								  style={{
									backgroundColor: (isIncoming || !alreadySent) ? "#3F4F83" : "#d1d5db", // blue or gray
									color:           (isIncoming || !alreadySent) ? "#ffffff" : "#1f2937", // white or gray-800
									border: "none",
									boxShadow: "none",
									lineHeight: 1,
									// extra guards against global resets
									WebkitAppearance: "none",
									MozAppearance: "none",
									appearance: "none",
								  }}
								>
								  {label}
								</span>
							</div>
						  );
						})}
					  </div>
					)}
				  </div>

				  <p id="searchHelp" className="sr-only">
					Start typing to search. Press the pill on the right of a result to take action.
				  </p>
				</div>
				{/* Suggested Connections */}
				<section aria-labelledby="suggested-connections">
				  <h2
					id="suggested-connections"
					className="text-lg sm:text-xl font-medium text-gray-800 mb-3"
				  >
					Suggested Connections
				  </h2>

				  {matchesError && <div className="text-sm text-red-600">{matchesError}</div>}

				  {matches === null ? (
					<div className="text-sm text-gray-500">Loading…</div>
				  ) : suggestedPeople.length === 0 ? (
					  <div className="h-24 grid place-items-center text-gray-500">No suggestions yet.</div>
					) : (
					<div
					  role="list"
					  className={`grid grid-cols-1 sm:grid-cols-2 ${
						justifySuggested ? "gap-x-4 gap-y-0 content-between" : "gap-4"
					  }`}
					  style={
						justifySuggested && suggestedMinHeight
						  ? { height: suggestedMinHeight }
						  : undefined
					  }
					>
					  {suggestedCapped.map((p) => (
						// REPLACE the SuggestedPersonButton JSX in the map
						<SuggestedPersonButton
						  key={p.userId}
						  data={p}
						  onSendRequest={onSendRequest}
						  onAcceptRequest={onAcceptIncoming}
						  isBusy={requestInFlight.has(p.userId)}
						  isSent={requestSent.has(p.userId)}
						  isIncoming={incomingMap.has(p.userId)}
						  incomingRequestId={incomingMap.get(p.userId)}
						/>
					  ))}
					</div>
				  )}
				</section>
            </div>
          </div>
        </main>
		<ToastHost toasts={toasts} onDismiss={dismissToast} />
      </div>
    </div>
  );
}