import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

export default function ConfirmEmail() {
  const { token } = useParams();
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/verify/${token}`);
        if (res.ok) setMessage("✅ Email verified successfully!");
        else setMessage("❌ Verification failed. Link may be invalid or expired.");
      } catch {
        setMessage("❌ An error occurred during verification.");
      }
    })();
  }, [token]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#f0f4f9] text-[#213547]">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-96 text-center">
        <h1 className="text-2xl font-semibold mb-6 text-[#3f4f83]">Email Verification</h1>
        <p className="text-md mb-4">{message}</p>
        {message.startsWith("✅") && (
          <Link
            to="/login"
            className="px-4 py-2 bg-[#3f4f83] text-white rounded-lg hover:bg-[#535bf2] transition"
          >
            Go to Login
          </Link>
        )}
      </div>
    </div>
  );
}
