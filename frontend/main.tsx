import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// @ts-ignore
import './index.css'
// @ts-ignore
import App from './App.tsx'
// @ts-ignore
import Login from './pages/login.tsx'
// @ts-ignore
import Register from './pages/signup.tsx'
// @ts-ignore
import Landing from './pages/landing.tsx'
// @ts-ignore
import ForgotPassword from './pages/forgotpassword.tsx'
// @ts-ignore
import ConfirmEmail from './pages/confirmEmail.tsx'
// @ts-ignore
import ResetPassword from './pages/resetPassword.tsx'
// @ts-ignore
import VerifyEmail from "./pages/verifyEmail.tsx";
// @ts-ignore
import Onboarding from "./pages/onboarding.tsx";
// @ts-ignore
import Dashboard from "./pages/dashboard.tsx";
// @ts-ignore
import Messages from "./pages/messages.tsx";
// @ts-ignore
import SignOut from './pages/signout.tsx';
// @ts-ignore
import Offers from './pages/offers.tsx';
// @ts-ignore
import Profile from "./pages/profile.tsx";


import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Register />} />
        <Route path="/forgotpassword" element={<ForgotPassword />} />
        <Route path="/confirm-email/:token" element={<ConfirmEmail />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="*" element={<Navigate to="/" />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/offers" element={<Offers />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/profile" element={<Profile />} /> 
        <Route path="/signout" element={<SignOut />} />
      </Routes>
    </Router>
  </StrictMode>,
)
