import { useEffect, useState } from "react";
import {
  Wifi,
  Brain,
  Shield,
  ShoppingCart,
  Coins,
  Link as LinkIcon,
  Zap,
  Database,
  Globe,
  Lock,
  Blocks,
  Network,
  Binary,
  Hash,
  Key,
  Server,
  Cpu,
  HardDrive,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

const features = [
  {
    icon: Wifi,
    title: "IoT Monitoring",
    description: "Real-time data collection from environmental sensors for accurate carbon footprint tracking.",
  },
  {
    icon: Brain,
    title: "AI Forecasting",
    description: "Predictive analytics to forecast carbon emissions and optimize reduction strategies.",
  },
  {
    icon: Shield,
    title: "Blockchain Credits",
    description: "Immutable and transparent carbon credits on a secure blockchain ledger.",
  },
  {
    icon: ShoppingCart,
    title: "Marketplace",
    description: "A decentralized marketplace for buying and selling verified carbon credits.",
  },
];

export function LandingPage({ onNavigate = () => {} }) {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen text-white relative overflow-hidden gradient-mask">
      {/* Floating decorative background */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <div
            key={`cube-${i}`}
            className="absolute w-5 h-5 border border-emerald-400/15 bg-emerald-400/5 rounded-lg backdrop-blur-sm"
            style={{
              left: `${10 + i * 7}%`,
              top: `${18 + (i % 4) * 20}%`,
              transform: `rotate(${scrollY * 0.05 + i * 25}deg) translate3d(${Math.sin(scrollY * 0.005 + i) * 8}px, ${scrollY * (0.01 + i * 0.003)}px, 0)`,
              animation: `float-${i % 3} ${8 + (i % 3)}s infinite ease-in-out`,
              opacity: 0.25 + (i % 3) * 0.12,
            }}
          />
        ))}

        {[...Array(8)].map((_, i) => (
          <div
            key={`node-${i}`}
            className="absolute w-2 h-2 bg-emerald-400 rounded-full shadow-lg shadow-emerald-400/50"
            style={{
              left: `${18 + i * 9}%`,
              top: `${28 + (i % 5) * 12}%`,
              transform: `scale(${1 + Math.sin(scrollY * 0.01 + i) * 0.2}) translate3d(0, ${scrollY * 0.02}px, 0)`,
              animation: `blockchain-pulse ${3 + (i % 2)}s infinite ease-in-out`,
              opacity: 0.5 + (i % 2) * 0.2,
            }}
          />
        ))}

        <svg className="absolute inset-0 w-full h-full opacity-30">
          <defs>
            <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          {[...Array(8)].map((_, i) => (
            <line
              key={`connection-${i}`}
              x1={`${15 + i * 10}%`}
              y1={`${25 + (i % 4) * 20}%`}
              x2={`${35 + i * 8}%`}
              y2={`${45 + (i % 3) * 15}%`}
              stroke="url(#connectionGradient)"
              strokeWidth="1"
              strokeDasharray="4 4"
              style={{ strokeDashoffset: -scrollY * 0.1, animation: `network-connect ${4 + (i % 3)}s infinite linear` }}
            />
          ))}
        </svg>

        <div className="absolute inset-0 overflow-hidden">
          {[Coins, LinkIcon, Zap, Database, Globe, Lock, Blocks, Network].map((Icon, i) => (
            <Icon
              key={`falling-icon-${i}`}
              className="absolute text-emerald-400/35"
              style={{
                left: `${8 + i * 11}%`,
                width: `${18 + (i % 3) * 4}px`,
                height: `${18 + (i % 3) * 4}px`,
                animation: `fall-smooth ${16 + (i % 4) * 3}s infinite linear` ,
                animationDelay: `${i * 2}s`,
              }}
            />
          ))}

          {[Binary, Hash, Key, Server].map((Icon, i) => (
            <Icon
              key={`falling-zigzag-${i}`}
              className="absolute text-blue-400/30"
              style={{
                left: `${12 + i * 18}%`,
                width: `${16 + (i % 2) * 3}px`,
                height: `${16 + (i % 2) * 3}px`,
                animation: `fall-zigzag ${18 + (i % 3) * 2}s infinite linear`,
                animationDelay: `${5 + i * 3}s`,
              }}
            />
          ))}

          {[Cpu, HardDrive, Shield, Wifi].map((Icon, i) => (
            <Icon
              key={`falling-rotate-${i}`}
              className="absolute text-purple-400/25"
              style={{
                left: `${20 + i * 16}%`,
                width: `${14 + (i % 2) * 2}px`,
                height: `${14 + (i % 2) * 2}px`,
                animation: `fall-rotate ${20 + (i % 2) * 4}s infinite linear`,
                animationDelay: `${8 + i * 4}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-[#0d131c]/70 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <span className="text-white text-lg font-semibold">E</span>
            </div>
            <span className="text-xl font-semibold tracking-tight">EcoChain</span>
          </div>

          <nav className="hidden md:flex items-center space-x-7 text-sm font-medium text-gray-200">
            {"Home Marketplace Solutions About Contact".split(" ").map((item) => (
              <a key={item} href="#" className="hover:text-white transition-colors">
                {item}
              </a>
            ))}
          </nav>

          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="md" className="rounded-lg px-4 py-2" onClick={() => onNavigate("login")}>
              Login
            </Button>
            <Button size="md" className="rounded-lg px-5 py-2" onClick={() => onNavigate("signup")}>
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
            EcoChain leverages cutting-edge technologies to streamline carbon credit management, ensuring transparency and efficiency in environmental sustainability.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="rounded-full px-8" onClick={() => onNavigate("dashboard")}>
              Get Started
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-8 border-white/20" onClick={() => onNavigate("marketplace")}>
              Explore Marketplace
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 py-16 lg:py-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-center text-3xl md:text-4xl font-bold text-white mb-12">Key Features</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="rounded-2xl border-white/10 hover:border-emerald-400/30 transition-colors">
                <CardContent className="space-y-4 text-left">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{title}</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">{description}</p>
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
              <a key={item} href="#" className="hover:text-emerald-400 transition-colors">
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
