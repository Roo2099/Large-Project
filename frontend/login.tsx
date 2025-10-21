import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from "react-router-dom";
import LogoIcon from "../assets/SkillSwap.svg?react";
import UserIcon from "../assets/user.svg?react"
import LockIcon from "../assets/lock.svg?react"



const Login = () => {
    // Initialize Firebase authentication and navigation
    const navigate = useNavigate();
    
    // State variables for managing authentication state, email, password, and error messages
    const [authing, setAuthing] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

     return (
        <div className="w-screen h-screen flex items-center justify-center bg-slate-200">
            <div className="bg-white text-black rounded-2xl shadow-lg w-full max-w-md overflow-hidden">
                {/* Top colored header with title */}
                <div className="flex items-center space-x-2 py-4 px-4 text-[#3F4F83]">
                    <LogoIcon className="w-8 h-8 text-current scale-150" />
                    <h3 className="text-2xl text-current px-3">SkillSwap</h3>
                </div>
                    {/*Outer card */}
                    <div className="bg-slate-100 text-black p-4 rounded-b-lg-2xl w-full max-w-md ">
                        {/* Inner card */}
                        <div className="bg-white text-black p-6 rounded-2xl w-full max-w-md ">
                            {/* Header */}
                            <div className="mb-8 text-left">
                                <h3 className="text-3xl mb-2 text-black">Sign In</h3>
                            </div>

                            {/* Input fields */}
                                <div className="flex flex-col space-y-4">
                                {/* Username field */}
                                <div className="relative">
                                    <input
                                    type="text"
                                    placeholder="Username"
                                    className="w-full border border-gray-400 rounded-md px-10 py-2 text-gray-700 focus:border-black focus:outline-none"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    />
                                    {/* Icon inside input */}
                                    <UserIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                                </div>

                                {/* Password field */}
                                <div className="relative">
                                    <input
                                    type="password"
                                    placeholder="Password"
                                    className="w-full border border-gray-400 rounded-md px-10 py-2 text-gray-700 focus:border-black focus:outline-none"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    />
                                    {/* Icon inside input */}
                                    <LockIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                                </div>
                            </div>

                            {/* Error message */}
                            {error && <div className="text-red-500 mt-4 text-center">{error}</div>}

                            {/* Button */}
                            <button
                                disabled={authing}
                                className="w-full bg-white text-white mt-2 py-3 rounded-md font-semibold hover:bg-gray-200 transition"
                            >
                                Sign In
                            </button>

                            {/*Forgot Password*/}
                            <p className="mt-4 text-left text-gray-400">
                            <Link
                                to="/Signup"
                                className="text-white hover:underline font-semibold"
                            >
                                Forgot Password?
                            </Link>
                            </p>

                            {/*Sign up*/}
                            <p className="mt-4 text-left text-gray-400">
                            Don't have an account?{" "}
                            <Link
                                to="/Signup"
                                className="text-white hover:underline font-semibold"
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

