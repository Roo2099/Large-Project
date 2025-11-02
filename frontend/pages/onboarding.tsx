import { useState, useEffect } from "react";
import LogoIcon from "../assets/SkillSwap.svg?react";

const API_URL = "https://poosd24.live/api";

const Onboarding = () => {
  const [allSkills, setAllSkills] = useState<string[]>([]);
  const [offerSkills, setOfferSkills] = useState<string[]>([]);
  const [needSkills, setNeedSkills] = useState<string[]>([]);
  const [selectedSkill, setSelectedSkill] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeType, setActiveType] = useState<"offer" | "need">("offer");
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);

  const token = localStorage.getItem("token");

  // ===== Fetch global skill list =====
  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const res = await fetch(`${API_URL}/browseskills`);
        const data = await res.json();

        if (res.ok && Array.isArray(data.skills)) {
          setAllSkills(data.skills.map((s: { SkillName: string }) => s.SkillName));
        } else {
          setMessage("Failed to load skills.");
        }
      } catch (err) {
        console.error(err);
        setMessage("Network error loading available skills.");
      }
    };
    fetchSkills();
  }, []);

  // ===== Fetch user's skills =====
  useEffect(() => {
    const fetchMySkills = async () => {
      try {
        const res = await fetch(`${API_URL}/myskills`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (res.ok && Array.isArray(data.mySkills)) {
          const offer = data.mySkills
            .filter((s: any) => s.Type === "offer")
            .map((s: any) => s.SkillName);
          const need = data.mySkills
            .filter((s: any) => s.Type === "need")
            .map((s: any) => s.SkillName);
          setOfferSkills(offer);
          setNeedSkills(need);
        } else {
          setMessage("Error loading your skills.");
        }
      } catch {
        setMessage("Network error loading your skills.");
      }
    };
    if (token) fetchMySkills();
  }, [token]);

  // ===== Add a skill =====
  const addSkill = async (skill: string) => {
    if (!skill || !token) return;

    try {
      const res = await fetch(`${API_URL}/addskill`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ SkillName: skill.trim(), Type: activeType }),
      });

      const data = await res.json();

      if (res.ok) {
        if (activeType === "offer") {
          if (!offerSkills.includes(skill)) setOfferSkills([...offerSkills, skill]);
        } else {
          if (!needSkills.includes(skill)) setNeedSkills([...needSkills, skill]);
        }
        setMessage(`✅ Added ${skill} as ${activeType}`);
      } else {
        setMessage(data.error || data.message || "Failed to add skill.");
      }
    } catch {
      setMessage("Network error adding skill.");
    } finally {
      setShowModal(false);
    }
  };

  // ===== Remove a skill =====
  const removeSkill = async (skill: string, type: "offer" | "need") => {
    try {
      const res = await fetch(`${API_URL}/deleteskill/${encodeURIComponent(skill)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        if (type === "offer") {
          setOfferSkills(offerSkills.filter((s) => s !== skill));
        } else {
          setNeedSkills(needSkills.filter((s) => s !== skill));
        }
        setMessage(`❌ Removed ${skill} from ${type}`);
      } else {
        setMessage("Error removing skill.");
      }
    } catch {
      setMessage("Network error removing skill.");
    }
  };

  // ===== Proceed to dashboard =====
  const handleNext = () => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token!.split(".")[1] || ""));
        if (payload.userId) localStorage.setItem("userId", payload.userId);
        if (payload.firstName) localStorage.setItem("firstName", payload.firstName);
        if (payload.lastName) localStorage.setItem("lastName", payload.lastName);
      } catch (err) {
        console.error("Failed to decode token", err);
      }
    }
    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen bg-slate-200 flex flex-col items-center p-6">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-4xl p-6">
        {/* Header */}
        <div className="flex items-center space-x-2 mb-4">
          <LogoIcon className="w-10 h-10 text-[#3F4F83]" />
          <h2 className="text-2xl font-bold text-[#3F4F83]">SkillSwap Onboarding</h2>
        </div>

        <p className="text-gray-600 mb-8 text-center">
          Communicate your fit for new opportunities — tell us what you can{" "}
          <span className="font-semibold text-[#3F4F83]">offer</span> and what you want to{" "}
          <span className="font-semibold text-[#3F4F83]">learn</span>.
        </p>

        {/* Offer / Need Panels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Offer Skills */}
          <div className="border border-gray-300 rounded-xl p-4 bg-gray-50">
            <h3 className="font-semibold text-lg mb-1 text-[#3F4F83]">Offer Skills</h3>
            <p className="text-gray-500 text-sm mb-3">
              Add skills you can teach or help others with.
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              {offerSkills.map((skill) => (
                <div
                  key={skill}
                  className="bg-green-100 text-green-700 px-3 py-1 rounded-full flex items-center text-sm"
                >
                  {skill}
                  <button
                    onClick={() => removeSkill(skill, "offer")}
                    className="ml-2 text-xs text-red-600 hover:text-red-800"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setActiveType("offer");
                setShowModal(true);
              }}
              className="bg-[#3F4F83] text-white px-4 py-2 rounded-md hover:opacity-90 text-sm font-semibold"
            >
              + Add Skills
            </button>
          </div>

          {/* Need Skills */}
          <div className="border border-gray-300 rounded-xl p-4 bg-gray-50">
            <h3 className="font-semibold text-lg mb-1 text-[#3F4F83]">Need Skills</h3>
            <p className="text-gray-500 text-sm mb-3">
              Add skills you want to learn or improve.
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              {needSkills.map((skill) => (
                <div
                  key={skill}
                  className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full flex items-center text-sm"
                >
                  {skill}
                  <button
                    onClick={() => removeSkill(skill, "need")}
                    className="ml-2 text-xs text-red-600 hover:text-red-800"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setActiveType("need");
                setShowModal(true);
              }}
              className="bg-[#3F4F83] text-white px-4 py-2 rounded-md hover:opacity-90 text-sm font-semibold"
            >
              + Add Skills
            </button>
          </div>
        </div>

        {/* Message display */}
        {message && (
          <p
            className={`mt-4 text-center text-sm ${
              message.includes("Added")
                ? "text-green-600"
                : message.includes("Removed")
                ? "text-red-600"
                : "text-gray-600"
            }`}
          >
            {message}
          </p>
        )}

        {/* Next Button */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={handleNext}
            className="bg-[#3F4F83] text-white font-semibold px-6 py-3 rounded-md hover:bg-[#2f3f73] transition-all duration-200 shadow-sm"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Modal for adding skills */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-3 right-4 text-gray-400 hover:text-gray-700 text-xl"
            >
              ✕
            </button>

            <h3 className="text-xl font-semibold text-[#3F4F83] mb-3">
              Add {activeType === "offer" ? "Offer" : "Need"} Skill
            </h3>

            <input
              type="text"
              placeholder="Search skills..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 mb-3 text-sm text-black bg-white focus:outline-none focus:border-[#3F4F83]"
             value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}

            />

          <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
              {[...new Set(allSkills)]
                .filter((skill) =>
                  searchTerm ? skill.toLowerCase().includes(searchTerm) : true
                )
                .sort((a, b) => a.localeCompare(b))
                .map((skill) => {
                  const alreadyAdded =
                    offerSkills.includes(skill) || needSkills.includes(skill);
                  const isSelected = selectedSkill === skill;

                  return (
                    <button
                      key={skill}
                      disabled={alreadyAdded}
                      onClick={() => {
                        if (!alreadyAdded) {
                          setSelectedSkill(skill); // purely for highlighting
                          setSearchTerm(""); // clear the input box after click
                          addSkill(skill);
                        }
                      }}
                      className={`rounded-md px-2 py-2 text-sm font-medium border transition-all duration-150 ${
                        alreadyAdded
                          ? "!bg-gray-200 !text-gray-800 cursor-not-allowed"
                          : isSelected
                          ? "!bg-[#3F4F83] !text-white !border-[#3F4F83]"
                          : "!bg-white !text-[#3F4F83] !border-[#3F4F83] hover:!bg-[#3F4F83]/10"
                      }`}
                    >
                      {skill}
                    </button>
                  );
                })}
            </div>



          </div>
        </div>
      )}
    </div>
  );
};

export default Onboarding;
