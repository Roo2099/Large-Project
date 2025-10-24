import { useState } from "react";
import { Link } from "react-router-dom";

export default function ForgotPassword() {
  const [login, setLogin] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/request-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login }),
      });
      const data = await res.json();
      setMessage(
        res.ok
          ? "📧 If that account exists, a reset link has been sent to your email."
          : data.error || "❌ Error sending reset link."
      );
    } catch {
      setMessage("❌ Network error. Try again later.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#f0f4f9] text-[#213547]">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-96">
        <h1 className="text-2xl font-semibold mb-4 text-center text-[#3f4f83]">
          Forgot Password
        </h1>

        <p className="text-sm mb-6 text-center text-gray-600">
          Enter your account email. If it exists, you’ll get a reset link.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            className="w-full border border-gray-300 p-2 rounded-md mb-4 focus:ring-2 focus:ring-[#3f4f83]"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            required
          />
          <button
            type="submit"
            className="w-full bg-[#3f4f83] text-white py-2 rounded-md hover:bg-[#535bf2] transition"
          >
            Send Reset Link
          </button>
        </form>

        {message && (
          <p className="mt-4 text-center text-sm">{message}</p>
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
