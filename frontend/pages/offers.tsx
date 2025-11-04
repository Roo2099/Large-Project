import React, { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import { Link } from "react-router-dom";
import LogoMark from "../assets/SkillSwap.svg?react";

const API_ROOT =
  (import.meta as any)?.env?.VITE_API_URL
    ? `${(import.meta as any).env.VITE_API_URL}/api`
    : "https://poosd24.live/api";

const deleteOffer = async (skillName: string) => {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("You must be logged in.");
    return false;
  }

  try {
    const res = await fetch(
      `${API_ROOT}/deleteskill/${encodeURIComponent(skillName)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const data = await res.json();
    if (res.ok && data.success) return true;
    alert(data.message || "Failed to delete Offer.");
    return false;
  } catch (err) {
    console.error("Error deleting Offer:", err);
    alert("Network error deleting Offer.");
    return false;
  }
};

const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE ?? "https://poosd24.live/api";
const TOKEN_KEY = "token";

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

type Match = {
  _id: number;
  firstName?: string;
  lastName?: string;
  skills?: { SkillName: string; Type: string }[];
};

type MyOffer = {
  SkillName: string;
  Type: string;
};

export default function OffersPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [myOffers, setMyOffers] = useState<MyOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      window.location.assign("/login");
      return;
    }

    // ===== Fetch My Offers =====
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/myskills`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();

        // Normalize case for Type
        const offerList = (data.mySkills || []).filter(
          (s: any) => s.Type?.toLowerCase() === "offer"
        );
        setMyOffers(offerList);
      } catch (err: any) {
        console.error("Failed to load my offers:", err);
      }
    })();

    // ===== Fetch Suggested Connections =====
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/matchskills`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();

        // Fallback for missing fields
        const fixedMatches = (data.matches || []).map((m: any) => ({
          _id: m._id,
          firstName: m.firstName || "Unknown",
          lastName: m.lastName || "",
          skills: m.skills || [],
        }));

        setMatches(fixedMatches);
      } catch (err: any) {
        console.error("Failed to load matchskills:", err);
        setError(err.message ?? "Failed to load offers");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen grid place-items-center bg-slate-200">
      <div className="bg-white text-black rounded-2xl shadow-lg w-[min(1100px,92vw)] h-auto min-h-[78vh] overflow-hidden flex flex-col">
        {/* ===== Navbar ===== */}
        <header className="flex justify-between items-center py-4 px-6 bg-white border-b border-gray-200">
  <div className="flex items-center gap-3">
    {/* Logo + Title */}
                             <Link
                     to="/dashboard"
                     className="flex items-center space-x-2 text-[#3F4F83] hover:opacity-90 transition-all duration-200"
                 >
                     <LogoMark className="w-8 h-8 text-current scale-150" />
                     <h3 className="text-2xl text-current px-3">SkillSwap</h3>
                     </Link></div>

  {/* Navigation */}
  <nav className="flex items-center gap-0 text-sm">
    {[
      { label: "Dashboard", href: "/dashboard" },
      { label: "Offers", href: "/offers" },
      { label: "Messages", href: "/messages" },
      { label: "Profile", href: "/profile" },
    ].map((item, idx) => {
      const isActive = item.label === "Offers";
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
    </header>


        {/* ===== Main Content ===== */}
        <main className="flex-1 bg-[#F7F8FC] px-6 py-6">
          {/* My Offers Section */}
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-3">
            My Offers
          </h1>

          {myOffers.length === 0 && (
            <p className="text-gray-500 text-sm mb-4">
              You have no current Offers.
            </p>
          )}

          {myOffers.map((offer) => (
            <div
              key={offer.SkillName}
              className="flex justify-between items-center border border-gray-200 rounded-lg bg-white p-3 mb-3 shadow-sm"
            >
              <div>
                <span className="font-medium text-gray-800">
                  {offer.SkillName}
                </span>
                <span
                  className={`ml-2 text-xs px-2 py-[1px] rounded-md ${
                    offer.Type?.toLowerCase() === "offer"
                      ? "bg-green-100 text-green-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {offer.Type?.charAt(0).toUpperCase() +
                    offer.Type?.slice(1).toLowerCase()}
                </span>
              </div>

              <button
                onClick={async () => {
                  const confirmDelete = confirm(
                    `Delete "${offer.SkillName}"?`
                  );
                  if (!confirmDelete) return;

                  const success = await deleteOffer(offer.SkillName);
                  if (success) {
                    setMyOffers((prev) =>
                      prev.filter((o) => o.SkillName !== offer.SkillName)
                    );
                  }
                }}
                className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-md hover:bg-red-200 transition"
              >
                🗑 Delete
              </button>
            </div>
          ))}

          {/* Suggested Connections */}
          <h2 className="text-lg font-semibold text-gray-800 mt-6 mb-3">
            Suggested Connections
          </h2>

          {loading && (
            <div className="text-gray-600 text-sm">Loading matches…</div>
          )}
          {error && <div className="text-red-600 text-sm">{error}</div>}

          {!loading && !error && matches.length === 0 && (
            <div className="text-gray-500 text-sm">
              No matching users found yet.
            </div>
          )}

          <ul className="grid gap-4 mt-4">
            {matches.map((match) => (
              <li
                key={match._id}
                className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm flex items-center justify-between"
              >
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {match.firstName}{" "}
                    {match.lastName ? match.lastName.charAt(0) + "." : ""}
                    <span className="text-gray-500 text-xs font-normal ml-1"> ID: {match._id}</span>
                  </h3>

                  <div className="flex flex-wrap gap-2 mt-2">
                    {match.skills?.map((s, i) => (
                      <span
                        key={i}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.Type?.toLowerCase() === "offer"
                            ? "bg-green-100 text-green-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {s.SkillName} (
                        {s.Type?.charAt(0).toUpperCase() +
                          s.Type?.slice(1).toLowerCase()}
                        )
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <a
                    href="/messages"
                    className="bg-[#3F4F83] !text-white font-medium px-4 py-2 rounded-md shadow-sm hover:bg-[#2e3b6b] transition-colors duration-150"
                  >
                    Message
                  </a>

                  <a
                    href={`/user/${match._id}`}
                    className="border border-[#3F4F83] text-[#3F4F83] font-medium px-4 py-2 rounded-md hover:bg-[#3F4F83] hover:text-white transition"
                  >
                    View Profile
                  </a>

                  <button
                    onClick={() =>
                      setMatches((prev) =>
                        prev.filter((m) => m._id !== match._id)
                      )
                    }
                    className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-md hover:bg-red-200 transition"
                  >
                    🗑 Delete
                  </button>



                </div>
              </li>
            ))}
          </ul>
        </main>
      </div>
    </div>
  );
}
