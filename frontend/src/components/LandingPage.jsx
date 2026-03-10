import {
  Wifi,
  Brain,
  Shield,
  ShoppingCart,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import GradientBlinds from "./GradientBlinds";
import BlurText from "./BlurText";
import { motion } from 'motion/react';

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
    <div className="min-h-screen text-white relative overflow-hidden bg-[#0d131c]">
      <div className="absolute inset-0 z-0 opacity-80 pointer-events-none">
        <GradientBlinds
          gradientColors={['#047857', '#0d131c', '#10b981', '#064e3b']}
          angle={45}
          noise={0.4}
          blindCount={20}
          blindMinWidth={40}
          spotlightRadius={0.3}
          spotlightOpacity={0.8}
          distortAmount={0.3}
          mixBlendMode="color-dodge"
        />
      </div>
      {/* Header */}
      <header className="relative z-10 border-b border-white/10 bg-white/5 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-white text-lg font-semibold bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">E</span>
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
              className="rounded-lg px-4 py-2 hover:bg-white/10"
              onClick={() => onNavigate("login")}
            >
              Login
            </Button>
            <Button
              size="md"
              className="rounded-lg px-5 py-2 bg-emerald-500/80 hover:bg-emerald-500 backdrop-blur-sm border border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
              onClick={() => onNavigate("signup")}
            >
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-6 py-20 lg:py-28 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-5xl mx-auto"
        >
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-white mb-6 flex flex-col items-center justify-center">
            <BlurText
              text="Automating Carbon Credits"
              delay={50}
              animateBy="words"
              direction="top"
              className="mb-2 justify-center"
            />
            <BlurText
              text="with IoT, AI, and Blockchain"
              delay={50}
              animateBy="words"
              direction="bottom"
              className="justify-center text-white/90 drop-shadow-md"
            />
          </h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-lg sm:text-xl text-gray-200 max-w-3xl mx-auto mb-10 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 shadow-xl leading-relaxed"
          >
            EcoChain leverages cutting-edge technologies to streamline carbon
            credit management, ensuring transparency and efficiency in
            environmental sustainability.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button
              size="lg"
              className="rounded-full px-8 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.6)] border-none transition-all hover:scale-105"
              onClick={() => onNavigate("dashboard")}
            >
              Get Started
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full px-8 bg-white/5 backdrop-blur-md border border-white/20 hover:bg-white/10 text-white transition-all hover:scale-105"
              onClick={() => onNavigate("marketplace")}
            >
              Explore Marketplace
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 py-16 lg:py-20">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center text-3xl md:text-4xl font-bold text-white mb-12"
          >
            Key Features
          </motion.h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(({ icon: Icon, title, description }, index) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <Card className="h-full rounded-2xl bg-white/5 backdrop-blur-lg border border-white/10 hover:border-emerald-400/50 hover:bg-white/10 transition-all duration-300 shadow-xl">
                  <CardContent className="space-y-4 text-left pt-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400/20 to-emerald-600/20 backdrop-blur-md border border-emerald-400/20 text-emerald-400 flex items-center justify-center shadow-inner">
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-white drop-shadow-sm">{title}</h3>
                    <p className="text-sm text-gray-300 leading-relaxed font-light">
                      {description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-white/5 backdrop-blur-md mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6 text-sm text-gray-300">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 flex items-center justify-center">
              <span className="text-emerald-400 text-xl font-bold">E</span>
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
