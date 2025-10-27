import React, { useEffect } from "react";

export default function SignOut() {
  useEffect(() => {
    // Clear any saved auth data
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("firstName");
    localStorage.removeItem("lastName");
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#f0f4f9] text-[#213547]">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-96 text-center">
        <h1 className="text-3xl font-extrabold text-[#3f4f83] mb-3">
          Signed Out
        </h1>
        <p className="text-gray-600 mb-6">
          You’ve successfully signed out of{" "}
          <span className="font-semibold">SkillSwap</span>.
        </p>

        <a
          href="/login"
          className="inline-block w-full py-2 rounded-md font-medium transition bg-[#3f4f83] hover:bg-[#535bf2] text-white !text-white"
          style={{ color: "white" }}
        >
          Go Back to Login
        </a>
      </div>
    </div>
  );
}
