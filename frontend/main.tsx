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

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/confirm-email/:token" element={<ConfirmEmail />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  </StrictMode>,
)
