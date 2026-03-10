import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, doc } from "firebase/firestore";
import { db } from "../firebase/config";
import { Card, CardContent } from "./ui/card";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Legend
} from 'recharts';
import {
    Activity, AlertTriangle, TrendingUp, ShieldCheck,
    MapPin, Clock, Calendar, Zap
} from "lucide-react";

export function LiveDataView({ userData, companyData }) {
    const [emissionsData, setEmissionsData] = useState([]);
    const [dailyData, setDailyData] = useState([]);
    const [currentEmission, setCurrentEmission] = useState(0);
    const [totalEmissions, setTotalEmissions] = useState(0);
    const [avgEmission, setAvgEmission] = useState(0);

    useEffect(() => {
        const companyId = userData?.userId;
        if (!companyId) return;

        const readingsRef = collection(db, "emission", companyId, "readings");
        // Fetch a larger dataset for the detailed view
        const q = query(readingsRef, orderBy("timestamp", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const readings = [];
            let total = 0;

            snapshot.forEach((doc) => {
                const data = doc.data();
                readings.push({ id: doc.id, ...data });
                total += (Number(data.emission) || 0);
            });

            // Calculate overall stats
            setTotalEmissions(total);
            if (readings.length > 0) {
                setAvgEmission((total / readings.length).toFixed(1));
                setCurrentEmission(Number(readings[0].emission) || 0);
            }

            // Process for Line Chart (chronological)
            const sortedReadings = [...readings].reverse().map(reading => {
                let date;
                if (reading.timestamp && typeof reading.timestamp.toDate === 'function') {
                    date = reading.timestamp.toDate();
                } else if (reading.timestamp) {
                    date = new Date(reading.timestamp);
                } else {
                    date = new Date();
                }

                return {
                    time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    fullDate: date.toLocaleString(),
                    emission: Number(reading.emission) || 0,
                };
            });
            setEmissionsData(sortedReadings);

            // Process for Daily Aggregate Bar Chart
            const dailyAggregates = {};
            readings.forEach(reading => {
                let date;
                if (reading.timestamp && typeof reading.timestamp.toDate === 'function') {
                    date = reading.timestamp.toDate();
                } else if (reading.timestamp) {
                    date = new Date(reading.timestamp);
                } else {
                    date = new Date();
                }

                const dayString = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                if (!dailyAggregates[dayString]) {
                    dailyAggregates[dayString] = 0;
                }
                dailyAggregates[dayString] += (Number(reading.emission) || 0);
            });

            const processedDailyData = Object.keys(dailyAggregates).map(day => ({
                day,
                total: dailyAggregates[day]
            })).reverse().slice(0, 14); // Last 14 days

            setDailyData(processedDailyData);

        });

        return () => unsubscribe();
    }, [userData]);

    const threshold = companyData?.emissionCap ? Number(companyData.emissionCap) : 1000;
    const isOverThreshold = currentEmission > threshold;

    return (
        <div className="space-y-6">
            {/* Header Info */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Live Sensor Array</h2>
                    <p className="text-gray-400 text-sm flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        Real-time data stream active
                    </p>
                </div>

                <div className="flex gap-4">
                    <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Company Cap</p>
                        <p className="text-white font-bold">{companyData?.emissionCap || "Pending"}</p>
                    </div>
                    <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Location</p>
                        <p className="text-white font-bold flex items-center gap-1">
                            <MapPin className="w-4 h-4 text-emerald-500" />
                            {companyData?.district || "Main Facility"}
                        </p>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl shadow-emerald-900/10 rounded-2xl overflow-hidden">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                <Activity className="w-5 h-5" />
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${isOverThreshold ? 'bg-red-500/20 text-red-500 border-red-500/50' : 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50'}`}>
                                {isOverThreshold ? 'High' : 'Normal'}
                            </span>
                        </div>
                        <p className="text-sm font-medium text-gray-400 mb-1">Current Reading</p>
                        <h3 className="text-3xl font-bold text-white">{currentEmission.toLocaleString()} <span className="text-lg text-gray-500">ppm</span></h3>
                    </CardContent>
                </Card>

                <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl shadow-emerald-900/10 rounded-2xl overflow-hidden">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                        </div>
                        <p className="text-sm font-medium text-gray-400 mb-1">Total Accumulated</p>
                        <h3 className="text-3xl font-bold text-white">{totalEmissions.toLocaleString()} <span className="text-lg text-gray-500">ppm</span></h3>
                    </CardContent>
                </Card>

                <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl shadow-emerald-900/10 rounded-2xl overflow-hidden">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                                <Clock className="w-5 h-5" />
                            </div>
                        </div>
                        <p className="text-sm font-medium text-gray-400 mb-1">Historical Average</p>
                        <h3 className="text-3xl font-bold text-white">{avgEmission.toLocaleString()} <span className="text-lg text-gray-500">ppm</span></h3>
                    </CardContent>
                </Card>

                <Card className={`border-white/10 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden ${isOverThreshold ? 'bg-red-500/10 shadow-red-900/20' : 'bg-white/5 shadow-emerald-900/10'}`}>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isOverThreshold ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                                {isOverThreshold ? <AlertTriangle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                            </div>
                        </div>
                        <p className="text-sm font-medium text-gray-400 mb-1">System Status</p>
                        <h3 className={`text-xl font-bold ${isOverThreshold ? 'text-red-400' : 'text-emerald-400'}`}>
                            {isOverThreshold ? 'Threshold Breach' : 'Compliant'}
                        </h3>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Line Chart */}
                <Card className="lg:col-span-2 border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl shadow-emerald-900/10 rounded-2xl overflow-hidden">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <Zap className="w-5 h-5 text-emerald-400" />
                            <h3 className="text-lg font-bold text-white">Live Telemetry</h3>
                        </div>
                        <div className="h-[350px] w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={emissionsData}>
                                    <defs>
                                        <linearGradient id="colorEmissionLive" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis
                                        dataKey="time"
                                        stroke="rgba(255,255,255,0.3)"
                                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                                        tickLine={false}
                                        axisLine={false}
                                        minTickGap={30}
                                    />
                                    <YAxis
                                        stroke="rgba(255,255,255,0.3)"
                                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `${value}`}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(13, 19, 28, 0.9)',
                                            borderColor: 'rgba(255,255,255,0.1)',
                                            borderRadius: '12px',
                                            color: '#fff',
                                            backdropFilter: 'blur(10px)'
                                        }}
                                        labelStyle={{ color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}
                                        itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                                        labelFormatter={(label, data) => data[0]?.payload?.fullDate || label}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="emission"
                                        stroke="#10b981"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorEmissionLive)"
                                        activeDot={{ r: 6, fill: '#10b981', stroke: '#050505', strokeWidth: 2 }}
                                        animationDuration={1500}
                                        animationEasing="ease-in-out"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Daily Aggregates Bar Chart */}
                <Card className="lg:col-span-1 border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl shadow-emerald-900/10 rounded-2xl overflow-hidden">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <Calendar className="w-5 h-5 text-blue-400" />
                            <h3 className="text-lg font-bold text-white">Daily Cumulative</h3>
                        </div>
                        <div className="h-[350px] w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis
                                        dataKey="day"
                                        stroke="rgba(255,255,255,0.3)"
                                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="rgba(255,255,255,0.3)"
                                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        contentStyle={{
                                            backgroundColor: 'rgba(13, 19, 28, 0.9)',
                                            borderColor: 'rgba(255,255,255,0.1)',
                                            borderRadius: '12px',
                                            color: '#fff',
                                        }}
                                        itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                                    />
                                    <Bar
                                        dataKey="total"
                                        name="Total ppm"
                                        fill="#3b82f6"
                                        radius={[4, 4, 0, 0]}
                                        animationDuration={1500}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
