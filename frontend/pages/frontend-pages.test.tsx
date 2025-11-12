import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BrowserRouter } from "react-router-dom";

// ✅ Import your frontend pages
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import ProfilePage from "../pages/ProfilePage";
import Signup from "../pages/Signup";
import ForgotPassword from "../pages/ForgotPassword";
import ChangePassword from "../pages/ChangePassword";
import Onboarding from "../pages/Onboarding";
import Connections from "../pages/Connections";
import Requests from "../pages/Requests";

// ✅ Mock static assets and icons (no more .svg import errors)
jest.mock("../assets/SkillSwap.svg", () => "");
jest.mock("../assets/search.svg", () => "");
jest.mock("../assets/user.svg", () => "");
jest.mock("../assets/lock.svg", () => "");
jest.mock("../assets/mail.svg", () => "");
jest.mock("../assets/favicon.svg", () => "");

// ✅ Mock constants (so import.meta.env works)
jest.mock("../constants", () => ({
  VITE_API_URL: "https://poosd24.live",
  VITE_API_BASE: "https://poosd24.live/api",
}));

// ✅ Helper function for rendering React Router components
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

// ✅ Begin page suite
describe("SkillSwap Frontend Pages", () => {
  test("renders Login page", () => {
    renderWithRouter(<Login />);
    expect(screen.getByText(/Sign In/i)).toBeInTheDocument();
  });

  test("renders Dashboard page", () => {
    renderWithRouter(<Dashboard />);
    expect(screen.getByText(/SkillSwap/i)).toBeInTheDocument();
  });

  test("renders Profile page", () => {
    renderWithRouter(<ProfilePage />);
    expect(screen.getByText(/Profile/i)).toBeInTheDocument();
  });

  test("renders Signup page", () => {
    renderWithRouter(<Signup />);
    expect(screen.getByText(/Sign Up/i)).toBeInTheDocument();
  });

  test("renders Forgot Password page", () => {
    renderWithRouter(<ForgotPassword />);
    expect(screen.getByText(/Forgot Password/i)).toBeInTheDocument();
  });

  test("renders Change Password page", () => {
    renderWithRouter(<ChangePassword />);
    expect(screen.getByText(/Change Password/i)).toBeInTheDocument();
  });

  test("renders Onboarding page", () => {
    renderWithRouter(<Onboarding />);
    expect(screen.getByText(/Next/i)).toBeInTheDocument();
  });

  test("renders Connections page", () => {
    renderWithRouter(<Connections />);
    expect(screen.getByText(/Connections/i)).toBeInTheDocument();
  });

  test("renders Requests page", () => {
    renderWithRouter(<Requests />);
    expect(screen.getByText(/Requests/i)).toBeInTheDocument();
  });
});
