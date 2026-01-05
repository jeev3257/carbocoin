import { useState } from "react";
import { LandingPage } from "./components/LandingPage";
import { LoginPage } from "./components/LoginPage";
import { SignupPage } from "./components/SignupPage";
import { Dashboard } from "./components/Dashboard";
import { ApplicationStatus } from "./components/ApplicationStatus";
import { AdminPanel } from "./components/AdminPanel";
import { Background } from "./components/Background";

function App() {
  const [page, setPage] = useState("home");
  const [userData, setUserData] = useState(null);

  const onNavigate = (targetPage, data = null) => {
    setPage(targetPage);
    if (data) {
      setUserData(data);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-white">
      <Background />
      {page === "home" && <LandingPage onNavigate={onNavigate} />}
      {page === "login" && <LoginPage onNavigate={onNavigate} />}
      {page === "signup" && <SignupPage onNavigate={onNavigate} />}
      {page === "dashboard" && <Dashboard onNavigate={onNavigate} userData={userData} />}
      {page === "application-status" && <ApplicationStatus onNavigate={onNavigate} userData={userData} />}
      {page === "admin" && <AdminPanel onNavigate={onNavigate} />}
    </div>
  );
}

export default App;
