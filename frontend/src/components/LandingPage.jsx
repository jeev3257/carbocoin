import {
  Wifi,
  Brain,
  Shield,
  ShoppingCart,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

const features = [
  {
    icon: Wifi,
    title: "IoT Monitoring",
    description:
      "Real-time data collection from environmental sensors for accurate carbon footprint tracking.",
  },
  {
    icon: Brain,
    title: "AI Forecasting",
    description:
      "Predictive analytics to forecast carbon emissions and optimize reduction strategies.",
  },
  {
    icon: Shield,
    title: "Blockchain Credits",
    description:
      "Immutable and transparent carbon credits on a secure blockchain ledger.",
  },
  {
    icon: ShoppingCart,
    title: "Marketplace",
    description:
      "A decentralized marketplace for buying and selling verified carbon credits.",
  },
];

export function LandingPage({ onNavigate }) {

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-[#0d131c]/70 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <span className="text-white text-lg font-semibold">E</span>
            </div>
            <span className="text-xl font-semibold tracking-tight">
              EcoChain
            </span>
          </div>

          <nav className="hidden md:flex items-center space-x-7 text-sm font-medium text-gray-200">
            {"Home Marketplace Solutions About Contact"
              .split(" ")
              .map((item) => (
                <a
                  key={item}
                  href="#"
                  className="hover:text-white transition-colors"
                >
                  {item}
                </a>
              ))}
          </nav>

          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="md"
              className="rounded-lg px-4 py-2"
              onClick={() => onNavigate("login")}
            >
              Login
            </Button>
            <Button
              size="md"
              className="rounded-lg px-5 py-2"
              onClick={() => onNavigate("signup")}
            >
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-6 py-20 lg:py-28 text-center">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-white mb-6">
            <span className="block">Automating Carbon Credits</span>
            <span className="block">with IoT, AI, and Blockchain</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-300 max-w-3xl mx-auto mb-10">
            EcoChain leverages cutting-edge technologies to streamline carbon
            credit management, ensuring transparency and efficiency in
            environmental sustainability.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="rounded-full px-8"
              onClick={() => onNavigate("dashboard")}
            >
              Get Started
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full px-8 border-white/20"
              onClick={() => onNavigate("marketplace")}
            >
              Explore Marketplace
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 py-16 lg:py-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-center text-3xl md:text-4xl font-bold text-white mb-12">
            Key Features
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(({ icon: Icon, title, description }) => (
              <Card
                key={title}
                className="rounded-2xl border-white/10 hover:border-emerald-400/30 transition-colors"
              >
                <CardContent className="space-y-4 text-left">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{title}</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-[#0d131c]/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6 text-sm text-gray-300">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg font-semibold">E</span>
            </div>
            <span className="font-semibold text-white">EcoChain</span>
            <span className="text-gray-400">© 2024 All rights reserved.</span>
          </div>
          <div className="flex items-center space-x-6">
            {"About Contact Privacy Policy".split(" ").map((item) => (
              <a
                key={item}
                href="#"
                className="hover:text-emerald-400 transition-colors"
              >
                {item}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
