import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import LogoIcon from "../assets/SkillSwap.svg?react";
import UserIcon from "../assets/user.svg?react";
import LockIcon from "../assets/lock.svg?react";
import MailIcon from "../assets/mail.svg?react";

const Signup = () => {
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (password !== confirmPassword) {
      setMessage("❌ Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          login: email,
          password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("✅ Registration successful! Check your email for a verification link.");
        setTimeout(() => navigate("/login"), 3000);
      } else {
        setMessage(`❌ ${data.error || "Registration failed."}`);
      }
    } catch (error) {
      console.error(error);
      setMessage("❌ Network error. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-slate-200">
      <div className="bg-white text-black rounded-2xl shadow-lg w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center space-x-2 py-4 px-4 text-[#3F4F83]">
          <Link
            to="/"
            className="flex items-center space-x-2 text-[#3F4F83] hover:opacity-90 transition-all duration-200"
          >
            <LogoIcon className="w-8 h-8 text-current scale-150" />
            <h3 className="text-2xl text-current px-3">SkillSwap</h3>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-slate-100 text-black p-4 rounded-b-lg-2xl w-full max-w-md">
          <div className="bg-white text-black p-6 rounded-2xl w-full max-w-md">
            <h3 className="text-3xl mb-4 text-black">Sign Up</h3>

            <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
              {/* First Name */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="First Name"
                  className="w-full border border-gray-400 rounded-md px-10 py-2 text-gray-700 focus:border-black focus:outline-none"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
                <UserIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              </div>

              {/* Last Name */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Last Name"
                  className="w-full border border-gray-400 rounded-md px-10 py-2 text-gray-700 focus:border-black focus:outline-none"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
                <UserIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              </div>

              {/* Email */}
              <div className="relative">
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full border border-gray-400 rounded-md px-10 py-2 text-gray-700 focus:border-black focus:outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <MailIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              </div>

              {/* Password */}
              <div className="relative">
                <input
                  type="password"
                  placeholder="Password"
                  className="w-full border border-gray-400 rounded-md px-10 py-2 text-gray-700 focus:border-black focus:outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <LockIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              </div>

              {/* Confirm Password */}
              <div className="relative">
                <input
                  type="password"
                  placeholder="Confirm Password"
                  className="w-full border border-gray-400 rounded-md px-10 py-2 text-gray-700 focus:border-black focus:outline-none"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <LockIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full text-white py-3 rounded-md font-semibold transition ${
                  loading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-[#3F4F83] hover:bg-[#535bf2]"
                }`}
              >
                {loading ? "Creating Account..." : "Sign Up"}
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

            <p className="mt-4 text-center text-gray-400">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-[#3F4F83] hover:underline font-semibold"
              >
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
