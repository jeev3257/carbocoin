import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import {
  Leaf,
  LogOut,
  BarChart3,
  Activity,
  TrendingUp,
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
} from "lucide-react";
import {
  collection,
  query,
  orderBy,
  limit,
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

  useEffect(() => {
    const companyId = userData?.userId;
    if (!companyId) return;

    // Fetch Company Data
    const companyRef = doc(db, "companies", companyId);
    const unsubscribeCompany = onSnapshot(companyRef, (docSnap) => {
      if (docSnap.exists()) {
        setCompanyData(docSnap.data());
      }
    });

    // Fetch Emissions Data
    const readingsRef = collection(db, "emission", companyId, "readings");
    const q = query(readingsRef, orderBy("timestamp", "desc"), limit(20));

    const unsubscribeReadings = onSnapshot(q, (snapshot) => {
      const readings = [];
      snapshot.forEach((doc) => {
        readings.push({ id: doc.id, ...doc.data() });
      });

      // Sort oldest to newest for the graph
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
          }), // mapping to 'name' for potential existing code compatibility, though we'll use 'time' in Recharts
          time: date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          value: Number(reading.emission) || 0, // Using the "emission" field provided
          originalTimestamp: date,
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

        // Calculate simple trend percentage
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
            const submittedAt = data.submittedAt;
            const createdAt = submittedAt
              ? submittedAt.toDate
                ? submittedAt.toDate()
                : new Date(submittedAt)
              : new Date();

            let type = "neutral";
            if (minted > 0 && burned === 0) type = "mint";
            else if (burned > 0 && minted === 0) type = "burn";

            return {
              id: docSnap.id,
              ...data,
              minted,
              burned,
              type,
              createdAt,
            };
          })
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, MAX_ROWS);

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

  const handleLogout = () => {
    if (confirm("Are you sure you want to log out?")) {
      onNavigate("home");
    }
  };

  const explorerBase =
    import.meta.env.VITE_BLOCK_EXPLORER_URL || "https://sepolia.etherscan.io";

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
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeTab === item.id
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
            Dashboard
          </h1>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 shadow-lg shadow-emerald-900/10">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                  Wallet Balance
                </p>
                <p className="text-sm font-bold text-white">5,420 CCT</p>
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
                  <div className="flex items-start justify-between mb-8">
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
                  </div>

                  <div className="h-[300px] w-full bg-white/5 rounded-xl border border-white/5 overflow-hidden relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={emissionsData}>
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
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Right Column Stack */}
              <div className="space-y-6">
                {/* Balance Card */}
                <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl shadow-emerald-900/10 rounded-2xl overflow-hidden">
                  <CardContent className="p-8">
                    <p className="text-sm text-gray-300 mb-6 font-medium">
                      Carbon Credits Balance (ERC-20)
                    </p>
                    <div className="mb-8">
                      <div className="flex items-baseline gap-2">
                        <h2 className="text-5xl font-bold text-white tracking-tight">
                          5,420
                        </h2>
                        <span className="text-xl text-gray-500 font-medium">
                          CCT
                        </span>
                      </div>
                    </div>
                    <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-6 rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                      View Wallet <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>

                {/* Forecast Card */}
                <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl shadow-emerald-900/10 rounded-2xl overflow-hidden">
                  <CardContent className="p-8">
                    <p className="text-sm text-gray-300 mb-4 font-medium">
                      AI Emissions Forecast
                    </p>
                    <div className="mb-6">
                      <div className="flex items-baseline gap-2">
                        <h3 className="text-4xl font-bold text-white tracking-tight">
                          1,280
                        </h3>
                        <span className="text-lg text-gray-500">ppm</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2 font-medium">
                        Next 30 Days Projection
                      </p>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-yellow-500/20 border border-yellow-500/30 backdrop-blur-sm">
                      <AlertTriangle className="w-5 h-5 text-yellow-500" />
                      <span className="text-sm font-semibold text-yellow-500">
                        Potential threshold breach
                      </span>
                    </div>
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
                    <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 backdrop-blur-sm group hover:border-yellow-500/40 transition-colors cursor-pointer">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-yellow-500 mb-1">
                            Threshold Breach Alert
                          </p>
                          <p className="text-xs text-gray-400">
                            CO₂ emissions exceeded 1,100 ppm.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 backdrop-blur-sm group hover:border-red-500/40 transition-colors cursor-pointer">
                      <div className="flex items-start gap-3">
                        <Shield className="w-5 h-5 text-red-500 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-red-500 mb-1">
                            Compliance Risk
                          </p>
                          <p className="text-xs text-gray-400">
                            Review your emissions data.
                          </p>
                        </div>
                      </div>
                    </div>
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
                        {[
                          {
                            date: "2024-07-20",
                            type: "Credit Purchase",
                            amount: "+500 CCT",
                            status: "Completed",
                            color: "emerald",
                          },
                          {
                            date: "2024-07-18",
                            type: "Credit Retirement",
                            amount: "-1,000 CCT",
                            status: "Completed",
                            color: "emerald",
                          },
                          {
                            date: "2024-07-15",
                            type: "Credit Transfer",
                            amount: "-200 CCT",
                            status: "Pending",
                            color: "yellow",
                          },
                          {
                            date: "2024-07-12",
                            type: "Credit Purchase",
                            amount: "+1,200 CCT",
                            status: "Completed",
                            color: "emerald",
                          },
                        ].map((tx, i) => (
                          <tr
                            key={i}
                            className="group hover:bg-white/5 transition-colors"
                          >
                            <td className="py-4 px-4 text-sm text-gray-300 font-medium">
                              {tx.date}
                            </td>
                            <td className="py-4 px-4 text-sm text-white font-medium">
                              {tx.type}
                            </td>
                            <td className="py-4 px-4 text-sm text-right font-bold text-white">
                              {tx.amount}
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                            ${tx.color === "emerald" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"}
                          `}
                              >
                                {tx.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "tokens" && (
          <div className="space-y-6 pb-12">
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
      </main>
    </div>
  );
}
