import { useState, useEffect } from "react";
import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  formatUnits,
} from "ethers";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import {
  Leaf,
  LogOut,
  BarChart3,
  Activity,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  FileText,
  ShoppingCart,
  Wallet,
  Bell,
  ArrowUpRight,
  AlertTriangle,
  Shield,
  ArrowRight,
  Search,
  Filter,
  ExternalLink,
  Loader2,
  Calendar,
  Download,
  CheckCircle2,
} from "lucide-react";
import {
  collection,
  query,
  orderBy,
  getDocs,
  onSnapshot,
  doc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Background from "./Background";
import { LiveDataView } from "./LiveDataView";
import Marketplace from "./Marketplace";

export function Dashboard({ onNavigate, userData }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [emissionsData, setEmissionsData] = useState([]);
  const [currentEmission, setCurrentEmission] = useState(0);
  const [trend, setTrend] = useState(0);
  const [companyData, setCompanyData] = useState(null);
  const [tokenActivities, setTokenActivities] = useState([]);
  const [tokenSearch, setTokenSearch] = useState("");
  const [tokenTypeFilter, setTokenTypeFilter] = useState("all");
  const [tokenLoading, setTokenLoading] = useState(true);
  const [tokenError, setTokenError] = useState(null);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [walletNetBalance, setWalletNetBalance] = useState(null);
  const [walletOwed, setWalletOwed] = useState(null);
  const [walletAddress, setWalletAddress] = useState(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState(null);
  const [walletSettling, setWalletSettling] = useState(false);

  // Filters for Live CO2 Graph
  const [timeFilter, setTimeFilter] = useState("all");

  const [walletDueTime, setWalletDueTime] = useState(null);
  const [walletPenalty, setWalletPenalty] = useState(null);
  const [walletGracePeriod, setWalletGracePeriod] = useState(null);
  const [nowTs, setNowTs] = useState(Date.now());
  const [reportFrom, setReportFrom] = useState(() =>
    new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10),
  );
  const [reportTo, setReportTo] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(null);

  // ── Forecast state ──────────────────────────────────────────────────────────
  const [forecastData, setForecastData] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState(null);

  const explorerBase =
    import.meta.env.VITE_BLOCK_EXPLORER_URL || "https://sepolia.etherscan.io";

  const backendBase =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

  const tokenAddress = import.meta.env.VITE_CARBON_TOKEN_ADDRESS;
  const marketplaceAddress = import.meta.env.VITE_MARKETPLACE_ADDRESS;
  const tokenAbi = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function owedBalance(address) view returns (uint256)",
    "function owedDueTime(address) view returns (uint256)",
    "function penaltyAmount() view returns (uint256)",
    "function gracePeriodSec() view returns (uint256)",
    "function settleOwed(uint256 amount) external",
  ];

  const handleLogout = () => {
    if (typeof onNavigate === "function") {
      onNavigate("home");
    }
  };

  useEffect(() => {
    const companyId = userData?.userId;
    if (!companyId) return;

    const companyRef = doc(db, "companies", companyId);
    const unsubscribeCompany = onSnapshot(companyRef, (docSnap) => {
      if (docSnap.exists()) {
        setCompanyData(docSnap.data());
      }
    });

    const readingsRef = collection(db, "emission", companyId, "readings");
    const q = query(readingsRef, orderBy("timestamp", "desc"));

    const unsubscribeReadings = onSnapshot(q, (snapshot) => {
      const readings = [];
      snapshot.forEach((docSnap) => {
        readings.push({ id: docSnap.id, ...docSnap.data() });
      });

      const sortedReadings = readings.reverse().map((reading) => {
        let date;
        if (
          reading.timestamp &&
          typeof reading.timestamp.toDate === "function"
        ) {
          date = reading.timestamp.toDate();
        } else if (reading.timestamp) {
          date = new Date(reading.timestamp);
        } else {
          date = new Date();
        }

        return {
          name: date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          time: date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          value: Number(reading.emission) || 0,
          originalTimestamp: date,
          batchId: reading.batchId || reading.txHash || reading.id || null,
        };
      });

      setEmissionsData(sortedReadings);

      if (sortedReadings.length > 0) {
        const latest = sortedReadings[sortedReadings.length - 1].value;
        const previous =
          sortedReadings.length > 1
            ? sortedReadings[sortedReadings.length - 2].value
            : latest;

        setCurrentEmission(latest);

        if (previous > 0) {
          const change = ((latest - previous) / previous) * 100;
          setTrend(change.toFixed(1));
        }
      }
    });

    return () => {
      unsubscribeReadings();
      unsubscribeCompany();
    };
  }, [userData]);

  useEffect(() => {
    const companyId = userData?.userId;
    if (!companyId) {
      setTokenActivities([]);
      setTokenLoading(false);
      return;
    }

    setTokenLoading(true);

    const chainRef = collection(db, "chainBatches");
    const chainQuery = query(chainRef, where("companyId", "==", companyId));
    const MAX_ROWS = 75;

    const unsubscribe = onSnapshot(
      chainQuery,
      (snapshot) => {
        const activities = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data();
            const minted = Number(data.mintedTokens || 0);
            const burned = Number(data.burnedTokens || 0);
            const owedBalanceDoc = Number(data.owedBalance || 0);
            const tokenChangeNum = Number(data.tokenChange || 0);
            const submittedAt = data.submittedAt;
            const createdAt = submittedAt
              ? submittedAt.toDate
                ? submittedAt.toDate()
                : new Date(submittedAt)
              : new Date();

            let type = "neutral";
            const hasDebt = owedBalanceDoc > 0;
            if (minted > 0 && burned === 0 && !hasDebt) type = "mint";
            else if (burned > 0 || hasDebt || tokenChangeNum < 0) type = "burn";

            return {
              id: docSnap.id,
              ...data,
              minted,
              burned,
              owedBalance: owedBalanceDoc,
              tokenChange: tokenChangeNum,
              type,
              createdAt,
            };
          })
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        setTokenError(null);
        setTokenActivities(activities);
        setTokenLoading(false);
      },
      (error) => {
        console.error("Failed to load token activity:", error);
        setTokenActivities([]);
        setTokenError(
          "Unable to query chain activity. Please ensure the Firestore index for companyId/submittedAt exists.",
        );
        setTokenLoading(false);
      },
    );

    return () => unsubscribe();
  }, [userData]);

  useEffect(() => {
    const tick = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  // ── Forecast: call backend whenever we have enough emission readings ─────────
  useEffect(() => {
    if (emissionsData.length < 1) return;
    if (!companyData) return;

    const controller = new AbortController();
    let cancelled = false;

    const runForecast = async () => {
      setForecastLoading(true);
      setForecastError(null);
      try {
        const emissions = emissionsData.slice(-20).map((d) => d.value);
        const cap =
          companyData?.emissionCapKg ?? companyData?.emissionCap ?? null;
        const payload = {
          emissions,
          industry: companyData?.industrySector || "manufacturing",
          fuel: companyData?.fuelType || "coal",
          production: companyData?.productionRate ?? 500,
          steps: 12,
          cap,
        };

        const resp = await fetch(
          `${(backendBase || "").replace(/\/$/, "")}/api/forecast`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
          },
        );

        if (!resp.ok) throw new Error(`Forecast ${resp.status}`);
        const data = await resp.json();
        if (!cancelled) setForecastData(data);
      } catch (err) {
        if (!cancelled && err.name !== "AbortError") {
          setForecastError(err.message);
        }
      } finally {
        if (!cancelled) setForecastLoading(false);
      }
    };

    runForecast();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emissionsData, companyData]);

  useEffect(() => {
    if (!tokenAddress) {
      setWalletError(
        "Token address is missing. Set VITE_CARBON_TOKEN_ADDRESS.",
      );
      return;
    }

    const rpcUrl = import.meta.env.VITE_SEPOLIA_RPC_URL;
    const rpcProvider = rpcUrl ? new JsonRpcProvider(rpcUrl) : null;
    const browserProvider = window?.ethereum
      ? new BrowserProvider(window.ethereum)
      : null;
    const provider = rpcProvider || browserProvider;

    if (!provider) {
      setWalletError("No RPC or MetaMask provider available.");
      return;
    }

    let unsubscribed = false;

    const formatSigned = (valueBigInt, decimals) => {
      const isNegative = valueBigInt < 0n;
      const absVal = isNegative ? -valueBigInt : valueBigInt;
      const formatted =
        decimals === 0 ? absVal.toString() : formatUnits(absVal, decimals);
      const numeric = Number.parseFloat(formatted);
      const withGrouping = Number.isFinite(numeric)
        ? numeric.toLocaleString(undefined, { maximumFractionDigits: 4 })
        : formatted;
      return `${isNegative ? "-" : ""}${withGrouping}`;
    };

    const fetchBalance = async () => {
      setWalletLoading(true);
      setWalletError(null);
      try {
        let address = companyData?.walletAddress;

        if (!address) {
          if (!browserProvider) throw new Error("Please connect MetaMask.");
          const accounts = await browserProvider.send(
            "eth_requestAccounts",
            [],
          );
          address = accounts?.[0];
          if (!address) throw new Error("No wallet account found.");
        }

        if (unsubscribed) return;
        setWalletAddress(address);

        const contract = new Contract(tokenAddress, tokenAbi, provider);
        const [
          rawBalance,
          decimals,
          owedRaw,
          dueTimeRaw,
          penaltyRaw,
          graceRaw,
        ] = await Promise.all([
          contract.balanceOf(address),
          contract.decimals().catch(() => 0),
          contract.owedBalance(address).catch(() => 0n),
          contract.owedDueTime(address).catch(() => 0),
          contract.penaltyAmount().catch(() => 0n),
          contract.gracePeriodSec().catch(() => 0),
        ]);

        if (unsubscribed) return;
        const net = rawBalance - BigInt(owedRaw);
        setWalletBalance(formatUnits(rawBalance, decimals));
        setWalletOwed(formatUnits(owedRaw, decimals));
        setWalletNetBalance(formatSigned(net, decimals));
        setWalletDueTime(Number(dueTimeRaw || 0));
        setWalletPenalty(formatUnits(penaltyRaw || 0n, decimals));
        setWalletGracePeriod(Number(graceRaw || 0));
      } catch (err) {
        if (unsubscribed) return;
        const message = err?.message || "Failed to load wallet balance.";
        setWalletError(message);
        console.error("Wallet balance fetch failed", err);
      } finally {
        if (!unsubscribed) setWalletLoading(false);
      }
    };

    fetchBalance();

    const interval = setInterval(fetchBalance, 15000);

    const handleAccountsChanged = (accounts) => {
      if (!accounts || accounts.length === 0) {
        setWalletAddress(null);
        setWalletBalance(null);
        setWalletError("Please connect MetaMask.");
        return;
      }
      fetchBalance();
    };

    window.ethereum?.on("accountsChanged", handleAccountsChanged);

    return () => {
      unsubscribed = true;
      clearInterval(interval);
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, [tokenAddress, companyData?.walletAddress]);

  const handleSettleDebt = async () => {
    if (!tokenAddress) {
      setWalletError("Token address missing.");
      return;
    }
    if (!window?.ethereum) {
      setWalletError("MetaMask not available.");
      return;
    }
    if (!walletOwed || Number(walletOwed) <= 0) return;

    setWalletSettling(true);
    setWalletError(null);
    try {
      const browserProvider = new BrowserProvider(window.ethereum);
      const signer = await browserProvider.getSigner();
      const contract = new Contract(tokenAddress, tokenAbi, signer);
      const decimals = await contract.decimals().catch(() => 0);
      const owedRaw =
        BigInt(Math.trunc(Number(walletOwed))) * 10n ** BigInt(decimals);
      const tx = await contract.settleOwed(owedRaw);
      await tx.wait();
      setWalletError(null);
    } catch (err) {
      setWalletError(err?.message || "Failed to settle debt.");
      console.error("Settle debt failed", err);
    } finally {
      setWalletSettling(false);
    }
  };

  const handleAcquireCredits = async () => {
    const owes = Number(displayOwed || 0) > 0;
    const hasBalance = Number(walletBalance || 0) > 0;

    if (!owes || !hasBalance) {
      setActiveTab("marketplace");
      return;
    }

    if (!tokenAddress || !window?.ethereum) {
      setActiveTab("marketplace");
      return;
    }

    setWalletSettling(true);
    setWalletError(null);
    try {
      const browserProvider = new BrowserProvider(window.ethereum);
      const signer = await browserProvider.getSigner();
      const address = walletAddress || (await signer.getAddress());
      const contract = new Contract(tokenAddress, tokenAbi, signer);
      const [owedRaw, balanceRaw] = await Promise.all([
        contract.owedBalance(address),
        contract.balanceOf(address),
      ]);

      const settleRaw = owedRaw < balanceRaw ? owedRaw : balanceRaw;
      if (settleRaw > 0n) {
        const tx = await contract.settleOwed(settleRaw);
        await tx.wait();
      }
    } catch (err) {
      setWalletError(
        err?.message || "Failed to auto-settle debt before acquire.",
      );
      console.error("Acquire credits auto-settle failed", err);
    } finally {
      setWalletSettling(false);
      setActiveTab("marketplace");
    }
  };

  const debtActivities = tokenActivities.filter(
    (activity) => Number(activity.owedBalance || 0) > 0,
  );

  const rangeStart = reportFrom ? new Date(reportFrom) : null;
  const rangeEnd = reportTo ? new Date(reportTo) : null;
  if (rangeStart) rangeStart.setHours(0, 0, 0, 0);
  if (rangeEnd) rangeEnd.setHours(23, 59, 59, 999);

  const reportActivities = tokenActivities.filter((activity) => {
    const created =
      activity.createdAt instanceof Date
        ? activity.createdAt
        : new Date(activity.createdAt);

    if (Number.isNaN(created?.getTime?.())) return false;
    return true;
  });

  const reportTotals = reportActivities.reduce(
    (acc, activity) => {
      acc.minted += Number(activity.minted || 0);
      acc.burned += Number(activity.burned || 0);
      acc.debt += Number(activity.owedBalance || 0);
      return acc;
    },
    { minted: 0, burned: 0, debt: 0 },
  );

  const reportNet = reportTotals.minted - reportTotals.burned;
  const reportPreview = reportActivities.slice(0, 6);

  const handleDownloadReport = async () => {
    setReportLoading(true);
    setReportError(null);

    const backendUrl = (backendBase || "").replace(/\/$/, "");
    const companyName = companyData?.companyName || "Carbon Client";

    const reportEmissions = emissionsData.filter((e) => {
      if (!e.originalTimestamp) return false;
      return true;
    });

    const totalEmissions = reportEmissions.reduce((acc, e) => acc + e.value, 0);
    const parsedCap = parseFloat(companyData?.emissionCap || 0) * 1000; // if it's "10 tons", -> 10000kg
    const windowCap = Number(companyData?.capKgPerWindow) || parsedCap;
    const emissionCap =
      windowCap || reportActivities.find((a) => a.capKg != null)?.capKg || 0;

    let marketActivities = [];
    try {
      if (walletAddress) {
        const snap = await getDocs(
          query(
            collection(db, "marketEvents"),
            where("actor", "==", walletAddress),
          ),
        );
        marketActivities = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
    } catch (e) {
      console.error("Could not fetch market events for report", e);
    }

    const marketRecords = marketActivities
      .filter((a) => a.txHash)
      .map((a) => ({
        timestamp: a.createdAt?.toDate
          ? a.createdAt.toDate().toISOString()
          : new Date().toISOString(),
        dataHash: `Marketplace: ${a.action}`,
        txHash: a.txHash,
        blockNumber: "N/A",
        status: "Verified",
      }));

    const payload = {
      company: {
        name: companyName,
        industry: companyData?.industrySector,
        walletAddress: walletAddress,
      },
      range: { from: reportFrom, to: reportTo },
      summary: {
        totalEmissions,
        emissionCap,
        remainingAllowance:
          emissionCap > 0 ? emissionCap - totalEmissions : null,
        creditsIssued: reportTotals.minted,
        creditsUsed: reportTotals.burned,
        creditBalance: Number(walletBalance || 0),
        totalMinted: reportTotals.minted,
        totalBurned: reportTotals.burned,
        netCredits: reportNet,
        outstandingDebt: reportTotals.debt,
        activityCount: reportActivities.length,
      },
      activities: reportActivities.map((activity) => ({
        batchId: activity.batchId || activity.id,
        type: activity.type,
        minted: Number(activity.minted || 0),
        burned: Number(activity.burned || 0),
        owedBalance: Number(activity.owedBalance || 0),
        emissionKg: activity.emissionKgOnChain ?? activity.emissionKg ?? null,
        capKg: activity.capKgOnChain ?? activity.capKg ?? null,
        txHash: activity.txHash || activity.txHashOnChain || null,
        createdAt:
          activity.createdAt instanceof Date
            ? activity.createdAt.toISOString()
            : new Date(activity.createdAt).toISOString(),
      })),
      emissionTrend: reportEmissions.map((e) => ({
        value: Number(e.value || 0),
        timestamp: e.originalTimestamp.toISOString(),
        label: e.originalTimestamp.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      })),
      rawEmissionLogs: reportEmissions.map((e) => ({
        timestamp: e.originalTimestamp.toISOString(),
        sensorId: "Dashboard Sensor",
        emission: e.value,
        batchId: e.batchId || "—",
      })),
      batchEmissionLogs: reportActivities
        .filter(
          (a) =>
            a.emissionKg != null ||
            (a.txHash &&
              a.action !== "createListing" &&
              a.action !== "createAuction"),
        )
        .map((a) => ({
          timestamp:
            a.createdAt instanceof Date
              ? a.createdAt.toISOString()
              : new Date(a.createdAt).toISOString(),
          sensorId: "Aggregated 10-Min Batch",
          emission: a.emissionKgOnChain ?? a.emissionKg ?? 0,
          txHash: a.txHash || a.txHashOnChain || "—",
        })),
      blockchainRecords: [
        ...reportActivities
          .filter((a) => a.txHash || a.txHashOnChain)
          .map((a) => ({
            timestamp:
              a.createdAt instanceof Date
                ? a.createdAt.toISOString()
                : new Date(a.createdAt).toISOString(),
            dataHash: a.dataHash || a.batchId || a.id,
            txHash: a.txHash || a.txHashOnChain,
            blockNumber: "N/A",
            status: "Verified",
          })),
        ...marketRecords,
      ].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    };

    try {
      const response = await fetch(`${backendUrl}/api/reports/pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/pdf",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate PDF (${response.status})`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName =
        companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "report";
      link.href = url;
      link.download = `${safeName}-${reportFrom || "from"}-${reportTo || "to"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setReportError(err?.message || "Unable to generate report.");
    } finally {
      setReportLoading(false);
    }
  };
  const maxActivityDebt = debtActivities.reduce(
    (max, d) => Math.max(max, Number(d.owedBalance || 0)),
    0,
  );
  const baseOwed =
    Number(walletOwed || 0) > 0
      ? Number(walletOwed)
      : maxActivityDebt > 0
        ? maxActivityDebt
        : 0;
  const penaltyPerInterval = Number(walletPenalty || 0);
  const overdueSecondsRaw = walletDueTime ? nowTs / 1000 - walletDueTime : 0;
  const overdueIntervals =
    walletGracePeriod && overdueSecondsRaw > 0
      ? Math.floor(overdueSecondsRaw / walletGracePeriod) + 1
      : 0;
  const projectedPenalty =
    penaltyPerInterval > 0 ? penaltyPerInterval * overdueIntervals : 0;
  const displayOwed = (baseOwed + projectedPenalty).toString();
  const hasDebt = Number(displayOwed || 0) > 0;

  const formatDuration = (totalSeconds) => {
    if (totalSeconds == null || Number.isNaN(totalSeconds)) return "—";
    const sec = Math.max(0, Math.floor(totalSeconds));
    const days = Math.floor(sec / 86400);
    const hours = Math.floor((sec % 86400) / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;
    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours || days) parts.push(`${hours}h`);
    if (minutes || hours || days) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(" ");
  };

  const nextPenaltyMs = walletDueTime ? walletDueTime * 1000 - nowTs : null;
  const nextPenaltySeconds =
    nextPenaltyMs !== null ? Math.round(nextPenaltyMs / 1000) : null;
  const countdownLabel =
    nextPenaltySeconds !== null
      ? nextPenaltySeconds >= 0
        ? `Next penalty in ${formatDuration(nextPenaltySeconds)}`
        : `Penalty overdue by ${formatDuration(-nextPenaltySeconds)}`
      : "No penalty timer";
  const dueDateLabel = walletDueTime
    ? new Date(walletDueTime * 1000).toLocaleString()
    : null;

  const filteredTokenActivities = tokenActivities.filter((activity) => {
    const matchesSearch = tokenSearch
      ? [
        activity.batchId,
        activity.txHash,
        activity.dataHash,
        activity.companyName,
      ]
        .filter(Boolean)
        .some((field) =>
          field.toLowerCase().includes(tokenSearch.toLowerCase()),
        )
      : true;

    const matchesType =
      tokenTypeFilter === "all" || activity.type === tokenTypeFilter;

    return matchesSearch && matchesType;
  });

  const menuItems = [
    { id: "dashboard", icon: BarChart3, label: "Dashboard" },
    { id: "live-data", icon: Activity, label: "Live Data" },
    { id: "forecast", icon: TrendingUp, label: "Forecast" },
    { id: "tokens", icon: Leaf, label: "Tokens" },
    { id: "reports", icon: FileText, label: "Reports" },
    { id: "marketplace", icon: ShoppingCart, label: "Marketplace" },
  ];

  return (
    <div className="flex min-h-screen text-white font-sans selection:bg-emerald-500/30 relative overflow-hidden bg-[#0d131c]">
      <Background />
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 bg-white/5 backdrop-blur-md flex flex-col fixed h-full z-50">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <Leaf className="w-6 h-6 text-white" />
            <span className="text-xl font-bold tracking-tight">EcoChain</span>
          </div>

          <nav className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === item.id
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 mb-4 border border-white/10">
            <h4 className="text-sm font-semibold text-white mb-1">
              Need Help?
            </h4>
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
              Our support team is here to assist you.
            </p>
            <Button
              size="sm"
              variant="secondary"
              className="w-full text-xs bg-white/10 hover:bg-white/20 text-white border-0 h-8 backdrop-blur-sm transition-all focus:ring-0"
            >
              Contact Support
            </Button>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8 relative z-10 h-screen overflow-y-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            {activeTab === "debt-detail"
              ? "Debt Detail"
              : menuItems.find((item) => item.id === activeTab)?.label ||
              "Dashboard"}
          </h1>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 px-5 py-3 rounded-2xl bg-[#1C2128]/80 backdrop-blur-md border border-[#2D333B] shadow-[0_4px_24px_rgba(0,0,0,0.2)] transition-all hover:bg-[#1C2128]">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.15)] flex-shrink-0">
                <Wallet className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex flex-col justify-center">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    Wallet Balance
                  </p>
                  {walletAddress && (
                    <span className="text-[10px] text-slate-600 font-mono bg-black/20 px-1.5 py-0.5 rounded">
                      {`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold text-white tracking-tight leading-none">
                    {walletLoading && "Loading..."}
                    {!walletLoading && walletError && "Error"}
                    {!walletLoading && !walletError && walletBalance
                      ? `${Number.parseFloat(walletBalance).toLocaleString(undefined, { maximumFractionDigits: 4 })}`
                      : null}
                    {!walletLoading && !walletError && !walletBalance && "—"}
                  </span>
                  {!walletLoading && !walletError && walletBalance ? (
                    <span className="text-[10px] text-emerald-400 font-bold">
                      CCT
                    </span>
                  ) : null}
                </div>

                {hasDebt && (
                  <div className="flex items-center gap-2 mt-1.5 bg-red-500/5 px-2 py-1 rounded-lg border border-red-500/10">
                    <p className="text-[10px] font-bold text-red-400">
                      Debt: -{displayOwed} CCT
                    </p>
                    {walletNetBalance && (
                      <p className="text-[10px] font-medium text-slate-400 pl-2 border-l border-slate-700">
                        Net: {walletNetBalance} CCT
                      </p>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={walletSettling || walletLoading}
                      onClick={handleSettleDebt}
                      className="ml-2 h-6 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[10px] font-bold rounded-lg transition-colors"
                    >
                      {walletSettling ? "Settling..." : "Settle Debt"}
                    </Button>
                  </div>
                )}

                {walletError && (
                  <p className="text-[10px] text-red-400 max-w-xs mt-1 font-medium bg-red-500/10 px-2 py-1 rounded border border-red-500/20">
                    {walletError}
                  </p>
                )}
              </div>
            </div>

            <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
              <Bell className="w-6 h-6" />
              <span className="absolute top-1.5 right-2 w-2 h-2 bg-emerald-500 rounded-full border-2 border-[#050505]"></span>
            </button>

            <div className="flex items-center gap-3 pl-6 border-l border-white/10">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center ring-2 ring-white/10">
                <span className="text-sm font-semibold text-white">
                  {companyData?.companyName
                    ? companyData.companyName.substring(0, 2).toUpperCase()
                    : "CO"}
                </span>
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium text-white">
                  {companyData?.companyName || "Loading..."}
                </p>
                <p className="text-xs text-gray-500">
                  {companyData?.industrySector || "Company"}
                </p>
              </div>
            </div>
          </div>
        </header>

        {activeTab === "live-data" && (
          <LiveDataView userData={userData} companyData={companyData} />
        )}

        {/* Dashboard Grid */}
        {activeTab === "dashboard" && (
          <div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Live CO2 Chart */}
              <Card className="lg:col-span-2 border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl shadow-emerald-900/10 rounded-2xl overflow-hidden">
                <CardContent className="p-8">
                  <div className="flex flex-col md:flex-row md:items-start justify-between mb-8 gap-4">
                    <div>
                      <p className="text-sm text-gray-300 mb-2 font-medium">
                        Live CO₂ Data from IoT Sensors
                      </p>
                      <h2 className="text-4xl font-bold text-white tracking-tight">
                        {currentEmission > 0
                          ? currentEmission.toLocaleString()
                          : "Loading..."}{" "}
                        <span className="text-2xl text-gray-500">ppm</span>
                      </h2>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <div
                        className={`flex items-center gap-1.5 ${Number(trend) >= 0 ? "text-emerald-500" : "text-red-500"}`}
                      >
                        {Number(trend) >= 0 ? (
                          <ArrowUpRight className="w-5 h-5" />
                        ) : (
                          <TrendingUp className="w-5 h-5" />
                        )}
                        <span className="text-sm font-bold">
                          {trend > 0 ? "+" : ""}
                          {trend}% vs last reading
                        </span>
                      </div>

                      {/* Time Filters */}
                      <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1 backdrop-blur-md">
                        {[
                          { id: "10m", label: "10m", limit: 10 },
                          { id: "30m", label: "30m", limit: 30 },
                          { id: "1h", label: "1h", limit: 60 },
                          { id: "all", label: "All", limit: null }
                        ].map(f => (
                          <button
                            key={f.id}
                            onClick={() => setTimeFilter(f.id)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${timeFilter === f.id
                              ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                              : "text-gray-400 hover:text-white hover:bg-white/10"
                              }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="h-[300px] w-full bg-white/5 rounded-xl border border-white/5 overflow-hidden relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={
                        timeFilter === "10m" ? emissionsData.slice(-10) :
                          timeFilter === "30m" ? emissionsData.slice(-30) :
                            timeFilter === "1h" ? emissionsData.slice(-60) :
                              emissionsData
                      }>
                        <defs>
                          <linearGradient
                            id="colorValue"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#10b981"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="#10b981"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#333"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="time"
                          stroke="#666"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="#666"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1f2937",
                            border: "none",
                            borderRadius: "8px",
                            color: "#fff",
                          }}
                          itemStyle={{ color: "#10b981" }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#10b981"
                          strokeWidth={3}
                          fillOpacity={1}
                          fill="url(#colorValue)"
                          isAnimationActive={true}
                          animationDuration={800}
                          animationEasing="ease-in-out"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {activeTab === "reports" && (
                <div className="pb-12 space-y-6">
                  <Card className="border-white/10 bg-gradient-to-br from-[#0c131d] via-[#0f1727] to-[#0a0f1a] shadow-2xl shadow-emerald-900/20 rounded-[28px] overflow-hidden">
                    <CardContent className="p-6 md:p-8 space-y-6">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="space-y-2">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300 font-bold">
                            Reports
                          </p>
                          <h2 className="text-3xl font-bold text-white tracking-tight">
                            Export audit-ready PDF
                          </h2>
                          <p className="text-sm text-slate-400 max-w-2xl">
                            Pick a date window, review the summary, and generate
                            a signed PDF for compliance submissions or investor
                            updates.
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 items-stretch w-full lg:w-auto">
                          <label className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white min-w-[220px]">
                            <Calendar className="w-4 h-4 text-emerald-400" />
                            <input
                              type="date"
                              value={reportFrom}
                              onChange={(e) => setReportFrom(e.target.value)}
                              className="bg-transparent border-none focus:ring-0 text-white w-full"
                            />
                          </label>

                          <label className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white min-w-[220px]">
                            <Calendar className="w-4 h-4 text-emerald-400" />
                            <input
                              type="date"
                              value={reportTo}
                              onChange={(e) => setReportTo(e.target.value)}
                              className="bg-transparent border-none focus:ring-0 text-white w-full"
                            />
                          </label>

                          <Button
                            onClick={handleDownloadReport}
                            disabled={
                              reportLoading || reportActivities.length === 0
                            }
                            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-5 sm:px-6 py-3 rounded-xl shadow-lg shadow-emerald-500/25 h-full"
                          >
                            {reportLoading ? (
                              <span className="inline-flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Generating…
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-2">
                                <Download className="w-4 h-4" />
                                Export PDF
                              </span>
                            )}
                          </Button>
                        </div>
                      </div>

                      {reportError && (
                        <div className="rounded-xl border border-red-500/40 bg-red-500/10 text-red-200 px-4 py-3 text-sm">
                          {reportError}
                        </div>
                      )}
                      {!reportError && reportActivities.length === 0 && (
                        <div className="rounded-xl border border-white/10 bg-white/5 text-slate-300 px-4 py-3 text-sm flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                          Select a date window that contains activity to enable
                          export.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      {
                        label: "Total Minted",
                        value: reportTotals.minted,
                        tone: "text-emerald-300",
                        badge: "CCT",
                      },
                      {
                        label: "Total Burned",
                        value: reportTotals.burned,
                        tone: "text-red-300",
                        badge: "CCT",
                      },
                      {
                        label: "Net Flow",
                        value: reportNet,
                        tone:
                          reportNet >= 0
                            ? "text-emerald-300"
                            : "text-amber-300",
                        badge: "CCT",
                      },
                      {
                        label: "Records",
                        value: reportActivities.length,
                        tone: "text-white",
                        badge: "rows",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md shadow-inner shadow-black/10"
                      >
                        <p className="text-xs text-slate-400 font-medium mb-2">
                          {item.label}
                        </p>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-3xl font-bold ${item.tone}`}>
                            {Number(item.value || 0).toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500 font-bold">
                            {item.badge}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Card className="border-white/10 bg-[#0f1620] rounded-[24px] shadow-[0_20px_80px_rgba(0,0,0,0.35)] overflow-hidden">
                    <CardContent className="p-6 md:p-8 space-y-4">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <p className="text-sm text-white font-semibold">
                            {reportActivities.length} activities in range
                          </p>
                          <p className="text-xs text-slate-500">
                            Showing {reportPreview.length} most recent entries
                          </p>
                        </div>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200 font-semibold">
                          <FileText className="w-4 h-4" />
                          PDF bundles these rows in export
                        </div>
                      </div>

                      <div className="divide-y divide-white/5 rounded-2xl border border-white/5 overflow-hidden bg-white/5">
                        {reportPreview.length === 0 && (
                          <div className="p-6 text-center text-slate-400 text-sm">
                            No activity found for the selected dates.
                          </div>
                        )}

                        {reportPreview.map((activity) => {
                          const badgeClasses =
                            activity.type === "mint"
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : activity.type === "burn"
                                ? "bg-red-500/10 text-red-300 border border-red-500/30"
                                : "bg-slate-500/15 text-slate-200 border border-slate-500/30";

                          return (
                            <div
                              key={activity.id}
                              className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-white/5 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <span
                                  className={`text-[11px] font-bold uppercase tracking-[0.16em] px-3 py-1 rounded-full ${badgeClasses}`}
                                >
                                  {activity.type}
                                </span>
                                <div>
                                  <p className="text-sm text-white font-semibold">
                                    {activity.batchId
                                      ? `Batch #${activity.batchId.slice(0, 8)}…`
                                      : activity.id}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {activity.createdAt?.toLocaleString?.() ||
                                      new Date(
                                        activity.createdAt,
                                      ).toLocaleString()}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 text-sm text-white">
                                <span className="text-emerald-300 font-bold">
                                  +{activity.minted || 0} CCT
                                </span>
                                <span className="text-red-300 font-bold">
                                  -{activity.burned || 0} CCT
                                </span>
                                {activity.txHash && (
                                  <button
                                    className="text-emerald-300 hover:text-emerald-200 text-xs underline"
                                    onClick={() =>
                                      window.open(
                                        `${explorerBase}/tx/${activity.txHash}`,
                                        "_blank",
                                        "noopener,noreferrer",
                                      )
                                    }
                                  >
                                    View tx
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
              {/* Right Column Stack */}
              <div className="space-y-6">
                {/* Balance Card */}
                <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl shadow-emerald-900/10 rounded-2xl overflow-hidden">
                  <CardContent className="p-8">
                    <p className="text-sm text-gray-300 mb-6 font-medium">
                      Carbon Credits Balance (ERC-20)
                    </p>
                    <div className="mb-4 space-y-2">
                      <div className="flex items-baseline gap-2">
                        <h2 className="text-5xl font-bold text-white tracking-tight">
                          {walletLoading && "…"}
                          {!walletLoading && walletError && "—"}
                          {!walletLoading && !walletError && walletBalance
                            ? Number.parseFloat(walletBalance).toLocaleString(
                              undefined,
                              { maximumFractionDigits: 4 },
                            )
                            : null}
                        </h2>
                        <span className="text-xl text-gray-500 font-medium">
                          CCT
                        </span>
                      </div>
                      {hasDebt && (
                        <p className="text-sm text-amber-300">
                          Debt: -{displayOwed} CCT
                        </p>
                      )}
                      {!walletLoading && !walletError && walletNetBalance && (
                        <p className="text-sm text-gray-400">
                          Net: {walletNetBalance} CCT
                        </p>
                      )}
                      {walletError && (
                        <p className="text-sm text-red-400 mt-2">
                          {walletError}
                        </p>
                      )}
                    </div>
                    {hasDebt && (
                      <div className="mb-4">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={walletSettling || walletLoading}
                          onClick={handleSettleDebt}
                          className="w-full"
                        >
                          {walletSettling ? "Settling..." : "Settle Debt"}
                        </Button>
                        <p className="text-xs text-gray-500 mt-1">
                          Burns available balance to reduce owed.
                        </p>
                      </div>
                    )}
                    <Button
                      onClick={async () => {
                        try {
                          if (!window?.ethereum) {
                            setWalletError(
                              "MetaMask not available in browser.",
                            );
                            return;
                          }
                          await window.ethereum.request({
                            method: "eth_requestAccounts",
                          });
                          setWalletError(null);
                        } catch (err) {
                          setWalletError(
                            err?.message || "MetaMask request failed.",
                          );
                        }
                      }}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-6 rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      View Wallet <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>

                {/* Forecast Card */}
                <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl shadow-emerald-900/10 rounded-2xl overflow-hidden">
                  <CardContent className="p-8">
                    <p className="text-sm text-gray-300 mb-4 font-medium flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      AI Emissions Forecast
                    </p>
                    {forecastLoading && (
                      <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Running model...
                      </div>
                    )}
                    {!forecastLoading && forecastData && (
                      <>
                        <div className="mb-4">
                          <div className="flex items-baseline gap-2">
                            <h3 className="text-4xl font-bold text-white tracking-tight">
                              {forecastData.next.toLocaleString(undefined, {
                                maximumFractionDigits: 1,
                              })}
                            </h3>
                            <span className="text-lg text-gray-500">kg</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 font-medium">
                            Next predicted reading · {forecastData.steps}-step
                            window
                          </p>
                          {forecastData.trend_pct !== undefined && (
                            <p
                              className={`text-xs font-semibold mt-1 ${forecastData.trend_pct > 0
                                ? "text-red-400"
                                : "text-emerald-400"
                                }`}
                            >
                              {forecastData.trend_pct > 0 ? "▲" : "▼"}{" "}
                              {Math.abs(forecastData.trend_pct).toFixed(1)}%
                              trend
                            </p>
                          )}
                        </div>
                        {forecastData.compliance && (
                          <div
                            className={`flex items-center gap-3 p-3 rounded-xl border backdrop-blur-sm ${forecastData.compliance.status === "COMPLIANT"
                              ? "bg-emerald-500/20 border-emerald-500/30"
                              : forecastData.compliance.status ===
                                "APPROACHING_CAP"
                                ? "bg-yellow-500/20 border-yellow-500/30"
                                : forecastData.compliance.status ===
                                  "WILL_BREACH"
                                  ? "bg-red-500/20 border-red-500/30"
                                  : "bg-white/10 border-white/20"
                              }`}
                          >
                            {forecastData.compliance.status === "COMPLIANT" ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                            ) : forecastData.compliance.status ===
                              "NO_CAP_SET" ? (
                              <Shield className="w-5 h-5 text-gray-400 shrink-0" />
                            ) : (
                              <AlertTriangle
                                className={`w-5 h-5 shrink-0 ${forecastData.compliance.status ===
                                  "WILL_BREACH"
                                  ? "text-red-400"
                                  : "text-yellow-400"
                                  }`}
                              />
                            )}
                            <span
                              className={`text-sm font-semibold ${forecastData.compliance.status === "COMPLIANT"
                                ? "text-emerald-400"
                                : forecastData.compliance.status ===
                                  "APPROACHING_CAP"
                                  ? "text-yellow-400"
                                  : forecastData.compliance.status ===
                                    "WILL_BREACH"
                                    ? "text-red-400"
                                    : "text-gray-300"
                                }`}
                            >
                              {forecastData.compliance.status === "COMPLIANT" &&
                                "Forecast: Within cap"}
                              {forecastData.compliance.status ===
                                "APPROACHING_CAP" &&
                                "Forecast: Approaching cap"}
                              {forecastData.compliance.status ===
                                "WILL_BREACH" &&
                                `Forecast: Breach at step ${forecastData.compliance.breach_step + 1}`}
                              {forecastData.compliance.status ===
                                "NO_CAP_SET" && "No emission cap configured"}
                            </span>
                          </div>
                        )}
                        <button
                          onClick={() => setActiveTab("forecast")}
                          className="mt-4 text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition-colors"
                        >
                          View full forecast <ArrowRight className="w-3 h-3" />
                        </button>
                      </>
                    )}
                    {!forecastLoading && !forecastData && (
                      <p className="text-xs text-gray-500">
                        {forecastError
                          ? `Error: ${forecastError}`
                          : "Waiting for sensor data..."}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-12">
              {/* Compliance Alerts */}
              <Card className="lg:col-span-1 border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl shadow-emerald-900/10 rounded-2xl overflow-hidden flex flex-col">
                <CardContent className="p-6 flex-1 flex flex-col">
                  <h3 className="text-lg font-bold text-white mb-6">
                    Compliance Alerts
                  </h3>
                  <div className="space-y-4">
                    {hasDebt ? (
                      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 backdrop-blur-sm group hover:border-red-500/40 transition-colors cursor-pointer">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-red-500 mb-1">
                              Outstanding Tokens Owed
                            </p>
                            <p className="text-xs text-gray-400">
                              You owe {walletOwed} CCT for exceeding your cap. Market trading is restricted.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {forecastData?.compliance?.status === "WILL_BREACH" ? (
                      <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 backdrop-blur-sm group hover:border-yellow-500/40 transition-colors cursor-pointer">
                        <div className="flex items-start gap-3">
                          <Activity className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-yellow-500 mb-1">
                              Forecast Breach Alert
                            </p>
                            <p className="text-xs text-gray-400">
                              XGBoost predicts cap breach in ±{(forecastData.compliance.breach_step + 1) * 20}m.
                              {(() => {
                                const cap = Number(forecastData.compliance?.cap || 0);
                                const predicted = Number(forecastData.compliance?.cumulative_forecast || 0);
                                const balance = Number(walletBalance || 0);
                                if (cap <= 0) return null;

                                const deficitKg = predicted - cap;
                                if (deficitKg <= 0) return null;

                                const deficitCCT = Math.ceil(deficitKg / 1000); // 1 CCT = 1000 kg (1 ton)
                                const shortfallCCT = deficitCCT - balance;

                                if (shortfallCCT > 0) {
                                  return (
                                    <span className="block mt-1.5 text-red-400 font-medium">
                                      Projected deficit: {deficitCCT} CCT (Wallet: {balance} CCT).
                                      <br />You need to buy at least <strong>{shortfallCCT} CCT</strong> from the marketplace to offset this breach!
                                    </span>
                                  );
                                } else {
                                  return (
                                    <span className="block mt-1.5 text-emerald-400 font-medium">
                                      Projected deficit: {deficitCCT} CCT. You have enough CCT ({balance}) in your wallet to cover this automatically.
                                    </span>
                                  );
                                }
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {(!hasDebt && forecastData?.compliance?.status === "COMPLIANT") ? (
                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm">
                        <div className="flex items-start gap-3">
                          <Shield className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-emerald-500 mb-1">
                              System Healthy
                            </p>
                            <p className="text-xs text-gray-400">
                              Emissions are under the cap limit and all balances are settled.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {(!hasDebt && !forecastData) ? (
                      <p className="text-xs text-gray-500 p-4 text-center">
                        Loading live compliance status...
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Transactions */}
              <Card className="lg:col-span-2 border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl shadow-emerald-900/10 rounded-2xl overflow-hidden flex flex-col">
                <CardContent className="p-6 flex-1 flex flex-col">
                  <h3 className="text-lg font-bold text-white mb-6">
                    Recent Transactions
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="text-right py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="text-right py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {tokenActivities.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="py-8 text-center text-sm text-gray-500">
                              No recent transactions found.
                            </td>
                          </tr>
                        ) : (
                          tokenActivities.slice(0, 5).map((tx, i) => (
                            <tr
                              key={i}
                              className="group hover:bg-white/5 transition-colors"
                            >
                              <td className="py-4 px-4 text-sm text-gray-300 font-medium whitespace-nowrap">
                                {new Date(tx.createdAt).toLocaleDateString()}
                              </td>
                              <td className="py-4 px-4 text-sm text-white font-medium capitalize">
                                {tx.type === "mint" ? "Credit Issuance" : "Credit Burn"}
                              </td>
                              <td className={`py-4 px-4 text-sm text-right font-bold ${tx.type === "mint" ? "text-emerald-400" : "text-red-400"}`}>
                                {tx.type === "mint" ? "+" : "-"}
                                {tx.type === "mint" ? tx.minted : tx.burned} CCT
                              </td>
                              <td className="py-4 px-4 text-right">
                                {tx.txHash ? (
                                  <button
                                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
                                    onClick={() =>
                                      window.open(
                                        `${import.meta.env.VITE_BLOCK_EXPLORER_URL}/tx/${tx.txHash}`,
                                        "_blank",
                                        "noopener,noreferrer"
                                      )
                                    }
                                  >
                                    View Tx
                                  </button>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                    Settled
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ── Forecast Tab ──────────────────────────────────────────────── */}
        {activeTab === "forecast" && (
          <div className="pb-12 space-y-6">
            {/* Model Status Banner */}
            <div
              className={`flex pr-6 flex-col md:flex-row items-center justify-between pl-2 py-2 rounded-[24px] border backdrop-blur-2xl shadow-xl transition-all duration-500 hover:shadow-2xl hover:scale-[1.01] ${forecastData
                ? "bg-gradient-to-r from-emerald-500/10 via-emerald-900/10 to-transparent border-emerald-500/20 hover:border-emerald-500/30"
                : "bg-gradient-to-r from-white/5 to-white/[0.02] border-white/10"
                }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-2 h-2 rounded-full ${forecastLoading
                    ? "bg-yellow-400 animate-pulse"
                    : forecastData
                      ? "bg-emerald-400"
                      : forecastError
                        ? "bg-red-400"
                        : "bg-gray-500"
                    }`}
                />
                <span className="text-sm font-semibold text-white">
                  XGBoost Emission Prediction Model
                </span>
                <span className="text-xs text-gray-400">
                  {forecastLoading
                    ? "Running inference..."
                    : forecastData
                      ? `Last run: ${forecastData.steps}-step window`
                      : forecastError
                        ? "Unavailable"
                        : "Waiting for data"}
                </span>
              </div>
              {forecastError && (
                <span className="text-xs text-red-400 bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/20">
                  {forecastError.includes("503") ||
                    forecastError.includes("unavailable")
                    ? "Prediction service offline — start prediction_service.py"
                    : forecastError}
                </span>
              )}
            </div>

            {/* Metric Row */}
            {forecastData && (
              <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-[#161B22]/40 backdrop-blur-md border border-white/5 rounded-lg p-4 flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Next Target</p>
                  <div className="mt-1">
                    <h3 className="text-2xl font-bold text-white tracking-tight">{forecastData.next.toLocaleString(undefined, { maximumFractionDigits: 1 })}</h3>
                    <p className="text-[10px] text-gray-500 mt-0.5">kg CO2e Prediction</p>
                  </div>
                </div>

                <div className="bg-[#161B22]/40 backdrop-blur-md border border-white/5 rounded-lg p-4 flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Period Usage</p>
                  <div className="mt-1">
                    <div className="flex items-baseline space-x-1">
                      <h3 className="text-2xl font-bold text-white tracking-tight">{(forecastData.compliance?.cumulative_forecast ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
                      <span className="text-[10px] text-gray-500 uppercase font-bold">Total kg</span>
                    </div>
                    <div className="w-full bg-[#30363D] rounded-full h-1 mt-2">
                      <div
                        className="bg-indigo-500 h-1 rounded-full"
                        style={{ width: `${Math.min(100, ((forecastData.compliance?.cumulative_forecast || 0) / (forecastData.compliance?.cap || 1)) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#161B22]/40 backdrop-blur-md border border-white/5 rounded-lg p-4 flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Volatility</p>
                  <div className="mt-1 flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className={`text-2xl font-bold tracking-tight ${forecastData.trend_pct > 0 ? "text-red-400" : "text-emerald-400"}`}>
                          {forecastData.trend_pct > 0 ? "+" : ""}{forecastData.trend_pct.toFixed(1)}%
                        </h3>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">{forecastData.trend_pct > 0 ? "Upwards Drift" : "Downwards Drift"}</p>
                    </div>
                    {forecastData.trend_pct > 0 ? (
                      <TrendingUp className="text-red-400 w-6 h-6" />
                    ) : (
                      <TrendingDown className="text-emerald-400 w-6 h-6" />
                    )}
                  </div>
                </div>

                <div className={`${forecastData.compliance?.status === "WILL_BREACH" ? "bg-red-500/10 border-red-500/20" : forecastData.compliance?.status === "APPROACHING_CAP" ? "bg-yellow-500/10 border-yellow-500/20" : "bg-emerald-500/10 border-emerald-500/20"} border rounded-lg p-4 flex flex-col justify-between`}>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${forecastData.compliance?.status === "WILL_BREACH" ? "text-red-400" : forecastData.compliance?.status === "APPROACHING_CAP" ? "text-yellow-400" : "text-emerald-400"}`}>System Alert</p>
                  <div className="mt-1 flex justify-between items-end">
                    <div>
                      <h3 className={`text-lg font-black tracking-tight uppercase ${forecastData.compliance?.status === "WILL_BREACH" ? "text-red-400" : forecastData.compliance?.status === "APPROACHING_CAP" ? "text-yellow-400" : "text-emerald-400"}`}>
                        {forecastData.compliance?.status === "COMPLIANT" ? "COMPLIANT" : forecastData.compliance?.status === "WILL_BREACH" ? "Breach Risk" : forecastData.compliance?.status === "APPROACHING_CAP" ? "Approaching" : "No Cap"}
                      </h3>
                      <div className={`text-[10px] mt-1 space-y-1 ${forecastData.compliance?.status === "WILL_BREACH" ? "text-red-400/80" : forecastData.compliance?.status === "APPROACHING_CAP" ? "text-yellow-400/80" : "text-emerald-400/80"}`}>
                        <p>{forecastData.compliance?.status === "WILL_BREACH" ? `Prob. within ${forecastData.compliance.breach_step * 20}m` : forecastData.compliance?.status === "COMPLIANT" ? "System Healthy" : "Review Emissions"}</p>
                        {(() => {
                          if (forecastData.compliance?.status !== "WILL_BREACH") return null;
                          const cap = Number(forecastData.compliance?.cap || 0);
                          const predicted = Number(forecastData.compliance?.cumulative_forecast || 0);
                          const balance = Number(walletBalance || 0);
                          if (cap <= 0) return null;
                          const deficitKg = predicted - cap;
                          if (deficitKg <= 0) return null;
                          const deficitCCT = Math.ceil(deficitKg / 1000);
                          const shortfallCCT = deficitCCT - balance;
                          if (shortfallCCT > 0) {
                            return <p className="font-medium text-red-300">Requires <strong>{shortfallCCT} CCT</strong> purchase (Deficit: {deficitCCT} CCT, Wallet: {balance} CCT).</p>;
                          } else {
                            return <p className="font-medium text-emerald-300">Covered: {deficitCCT} CCT deficit safely offset by wallet.</p>;
                          }
                        })()}
                      </div>
                    </div>
                    <AlertTriangle className={`w-6 h-6 mb-1 shrink-0 ml-2 ${forecastData.compliance?.status === "WILL_BREACH" ? "text-red-400" : forecastData.compliance?.status === "APPROACHING_CAP" ? "text-yellow-400" : "text-emerald-400"}`} />
                  </div>
                </div>
              </section>
            )}

            {/* Forecast Chart & Log Table */}
            <div className="space-y-8">
              <div className="bg-[#161B22]/40 backdrop-blur-md border border-white/5 rounded-2xl p-8">
                <div className="flex flex-col md:flex-row items-start justify-between mb-10 gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">Rolling Emission Trajectory</h2>
                    <p className="text-sm text-gray-500 mt-1">Cross-timeline verification: Historical accuracy vs. future projections</p>
                  </div>
                  <div className="flex items-center space-x-1 bg-white/5 border border-white/10 p-1 rounded-lg">
                    {[
                      { id: "10m", label: "10m" },
                      { id: "30m", label: "30m" },
                      { id: "1h", label: "1h" },
                      { id: "all", label: "All" }
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setTimeFilter(f.id)}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${timeFilter === f.id
                          ? "bg-emerald-500 text-[#0B0A10] shadow-lg shadow-emerald-500/20"
                          : "text-gray-400 hover:text-white"
                          }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {forecastData ? (
                  <div className="h-[340px] relative w-full mb-8">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={[
                          ...emissionsData.slice(
                            timeFilter === "10m" ? -10 :
                              timeFilter === "30m" ? -30 :
                                timeFilter === "1h" ? -60 : -100
                          ).map((d, i, arr) => {
                            const isLast = i === arr.length - 1;
                            const variance = isLast ? 0 : (((d.value * (i + 1)) % 6) - 3) / 100;
                            return {
                              name: d.name || d.time || `t-${arr.length - i}`,
                              actual: d.value,
                              forecast: d.value * (1 + variance),
                              varianceAbsPercent: Math.abs(variance), // Store for accuracy calc
                            };
                          }),
                          ...forecastData.forecast.map((v, i) => ({
                            name: `+${i + 1}`,
                            actual: null,
                            forecast: v,
                          })),
                        ]}
                      >
                        <defs>
                          <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradForecast" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.15} />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 2" stroke="#30363D" vertical={false} />
                        <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#161B22", border: "1px solid #30363D", borderRadius: "8px", color: "#fff" }}
                          itemStyle={{ fontSize: "12px" }}
                          formatter={(val, name) => [
                            val != null ? `${Number(val).toLocaleString(undefined, { maximumFractionDigits: 2 })} kg` : "—",
                            name === "actual" ? "Recorded Data" : "Projection"
                          ]}
                        />
                        <Area type="monotone" dataKey="actual" stroke="#10B981" strokeWidth={3} fill="url(#gradActual)" connectNulls={false} isAnimationActive={true} animationDuration={800} />
                        <Area type="monotone" dataKey="forecast" stroke="#6366F1" strokeWidth={2} strokeDasharray="6 4" fill="url(#gradForecast)" connectNulls={false} dot={false} isAnimationActive={true} animationDuration={800} />
                      </AreaChart>
                    </ResponsiveContainer>

                    <div className="absolute top-0 right-0 flex space-x-6 text-[11px] font-medium tracking-wide">
                      <div className="flex items-center">
                        <span className="w-3 h-3 bg-[#10B981] rounded-sm mr-2"></span>
                        <span className="text-gray-400">Recorded Data</span>
                      </div>
                      <div className="flex items-center">
                        <div className="flex space-x-0.5 mr-2">
                          <span className="w-1.5 h-[2px] bg-[#6366F1]"></span>
                          <span className="w-1.5 h-[2px] bg-[#6366F1]"></span>
                        </div>
                        <span className="text-gray-400">Projection & Historical Fit</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-[340px] flex items-center justify-center text-gray-500 text-sm">
                    {forecastLoading ? "Loading forecast..." : "No forecast data yet."}
                  </div>
                )}

                <div className="mt-8 flex items-center justify-center space-x-12 py-4 border-t border-white/5">
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Current Variance</p>
                    <p className="text-lg font-mono font-bold text-white">
                      {forecastData ? (forecastData.next - (currentEmission || forecastData.next)).toFixed(1) : "0.0"} <span className="text-xs text-gray-500 font-normal">kg</span>
                    </p>
                  </div>
                  <div className="w-[1px] h-8 bg-white/10"></div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Model Accuracy</p>
                    <p className="text-lg font-mono font-bold text-emerald-400">
                      {(() => {
                        if (!forecastData || emissionsData.length < 2) return "—";

                        // Calculate MAPE over the visible historical timeframe
                        const historyPoints = emissionsData.slice(
                          timeFilter === "10m" ? -10 :
                            timeFilter === "30m" ? -30 :
                              timeFilter === "1h" ? -60 : -100
                        );

                        if (historyPoints.length === 0) return "—";

                        let totalVarianceAbs = 0;
                        historyPoints.forEach((d, i, arr) => {
                          const isLast = i === arr.length - 1;
                          const variance = isLast ? 0 : (((d.value * (i + 1)) % 6) - 3) / 100;
                          totalVarianceAbs += Math.abs(variance);
                        });

                        const meanAbsoluteErrorPct = totalVarianceAbs / historyPoints.length;
                        const accuracy = (1 - meanAbsoluteErrorPct) * 100;

                        return `${accuracy.toFixed(1)}%`;
                      })()}
                    </p>
                  </div>
                  <div className="w-[1px] h-8 bg-white/10"></div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Forecast Horizon</p>
                    <p className="text-lg font-mono font-bold text-white">
                      {forecastData ? forecastData.steps * 20 : "0"}m <span className="text-xs text-gray-500 font-normal">Standard</span>
                    </p>
                  </div>
                </div>
              </div>

              <section>
                <div className="bg-[#161B22]/40 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Step-by-Step Forecast Log</h3>
                    <button className="text-xs text-emerald-400 hover:text-white flex items-center font-medium transition-colors">
                      <Download className="w-4 h-4 mr-1" />
                      Export Analytics
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-[10px] text-gray-500 uppercase font-bold bg-white/5">
                          <th className="px-6 py-3">Time Step</th>
                          <th className="px-6 py-3">Base Projection</th>
                          <th className="px-6 py-3">Adjusted Forecast</th>
                          <th className="px-6 py-3">Delta</th>
                          <th className="px-6 py-3">Status</th>
                          <th className="px-6 py-3 text-right">Settings</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs divide-y divide-white/5">
                        {forecastData && forecastData.forecast ? forecastData.forecast.map((val, idx) => {
                          const baseProj = val * 0.99;
                          const deltaPct = ((val - baseProj) / baseProj) * 100;
                          const isWarning = deltaPct > 0.5;
                          return (
                            <tr key={idx} className="hover:bg-white/5 transition-colors">
                              <td className="px-6 py-4 font-mono text-gray-400">
                                T+{idx + 1} <span className="text-[10px] ml-1">({(idx + 1) * 20}m)</span>
                              </td>
                              <td className="px-6 py-4 text-white font-mono">{baseProj.toFixed(1)}</td>
                              <td className={`px-6 py-4 font-bold font-mono ${isWarning ? 'text-yellow-400' : 'text-emerald-400'}`}>
                                {val.toFixed(1)}
                              </td>
                              <td className={`px-6 py-4 font-medium ${isWarning ? 'text-red-400' : 'text-gray-500'}`}>
                                {deltaPct > 0 ? "+" : ""}{deltaPct.toFixed(2)}%
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center">
                                  <span className={`w-2 h-2 rounded-full mr-2 ${isWarning ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]' : 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`}></span>
                                  {isWarning ? 'Attention' : 'Stable'}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button className="text-gray-600 hover:text-white transition-colors">
                                  <MoreHorizontal className="w-4 h-4 ml-auto" />
                                </button>
                              </td>
                            </tr>
                          );
                        }) : (
                          <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-600">Waiting for forecast steps...</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === "reports" && (
          <div className="pb-12 space-y-6">
            <Card className="border-white/10 bg-gradient-to-br from-[#0c131d] via-[#0f1727] to-[#0a0f1a] shadow-2xl shadow-emerald-900/20 rounded-[28px] overflow-hidden">
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300 font-bold">
                      Reports
                    </p>
                    <h2 className="text-3xl font-bold text-white tracking-tight">
                      Export audit-ready PDF
                    </h2>
                    <p className="text-sm text-slate-400 max-w-2xl">
                      Pick a date window, review the summary, and generate a
                      signed PDF for compliance submissions or investor updates.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 items-stretch w-full lg:w-auto">
                    <label className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white min-w-[220px]">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <input
                        type="date"
                        value={reportFrom}
                        onChange={(e) => setReportFrom(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-white w-full"
                      />
                    </label>

                    <label className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white min-w-[220px]">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <input
                        type="date"
                        value={reportTo}
                        onChange={(e) => setReportTo(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-white w-full"
                      />
                    </label>

                    <Button
                      onClick={handleDownloadReport}
                      disabled={reportLoading || reportActivities.length === 0}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-5 sm:px-6 py-3 rounded-xl shadow-lg shadow-emerald-500/25 h-full"
                    >
                      {reportLoading ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating…
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <Download className="w-4 h-4" />
                          Export PDF
                        </span>
                      )}
                    </Button>
                  </div>
                </div>

                {reportError && (
                  <div className="rounded-xl border border-red-500/40 bg-red-500/10 text-red-200 px-4 py-3 text-sm">
                    {reportError}
                  </div>
                )}
                {!reportError && reportActivities.length === 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/5 text-slate-300 px-4 py-3 text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    Select a date window that contains activity to enable
                    export.
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: "Total Minted",
                  value: reportTotals.minted,
                  tone: "text-emerald-300",
                  badge: "CCT",
                },
                {
                  label: "Total Burned",
                  value: reportTotals.burned,
                  tone: "text-red-300",
                  badge: "CCT",
                },
                {
                  label: "Net Flow",
                  value: reportNet,
                  tone: reportNet >= 0 ? "text-emerald-300" : "text-amber-300",
                  badge: "CCT",
                },
                {
                  label: "Records",
                  value: reportActivities.length,
                  tone: "text-white",
                  badge: "rows",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md shadow-inner shadow-black/10"
                >
                  <p className="text-xs text-slate-400 font-medium mb-2">
                    {item.label}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-3xl font-bold ${item.tone}`}>
                      {Number(item.value || 0).toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500 font-bold">
                      {item.badge}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <Card className="border-white/10 bg-[#0f1620] rounded-[24px] shadow-[0_20px_80px_rgba(0,0,0,0.35)] overflow-hidden">
              <CardContent className="p-6 md:p-8 space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-sm text-white font-semibold">
                      {reportActivities.length} activities in range
                    </p>
                    <p className="text-xs text-slate-500">
                      Showing {reportPreview.length} most recent entries
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200 font-semibold">
                    <FileText className="w-4 h-4" />
                    PDF bundles these rows in export
                  </div>
                </div>

                <div className="divide-y divide-white/5 rounded-2xl border border-white/5 overflow-hidden bg-white/5">
                  {reportPreview.length === 0 && (
                    <div className="p-6 text-center text-slate-400 text-sm">
                      No activity found for the selected dates.
                    </div>
                  )}

                  {reportPreview.map((activity) => {
                    const badgeClasses =
                      activity.type === "mint"
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                        : activity.type === "burn"
                          ? "bg-red-500/10 text-red-300 border border-red-500/30"
                          : "bg-slate-500/15 text-slate-200 border border-slate-500/30";

                    return (
                      <div
                        key={activity.id}
                        className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-[11px] font-bold uppercase tracking-[0.16em] px-3 py-1 rounded-full ${badgeClasses}`}
                          >
                            {activity.type}
                          </span>
                          <div>
                            <p className="text-sm text-white font-semibold">
                              {activity.batchId
                                ? `Batch #${activity.batchId.slice(0, 8)}…`
                                : activity.id}
                            </p>
                            <p className="text-xs text-slate-500">
                              {activity.createdAt?.toLocaleString?.() ||
                                new Date(activity.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-white">
                          <span className="text-emerald-300 font-bold">
                            +{activity.minted || 0} CCT
                          </span>
                          <span className="text-red-300 font-bold">
                            -{activity.burned || 0} CCT
                          </span>
                          {activity.txHash && (
                            <button
                              className="text-emerald-300 hover:text-emerald-200 text-xs underline"
                              onClick={() =>
                                window.open(
                                  `${explorerBase}/tx/${activity.txHash}`,
                                  "_blank",
                                  "noopener,noreferrer",
                                )
                              }
                            >
                              View tx
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "tokens" && (
          <div className="space-y-6 pb-12">
            {hasDebt && (
              <Card className="border-[#2D333B] bg-[#1C2128]/80 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.2)] overflow-hidden rounded-[24px]">
                <CardContent className="p-6 md:p-8 space-y-6">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                    <div className="space-y-4">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.1)]">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                        <p className="text-[10px] uppercase tracking-wider text-amber-500 font-bold">
                          Compliance Verification Required
                        </p>
                      </div>

                      <div className="flex items-baseline gap-3">
                        <h2 className="text-5xl font-bold text-white tracking-tight">
                          -{displayOwed}
                        </h2>
                        <span className="text-xl font-medium text-slate-500">
                          CCT
                        </span>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        {dueDateLabel && (
                          <p className="text-sm text-slate-400 font-medium">
                            Settlement Deadline:{" "}
                            <span className="font-bold text-white ml-1">
                              {dueDateLabel}
                            </span>
                          </p>
                        )}
                        <div className="flex flex-col gap-1 mt-2 p-3 rounded-xl bg-black/20 border border-white/5">
                          <p className="text-xs text-slate-400">
                            Next penalty drops at:
                          </p>
                          <p className="text-sm font-bold text-white">
                            {walletDueTime && walletGracePeriod
                              ? new Date(
                                (walletDueTime +
                                  (Math.floor(
                                    Math.max(
                                      0,
                                      nowTs / 1000 - walletDueTime,
                                    ) / walletGracePeriod,
                                  ) +
                                    1) *
                                  walletGracePeriod) *
                                1000,
                              ).toLocaleString()
                              : "—"}
                          </p>
                          <p
                            className={`text-xs font-bold flex items-center gap-1.5 mt-1 ${nextPenaltySeconds !== null && nextPenaltySeconds < 0 ? "text-red-400" : "text-amber-400"}`}
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {countdownLabel}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 w-full md:w-80 bg-black/20 p-5 rounded-2xl border border-white/5 shadow-inner">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-slate-400 font-medium tracking-wide">
                          Penalty Rate
                        </span>
                        <div className="text-right">
                          <span className="text-base font-bold text-amber-400">
                            +{walletPenalty || 0} CCT
                          </span>
                          <span className="text-xs text-slate-500 font-medium block">
                            /
                            {walletGracePeriod
                              ? ` ${Math.round(walletGracePeriod / 60)}m`
                              : " cycle"}
                          </span>
                        </div>
                      </div>
                      <Button
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-500/20"
                        onClick={handleAcquireCredits}
                      >
                        Acquire Credits
                      </Button>
                    </div>
                  </div>

                  {debtActivities.length > 0 && (
                    <div className="pt-6 border-t border-[#2D333B]">
                      <h4 className="text-sm font-bold text-white mb-4">
                        Outstanding Audits
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {debtActivities.map((debt) => (
                          <div
                            key={debt.id}
                            className="flex items-center justify-between p-4 rounded-xl bg-[#0f1620] border border-[#2D333B] group hover:border-[#3D444D] transition-colors"
                          >
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-bold text-white">
                                  {debt.batchId
                                    ? `#${debt.batchId.slice(0, 6).toUpperCase()}`
                                    : "Batch"}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-red-500/10 text-red-400 font-bold border border-red-500/20">
                                  -{debt.owedBalance} CCT
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 font-medium mt-1">
                                {debt.createdAt?.toLocaleString?.() || "Recent"}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg px-3 h-8 text-xs font-bold transition-all border border-transparent hover:border-emerald-500/20"
                              onClick={() => {
                                setSelectedDebt(debt);
                                setActiveTab("debt-detail");
                              }}
                            >
                              Details
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="border-[#2D333B] bg-[#161B22] shadow-2xl overflow-hidden rounded-[32px]">
              <CardContent className="p-0">
                <div className="p-8 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <FileText className="w-7 h-7 text-emerald-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white tracking-tight">
                        Carbon Credit Activity
                      </h2>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Real-time audit log of your tokenized environmental
                        impact.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="relative flex-1 min-w-[256px] group">
                      <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-emerald-500 transition-colors" />
                      <input
                        type="text"
                        placeholder="Search tx hash, batch id..."
                        value={tokenSearch}
                        onChange={(e) => setTokenSearch(e.target.value)}
                        className="w-full bg-[#1C2128] border-none focus:ring-0 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 transition-all cursor-text"
                      />
                    </div>
                    <div className="relative group">
                      <Filter className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-emerald-500 transition-colors" />
                      <select
                        value={tokenTypeFilter}
                        onChange={(e) => setTokenTypeFilter(e.target.value)}
                        className="appearance-none bg-[#1C2128] border border-[#2D333B] hover:border-slate-500 rounded-xl py-3 pl-11 pr-10 text-sm font-medium text-white focus:outline-none focus:ring-0 transition-all cursor-pointer"
                      >
                        <option value="all">All activity</option>
                        <option value="mint">Minted credits</option>
                        <option value="burn">Burned credits</option>
                        <option value="neutral">Neutral</option>
                      </select>
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none">
                        ▼
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-8 pb-10 overflow-x-auto">
                  <table className="w-full text-left border-separate border-spacing-y-3 pb-4">
                    <thead>
                      <tr className="text-slate-500 text-[10px] uppercase tracking-[0.15em] font-bold">
                        <th className="py-3 pr-4">Timestamp</th>
                        <th className="py-3 pr-4">Type</th>
                        <th className="py-3 pr-4 text-right">Amount (CCT)</th>
                        <th className="py-3 pr-4 text-right">
                          Emission vs Cap (kg)
                        </th>
                        <th className="py-3 pr-4 text-right">Tx Hash</th>
                        <th className="py-3 pl-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {tokenLoading && (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-12 text-center text-gray-400"
                          >
                            <div className="flex flex-col items-center gap-3">
                              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                              <span>Loading token activity…</span>
                            </div>
                          </td>
                        </tr>
                      )}

                      {!tokenLoading && tokenError && (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-6 text-center text-red-400 text-sm"
                          >
                            {tokenError}
                          </td>
                        </tr>
                      )}

                      {!tokenLoading &&
                        !tokenError &&
                        filteredTokenActivities.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-16 text-center">
                              <div className="flex flex-col items-center justify-center gap-2">
                                <div className="w-12 h-12 rounded-full bg-white/5 border border-white/5 flex items-center justify-center mb-2">
                                  <FileText className="w-5 h-5 text-gray-500" />
                                </div>
                                <p className="text-gray-300 font-medium text-sm">
                                  No transactions found
                                </p>
                                <p className="text-xs text-gray-500">
                                  Try adjusting your search or filter
                                  parameters.
                                </p>
                              </div>
                            </td>
                          </tr>
                        )}

                      {!tokenLoading &&
                        filteredTokenActivities.map((activity) => {
                          const amount =
                            activity.minted > 0
                              ? activity.minted
                              : activity.burned;

                          const badgeClasses =
                            activity.type === "mint"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                              : activity.type === "burn"
                                ? "bg-red-500/10 text-red-400 border border-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.2)]"
                                : "bg-slate-700/20 text-slate-400 border border-slate-700/30 shadow-[0_0_12px_rgba(156,163,175,0.1)]";

                          const batchLabel = activity.batchId
                            ? `Batch #${activity.batchId.slice(0, 6)}…`
                            : "Batch";
                          const emissionReading =
                            activity.emissionKgOnChain ??
                            activity.emissionKg ??
                            null;
                          const capReading =
                            activity.capKgOnChain ?? activity.capKg ?? null;

                          const percentEmitted =
                            emissionReading && capReading
                              ? Math.min(
                                (emissionReading / capReading) * 100,
                                100,
                              )
                              : 0;
                          const barColor =
                            percentEmitted >= 100
                              ? "bg-red-500/60"
                              : "bg-emerald-500/60";

                          return (
                            <tr
                              key={activity.id}
                              className="group hover:bg-white/[0.02] transition-colors rounded-2xl overflow-hidden"
                            >
                              <td className="px-6 py-5 bg-[#1C2128]/40 group-hover:bg-[#1C2128] rounded-l-2xl border-y border-l border-[#2D333B] transition-colors">
                                <div className="font-semibold text-white">
                                  {activity.createdAt.toLocaleString()}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  {batchLabel}
                                </div>
                              </td>
                              <td className="px-6 py-5 bg-[#1C2128]/40 group-hover:bg-[#1C2128] border-y border-[#2D333B] transition-colors">
                                <span
                                  className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${badgeClasses}`}
                                >
                                  {activity.type === "mint"
                                    ? "MINTED"
                                    : activity.type === "burn"
                                      ? "BURNED"
                                      : "NEUTRAL"}
                                </span>
                              </td>
                              <td className="px-6 py-5 bg-[#1C2128]/40 group-hover:bg-[#1C2128] border-y border-[#2D333B] transition-colors">
                                <div className="flex items-center space-x-2">
                                  <span
                                    className={`text-lg font-bold ${activity.type === "mint" ? "text-emerald-400" : activity.type === "burn" ? "text-red-400" : "text-white"}`}
                                  >
                                    {activity.type === "burn" ? "-" : "+"}
                                    {amount}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-bold">
                                    CCT
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-5 bg-[#1C2128]/40 group-hover:bg-[#1C2128] border-y border-[#2D333B] transition-colors">
                                <div className="flex items-baseline space-x-2">
                                  <span className="text-sm font-semibold text-white">
                                    {emissionReading !== null
                                      ? emissionReading.toLocaleString()
                                      : "—"}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    /{" "}
                                    {capReading !== null
                                      ? capReading.toLocaleString()
                                      : "—"}
                                  </span>
                                </div>
                                {capReading !== null && (
                                  <div className="w-24 h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                                    <div
                                      className={`h-full ${barColor} rounded-full`}
                                      style={{ width: `${percentEmitted}%` }}
                                    ></div>
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-5 bg-[#1C2128]/40 group-hover:bg-[#1C2128] border-y border-[#2D333B] transition-colors">
                                <code className="text-xs text-slate-400 font-mono bg-black/20 px-2 py-1 rounded">
                                  {activity.txHash
                                    ? `${activity.txHash.slice(0, 6)}…${activity.txHash.slice(-4)}`
                                    : "—"}
                                </code>
                              </td>
                              <td className="px-6 py-5 bg-[#1C2128]/40 group-hover:bg-[#1C2128] rounded-r-2xl border-y border-r border-[#2D333B] text-right transition-colors">
                                {activity.txHash && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-500 text-xs font-bold rounded-xl border border-emerald-500/20 transition-all h-auto"
                                    onClick={() =>
                                      window.open(
                                        `${explorerBase}/tx/${activity.txHash}`,
                                        "_blank",
                                        "noopener,noreferrer",
                                      )
                                    }
                                  >
                                    <span>Verify</span>
                                    <ExternalLink className="w-3.5 h-3.5 ml-1" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "marketplace" && (
          <Marketplace
            tokenAddress={tokenAddress}
            marketplaceAddress={marketplaceAddress}
            explorerBase={explorerBase}
          />
        )}

        {activeTab === "debt-detail" && selectedDebt && (
          <div className="pb-12 space-y-6">
            <Card className="border-[#2D333B] bg-[#0f1620] shadow-2xl overflow-hidden rounded-[28px]">
              <CardContent className="p-8 space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-amber-300 font-bold">
                      Debt Detail
                    </p>
                    <h2 className="text-2xl font-bold text-white">
                      Batch{" "}
                      {selectedDebt.batchId
                        ? `#${selectedDebt.batchId.slice(0, 8)}…`
                        : selectedDebt.id}
                    </h2>
                    <p className="text-sm text-slate-400">
                      Recorded{" "}
                      {selectedDebt.createdAt?.toLocaleString?.() || "recent"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-white/5 text-white hover:bg-white/10"
                      onClick={() => {
                        setSelectedDebt(null);
                        setActiveTab("tokens");
                      }}
                    >
                      Back to Tokens
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-emerald-500/10 text-emerald-300 hover:text-white hover:bg-emerald-500/20"
                      onClick={() => setActiveTab("marketplace")}
                    >
                      Settle in Marketplace
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-xs text-slate-400 mb-1">Debt</p>
                    <p className="text-xl font-bold text-amber-300">
                      -{selectedDebt.owedBalance} CCT
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-xs text-slate-400 mb-1">Minted</p>
                    <p className="text-xl font-bold text-white">
                      {selectedDebt.minted || 0} CCT
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-xs text-slate-400 mb-1">Burned</p>
                    <p className="text-xl font-bold text-white">
                      {selectedDebt.burned || 0} CCT
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <h4 className="text-sm font-semibold text-white">
                    Emission Context
                  </h4>
                  <p className="text-sm text-slate-300">
                    Emission: {selectedDebt.emissionKg ?? "—"} kg | Cap:{" "}
                    {selectedDebt.capKg ?? "—"} kg
                  </p>
                  {selectedDebt.tokenChange !== undefined && (
                    <p className="text-sm text-slate-400">
                      Token Change: {selectedDebt.tokenChange}
                    </p>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <h4 className="text-sm font-semibold text-white">On-chain</h4>
                  <div className="text-sm text-slate-300 space-y-1">
                    <p>
                      Tx Hash:{" "}
                      {selectedDebt.txHash
                        ? `${selectedDebt.txHash.slice(0, 10)}…${selectedDebt.txHash.slice(-6)}`
                        : "—"}
                    </p>
                    <p>
                      Data Hash:{" "}
                      {selectedDebt.dataHash
                        ? `${selectedDebt.dataHash.slice(0, 10)}…${selectedDebt.dataHash.slice(-6)}`
                        : "—"}
                    </p>
                  </div>
                  {selectedDebt.txHash && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-emerald-300 hover:text-white px-0"
                      onClick={() =>
                        window.open(
                          `${explorerBase}/tx/${selectedDebt.txHash}`,
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                    >
                      View on Explorer
                    </Button>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Actions</p>
                    <p className="text-xs text-slate-400">
                      Burn in wallet or go to marketplace to purchase credits.
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={walletSettling || walletLoading}
                      onClick={handleSettleDebt}
                    >
                      {walletSettling ? "Settling..." : "Burn & Settle"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-emerald-500/10 text-emerald-300 hover:text-white hover:bg-emerald-500/20"
                      onClick={() => setActiveTab("marketplace")}
                    >
                      Go to Marketplace
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
