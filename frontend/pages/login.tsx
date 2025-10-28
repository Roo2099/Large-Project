import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import LogoIcon from "../assets/SkillSwap.svg?react";
import UserIcon from "../assets/user.svg?react";
import LockIcon from "../assets/lock.svg?react";

const Login = () => {
  const navigate = useNavigate();
  const [authing, setAuthing] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    console.log("🔹 handleLogin triggered");
    setAuthing(true);
    setError("");

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: username,
          password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Save JWT token
        localStorage.setItem("token", data.token);
        localStorage.setItem("firstName", data.firstName);
        localStorage.setItem("lastName", data.lastName);
        localStorage.setItem("userId", data.id);
        localStorage.setItem("login", username);

        navigate("/dashboard"); // redirect after login
      } else if (res.status === 400) {
        setError("Invalid Email or Password.");
      } else if (res.status === 403) {
        setError("Please verify your email before logging in.");
      } else {
        setError(data.error || "Login failed. Please try again later.");
      }
    } catch (err) {
      console.error(" Login error:", err);
      setError("Network error. Please try again.");
    } finally {
      setAuthing(false);
    }
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-slate-200">
      <div className="bg-white text-black rounded-2xl shadow-lg w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center space-x-2 py-4 px-4 text-[#3F4F83]">
          <LogoIcon className="w-8 h-8 text-current scale-150" />
          <h3 className="text-2xl text-current px-3">SkillSwap</h3>
        </div>

        {/* Outer card */}
        <div className="bg-slate-100 text-black p-4 rounded-b-lg-2xl w-full max-w-md">
          <div className="bg-white text-black p-6 rounded-2xl w-full max-w-md">
            <div className="mb-8 text-left">
              <h3 className="text-3xl mb-2 text-black">Sign In</h3>
            </div>

            {/* Input fields */}
            <div className="flex flex-col space-y-4">
              {/* Username */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Email"
                  className="w-full border border-gray-400 rounded-md px-10 py-2 text-gray-700 focus:border-black focus:outline-none"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <UserIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              </div>

              {/* Password */}
              <div className="relative">
                <input
                  type="password"
                  placeholder="Password"
                  className="w-full border border-gray-400 rounded-md px-10 py-2 text-gray-700 focus:border-black focus:outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <LockIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              </div>
            </div>

            {/* Error */}
            {error && <div className="text-red-500 mt-4 text-center">{error}</div>}

            {/* Login Button */}
            <button
              disabled={authing}
              onClick={handleLogin}
              className="w-full bg-[#3b5aa7] text-white mt-2 py-3 rounded-md font-semibold hover:opacity-95 transition disabled:opacity-50"
            >
              {authing ? "Signing in..." : "Sign In"}
            </button>

            {/* Forgot Password */}
            <p className="mt-4 text-left text-gray-400">
              <Link
                to="/forgotpassword"
                className="text-[#3b5aa7] hover:underline font-semibold"
              >
                Forgot Password?
              </Link>
            </p>

            {/* Sign Up */}
            <p className="mt-4 text-left text-gray-400">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="text-[#3b5aa7] hover:underline font-semibold"
              >
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
