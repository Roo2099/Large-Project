import React, { useEffect, useState } from "react";

const API_BASE = (import.meta as any)?.env?.VITE_API_BASE ?? "https://poosd24.live/api";
const TOKEN_KEY = "token";

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// Updated type: API now returns names too
type Match = {
  _id: number;
  firstName?: string;
  lastName?: string;
  skills: string[];
};

export default function OffersPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      window.location.assign("/login");
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/matchskills`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setMatches(data.matches || []);
      } catch (err: any) {
        setError(err.message ?? "Failed to load offers");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen grid place-items-center bg-slate-200">
      <div className="bg-white text-black rounded-2xl shadow-lg w-[min(1100px,92vw)] h-auto min-h-[78vh] overflow-hidden flex flex-col">
        {/* Navbar */}
        <header className="flex justify-between items-center py-4 px-6 bg-white border-b border-gray-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-semibold text-[#3F4F83]">SkillSwap</span>
          </div>
          <nav className="flex items-center gap-2 text-sm text-[#313131]">
            <a href="/dashboard" className="px-2 hover:text-[#3F4F83]">
              Dashboard
            </a>
            <span>•</span>
            <span className="font-semibold text-[#3F4F83]">Offers</span>
            <span>•</span>
            <a href="/messages" className="px-2 hover:text-[#3F4F83]">
              Messages
            </a>
            <span>•</span>
            <a href="/profile" className="px-2 hover:text-[#3F4F83]">
              Profile
            </a>
          </nav>
        </header>

        {/* Main Content */}
        <main className="flex-1 bg-[#F7F8FC] px-6 py-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-4">
            Skill Match Offers
          </h1>

          {loading && <div className="text-gray-600 text-sm">Loading matches…</div>}
          {error && <div className="text-red-600 text-sm">{error}</div>}

          {!loading && !error && matches.length === 0 && (
            <div className="text-gray-500 text-sm">No matching users found yet.</div>
          )}

          <ul className="grid gap-4 mt-4">
            {matches.map((match) => (
              <li
                key={match._id}
                className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm flex items-center justify-between"
              >
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {match.firstName || "User"}{" "}
                    {match.lastName ? match.lastName.charAt(0) + "." : ""}
                  </h3>
                  {match.skills && (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {match.skills.map((skill, i) => (
                        <span
                          key={i}
                          className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[12px] text-gray-800"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <a
                    href="/messages"
                    className="bg-[#3F4F83] !text-white font-medium px-4 py-2 rounded-md shadow-sm hover:bg-[#2e3b6b] transition-colors duration-150"
                  >
                    Message
                  </a>
                  <a
                    href="/profile"
                    className="border border-[#3F4F83] text-[#3F4F83] font-medium px-4 py-2 rounded-md hover:bg-[#3F4F83] hover:text-white transition"
                  >
                    View Profile
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </main>
      </div>
    </div>
  );
}
