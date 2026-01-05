import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Building2, LogOut, Users, TrendingUp, Leaf, BarChart3 } from "lucide-react";

export function Dashboard({ onNavigate, userData }) {
  const companyName = userData?.companyData?.companyName || "Company";

  const handleLogout = () => {
    if (confirm("Are you sure you want to log out?")) {
      onNavigate("home");
    }
  };

  return (
    <div className="min-h-screen relative z-10">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0d131c]/70 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <span className="text-white text-lg font-bold">E</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">EcoChain</h2>
              <p className="text-xs text-gray-400">{companyName}</p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="flex items-center gap-2">
            <LogOut className="w-4 h-4" /> Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-gray-400">Welcome back! Manage your carbon credits and emissions.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { icon: Leaf, label: "Carbon Credits", value: "1,234", color: "emerald" },
            { icon: TrendingUp, label: "Emission Cap", value: userData?.companyData?.emissionCap || "5,000 tons", color: "blue" },
            { icon: BarChart3, label: "Current Emissions", value: "3,200 tons", color: "purple" },
            { icon: Users, label: "IoT Sensors", value: userData?.companyData?.emissionPoints || "8", color: "orange" },
          ].map((stat, i) => (
            <Card key={i} className="border-white/10 bg-[#0d131c]/60">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <stat.icon className={`w-8 h-8 text-${stat.color}-400`} />
                </div>
                <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
                <p className="text-sm text-gray-400">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Placeholder Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-white/10 bg-[#0d131c]/60">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {[
                  "IoT sensor data updated - 2 hours ago",
                  "Carbon credits purchased - Yesterday",
                  "Emission report generated - 2 days ago",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                    <p className="text-sm text-gray-300">{item}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#0d131c]/60">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Company Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className="text-emerald-400 font-semibold">✓ Approved</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Industry:</span>
                  <span className="text-white">{userData?.companyData?.industrySector || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Registration:</span>
                  <span className="text-white">{userData?.companyData?.cin || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Location:</span>
                  <span className="text-white">{userData?.companyData?.state || "N/A"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm">
            🚧 Dashboard is under development. More features coming soon!
          </p>
        </div>
      </div>
    </div>
  );
}
