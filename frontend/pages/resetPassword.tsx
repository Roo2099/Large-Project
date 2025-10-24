import { useState } from "react";
import { useParams, Link } from "react-router-dom";

export default function ResetPassword() {
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setMessage("❌ Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/reset-password/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setMessage("✅ Password reset successful! You can now log in.");
      } else {
        const data = await res.text();
        setMessage(data || "❌ Reset failed. The link may have expired.");
      }
    } catch {
      setMessage("❌ Network error. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#f0f4f9] text-[#213547]">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-96">
        <h1 className="text-2xl font-semibold mb-4 text-center text-[#3f4f83]">
          Reset Password
        </h1>

        <p className="text-sm mb-6 text-center text-gray-600">
          Enter your new password below.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="New Password"
            className="w-full border border-gray-300 p-2 rounded-md mb-4 focus:ring-2 focus:ring-[#3f4f83]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Confirm New Password"
            className="w-full border border-gray-300 p-2 rounded-md mb-4 focus:ring-2 focus:ring-[#3f4f83]"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <button
            type="submit"
            disabled={loading}
            className={`w-full text-white py-2 rounded-md transition ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[#3f4f83] hover:bg-[#535bf2]"
            }`}
          >
            {loading ? "Submitting..." : "Reset Password"}
          </button>
        </form>

        {message && (
          <p
            className={`mt-4 text-center text-sm ${
              message.includes("✅") ? "text-green-600" : "text-red-500"
            }`}
          >
            {message}
          </p>
        )}

        <div className="text-center mt-4">
          <Link
            to="/login"
            className="text-[#3f4f83] hover:text-[#535bf2] text-sm font-medium"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
