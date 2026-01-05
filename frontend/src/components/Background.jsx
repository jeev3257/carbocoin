import { useEffect, useState } from "react";
import {
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
  Shield,
  Wifi,
} from "lucide-react";

export function Background() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      {/* Floating decorative background */}
      <div className="absolute inset-0">
        {[...Array(12)].map((_, i) => (
          <div
            key={`cube-${i}`}
            className="absolute w-5 h-5 border border-emerald-400/15 bg-emerald-400/5 rounded-lg backdrop-blur-sm"
            style={{
              left: `${10 + i * 7}%`,
              top: `${18 + (i % 4) * 20}%`,
              transform: `rotate(${scrollY * 0.05 + i * 25}deg) translate3d(${
                Math.sin(scrollY * 0.005 + i) * 8
              }px, ${scrollY * (0.01 + i * 0.003)}px, 0)`,
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
              transform: `scale(${
                1 + Math.sin(scrollY * 0.01 + i) * 0.2
              }) translate3d(0, ${scrollY * 0.02}px, 0)`,
              animation: `blockchain-pulse ${
                3 + (i % 2)
              }s infinite ease-in-out`,
              opacity: 0.5 + (i % 2) * 0.2,
            }}
          />
        ))}

        <svg className="absolute inset-0 w-full h-full opacity-30">
          <defs>
            <linearGradient
              id="connectionGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
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
              style={{
                strokeDashoffset: -scrollY * 0.1,
                animation: `network-connect ${4 + (i % 3)}s infinite linear`,
              }}
            />
          ))}
        </svg>

        <div className="absolute inset-0 overflow-hidden">
          {[Coins, LinkIcon, Zap, Database, Globe, Lock, Blocks, Network].map(
            (Icon, i) => (
              <Icon
                key={`falling-icon-${i}`}
                className="absolute text-emerald-400/35"
                style={{
                  left: `${8 + i * 11}%`,
                  width: `${18 + (i % 3) * 4}px`,
                  height: `${18 + (i % 3) * 4}px`,
                  animation: `fall-smooth ${16 + (i % 4) * 3}s infinite linear`,
                  animationDelay: `${i * 2}s`,
                }}
              />
            )
          )}

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
    </div>
  );
}
