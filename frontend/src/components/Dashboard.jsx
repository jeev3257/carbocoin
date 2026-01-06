import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { 
  Leaf, LogOut, BarChart3, Activity, TrendingUp, 
  FileText, ShoppingCart, Wallet, Bell, ArrowUpRight, 
  AlertTriangle, Shield, ArrowRight
} from "lucide-react";
import { collection, query, orderBy, limit, onSnapshot, doc } from "firebase/firestore";
import { db } from "../firebase/config";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function Dashboard({ onNavigate, userData }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [emissionsData, setEmissionsData] = useState([]);
  const [currentEmission, setCurrentEmission] = useState(0);
  const [trend, setTrend] = useState(0);
  const [companyData, setCompanyData] = useState(null);

  useEffect(() => {
    // Using the company ID provided in the prompt
    const companyId = "8MizVWnjf9QFZ3fOYaqDpn7LEW72"; 
    
    // Fetch Company Data
    const companyRef = doc(db, "companies", companyId);
    const unsubscribeCompany = onSnapshot(companyRef, (docSnap) => {
      if (docSnap.exists()) {
        setCompanyData(docSnap.data());
      }
    });

    // Fetch Emissions Data
    const readingsRef = collection(db, "emissions", companyId, "readings");
    const q = query(readingsRef, orderBy("timestamp", "desc"), limit(20));

    const unsubscribeReadings = onSnapshot(q, (snapshot) => {
      const readings = [];
      snapshot.forEach((doc) => {
        readings.push({ id: doc.id, ...doc.data() });
      });
      
      // Sort oldest to newest for the graph
      const sortedReadings = readings.reverse().map(reading => {
           let date;
           if (reading.timestamp && typeof reading.timestamp.toDate === 'function') {
               date = reading.timestamp.toDate();
           } else if (reading.timestamp) {
               date = new Date(reading.timestamp);
           } else {
               date = new Date();
           }
           
           return {
               name: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), // mapping to 'name' for potential existing code compatibility, though we'll use 'time' in Recharts
               time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
               value: Number(reading.value),
               originalTimestamp: date
           }
      });
      
      setEmissionsData(sortedReadings);
      
      if (sortedReadings.length > 0) {
        const latest = sortedReadings[sortedReadings.length - 1].value;
        const previous = sortedReadings.length > 1 ? sortedReadings[sortedReadings.length - 2].value : latest;
        
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
  }, []);

  const handleLogout = () => {
    if (confirm("Are you sure you want to log out?")) {
      onNavigate("home");
    }
  };

  const menuItems = [
    { id: "dashboard", icon: BarChart3, label: "Dashboard" },
    { id: "live-data", icon: Activity, label: "Live Data" },
    { id: "forecast", icon: TrendingUp, label: "Forecast" },
    { id: "tokens", icon: Leaf, label: "Tokens" },
    { id: "reports", icon: FileText, label: "Reports" },
    { id: "marketplace", icon: ShoppingCart, label: "Marketplace" },
  ];

  return (
    <div className="flex min-h-screen bg-[#050505] text-white font-sans selection:bg-emerald-500/30">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-[#0a0a0a] flex flex-col fixed h-full z-50">
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

        <div className="mt-auto p-6 border-t border-white/5">
          <div className="bg-[#151515] rounded-xl p-4 mb-4 border border-white/5">
            <h4 className="text-sm font-semibold text-white mb-1">Need Help?</h4>
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">Our support team is here to assist you.</p>
            <Button size="sm" variant="secondary" className="w-full text-xs bg-[#252525] hover:bg-[#303030] text-white border-0 h-8">
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
      <main className="flex-1 ml-64 p-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[#111] border border-white/5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Wallet Balance</p>
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
                  {companyData?.companyName ? companyData.companyName.substring(0, 2).toUpperCase() : "CO"}
                </span>
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium text-white">{companyData?.companyName || "Loading..."}</p>
                <p className="text-xs text-gray-500">{companyData?.industrySector || "Company"}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Live CO2 Chart */}
          <Card className="lg:col-span-2 border-white/5 bg-[#0a0a0a] shadow-xl">
            <CardContent className="p-8">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <p className="text-sm text-gray-400 mb-2 font-medium">Live CO₂ Data from IoT Sensors</p>
                  <h2 className="text-4xl font-bold text-white tracking-tight">
                    {currentEmission > 0 ? currentEmission.toLocaleString() : 'Loading...'} <span className="text-2xl text-gray-500">tons</span>
                  </h2>
                </div>
                <div className={`flex items-center gap-1.5 ${Number(trend) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {Number(trend) >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                  <span className="text-sm font-bold">{trend > 0 ? '+' : ''}{trend}% vs last reading</span>
                </div>
              </div>

              <div className="h-[300px] w-full bg-[#0a0a0a] rounded-xl overflow-hidden relative">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={emissionsData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
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
                      contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                      itemStyle={{ color: '#10b981' }}
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
            <Card className="border-white/5 bg-[#0a0a0a] shadow-xl">
              <CardContent className="p-8">
                <p className="text-sm text-gray-400 mb-6 font-medium">Carbon Credits Balance (ERC-20)</p>
                <div className="mb-8">
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-5xl font-bold text-white tracking-tight">5,420</h2>
                    <span className="text-xl text-gray-500 font-medium">CCT</span>
                  </div>
                </div>
                <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-6 rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                  View Wallet <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Forecast Card */}
            <Card className="border-white/5 bg-[#0a0a0a] shadow-xl">
              <CardContent className="p-8">
                <p className="text-sm text-gray-400 mb-4 font-medium">AI Emissions Forecast</p>
                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-4xl font-bold text-white tracking-tight">1,280</h3>
                    <span className="text-lg text-gray-500">tons</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 font-medium">Next 30 Days Projection</p>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs font-bold text-yellow-500">Potential threshold breach</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Compliance Alerts */}
          <Card className="lg:col-span-1 border-white/5 bg-[#0a0a0a] shadow-xl">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-white mb-6">Compliance Alerts</h3>
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#1a1500] border border-yellow-500/20 group hover:border-yellow-500/40 transition-colors cursor-pointer">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-yellow-500 mb-1">Threshold Breach Alert</p>
                      <p className="text-xs text-gray-400">CO₂ emissions exceeded 1,100 tons.</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 rounded-xl bg-[#1a0505] border border-red-500/20 group hover:border-red-500/40 transition-colors cursor-pointer">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-red-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-red-500 mb-1">Compliance Risk</p>
                      <p className="text-xs text-gray-400">Review your emissions data.</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card className="lg:col-span-2 border-white/5 bg-[#0a0a0a] shadow-xl">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-white mb-6">Recent Transactions</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="text-right py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="text-right py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {[
                      { date: "2024-07-20", type: "Credit Purchase", amount: "+500 CCT", status: "Completed", color: "emerald" },
                      { date: "2024-07-18", type: "Credit Retirement", amount: "-1,000 CCT", status: "Completed", color: "emerald" },
                      { date: "2024-07-15", type: "Credit Transfer", amount: "-200 CCT", status: "Pending", color: "yellow" },
                      { date: "2024-07-12", type: "Credit Purchase", amount: "+1,200 CCT", status: "Completed", color: "emerald" },
                    ].map((tx, i) => (
                      <tr key={i} className="group hover:bg-white/5 transition-colors">
                        <td className="py-4 px-4 text-sm text-gray-300 font-medium">{tx.date}</td>
                        <td className="py-4 px-4 text-sm text-white font-medium">{tx.type}</td>
                        <td className="py-4 px-4 text-sm text-right font-bold text-white">{tx.amount}</td>
                        <td className="py-4 px-4 text-right">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                            ${tx.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'}
                          `}>
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
      </main>
    </div>
  );
}
