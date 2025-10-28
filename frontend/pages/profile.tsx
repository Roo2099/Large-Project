import React, { useEffect, useState } from "react";
import DefaultUser from "../assets/user.svg";
import LogoMark from "../assets/SkillSwap.svg?react";

// Match your env logic from dashboard.tsx
const API_ROOT =
  (import.meta as any)?.env?.VITE_API_URL
    ? `${(import.meta as any).env.VITE_API_URL}/api`
    : ((import.meta as any)?.env?.VITE_API_BASE ?? "https://poosd24.live/api");

const TOKEN_KEY = "token";
const FIRST_NAME_KEY = "firstName";
const LAST_NAME_KEY = "lastName";
const USER_ID_KEY = "userId";
const EMAIL_KEY = "login"; // store this in localStorage after login if not already

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function safeName(first?: string | null, last?: string | null) {
  if (!first && !last) return "Firstname L.";
  if (first && last) return `${first} ${last[0]}.`;
  return first || last || "Firstname L.";
}

type Skill = { SkillName: string; Type: "offer" | "need" };

// Helper for API fetch
async function apiFetch<T>(
  path: string,
  opts: { method?: string; token?: string | null; body?: any } = {}
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  const res = await fetch(`${API_ROOT}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : null,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function ProfilePage() {
  const [firstName, setFirstName] = useState(localStorage.getItem(FIRST_NAME_KEY) ?? "");
  const [lastName, setLastName] = useState(localStorage.getItem(LAST_NAME_KEY) ?? "");
  const [email, setEmail] = useState(localStorage.getItem("login") ?? "example@email.com");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const token = getToken();

  // Redirect if not logged in
  useEffect(() => {
    if (!token) window.location.assign("/");
  }, [token]);

  // Fetch user’s skills
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_ROOT}/myskills`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setSkills(data.mySkills || []);
      } catch (err) {
        console.error("Failed to load skills", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const offerSkills = skills.filter((s) => s.Type === "offer").map((s) => s.SkillName);
  const needSkills = skills.filter((s) => s.Type === "need").map((s) => s.SkillName);

  // Handle name update
  const handleNameUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      alert("Both first and last name are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_ROOT}/update-name`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ firstName, lastName }),
      });
      if (!res.ok) throw new Error(await res.text());
      alert("Name updated successfully!");
      localStorage.setItem(FIRST_NAME_KEY, firstName);
      localStorage.setItem(LAST_NAME_KEY, lastName);
      setEditing(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update name.");
    } finally {
      setSaving(false);
    }
  };

  // Password reset shortcut
  const handlePasswordReset = async () => {
    try {
      const res = await fetch(`${API_ROOT}/request-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: email }),
      });
      if (res.ok) alert("Password reset email sent!");
      else alert("Failed to send password reset email.");
    } catch (err) {
      console.error(err);
      alert("Error sending reset email.");
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen grid place-items-center bg-slate-200">
      <div className="bg-white text-black rounded-2xl shadow-lg w-[min(900px,90vw)] p-6 border border-gray-200">
        {/* Header */}
        <header className="flex items-center justify-between border-b pb-4 mb-6">
          <div className="flex items-center gap-3">
            <LogoMark className="w-8 h-8 text-[#3F4F83]" />
            <h1 className="text-2xl font-semibold text-[#3F4F83]">My Profile</h1>
          </div>
          <button
            onClick={handleLogout}
            className="text-red-600 border border-red-300 px-3 py-1.5 rounded-md text-sm hover:bg-red-50"
          >
            Sign Out
          </button>
        </header>

        {/* User Info */}
        <section className="flex items-center gap-5 mb-8">
          <div className="w-16 h-16 rounded-full bg-[#3F4F83] grid place-items-center shadow">
            <img src={DefaultUser} className="w-12 h-12" alt="User avatar" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-gray-900">
              {safeName(firstName, lastName)}
            </h2>
            <p className="text-sm text-gray-600">{email}</p>
          </div>
        </section>

        {/* Edit Name Form */}
        <section className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-8">
          <h3 className="text-md font-medium text-gray-800 mb-3">Edit Your Name</h3>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="bg-[#3F4F83] text-white px-4 py-2 rounded-md text-sm"
            >
              Edit Name
            </button>
          ) : (
            <form onSubmit={handleNameUpdate} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1"
              />
              <input
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1"
              />
              <button
                type="submit"
                disabled={saving}
                className="bg-[#3F4F83] text-white px-4 py-2 rounded-md text-sm disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="border border-gray-300 text-gray-600 px-4 py-2 rounded-md text-sm"
              >
                Cancel
              </button>
            </form>
          )}
        </section>

        {/* Skills Summary */}
        <section className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-8">
          <h3 className="text-md font-medium text-gray-800 mb-3">Your Skills</h3>
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : skills.length === 0 ? (
            <p className="text-sm text-gray-500">You haven't added any skills yet.</p>
          ) : (
            <>
              <div className="mb-2">
                <h4 className="font-medium text-sm text-gray-700">Offering</h4>
                {offerSkills.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {offerSkills.map((s) => (
                      <span
                        key={s}
                        className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded-full"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">None</p>
                )}
              </div>
              <div className="mt-2">
                <h4 className="font-medium text-sm text-gray-700">Looking For</h4>
                {needSkills.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {needSkills.map((s) => (
                      <span
                        key={s}
                        className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">None</p>
                )}
              </div>
            </>
          )}
        </section>

        {/* Account Actions */}
        <section className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h3 className="text-md font-medium text-gray-800 mb-3">Account Actions</h3>
          <button
            onClick={handlePasswordReset}
            className="bg-[#3F4F83] text-white px-4 py-2 rounded-md text-sm"
          >
            Send Password Reset Email
          </button>
        </section>
      </div>
    </div>
  );
}
