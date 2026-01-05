import { useState, useEffect } from "react";
import { collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { 
  LogOut, Building2, Clock, CheckCircle, XCircle, 
  Mail, Phone, MapPin, Factory, Loader2, X 
} from "lucide-react";

export function AdminPanel({ onNavigate }) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [approveModal, setApproveModal] = useState(null);
  const [emissionCap, setEmissionCap] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, [filter]);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const companiesRef = collection(db, "companies");
      const q = filter === "all" 
        ? companiesRef 
        : query(companiesRef, where("status", "==", filter));
      
      const querySnapshot = await getDocs(q);
      const companiesData = [];
      querySnapshot.forEach((doc) => {
        companiesData.push({ id: doc.id, ...doc.data() });
      });
      
      setCompanies(companiesData);
    } catch (error) {
      console.error("Error fetching companies:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (confirm("Are you sure you want to log out?")) {
      onNavigate("home");
    }
  };

  const handleApproveClick = (company) => {
    setApproveModal(company);
    setEmissionCap("");
  };

  const handleApprove = async () => {
    if (!emissionCap || parseFloat(emissionCap) <= 0) {
      alert("⚠️ Please enter a valid emission cap");
      return;
    }

    setProcessing(true);
    try {
      const companyRef = doc(db, "companies", approveModal.id);
      await updateDoc(companyRef, {
        status: "approved",
        emissionCap: `${emissionCap} tons/year`,
        approvedAt: new Date().toISOString(),
      });

      alert(`✅ ${approveModal.companyName} has been approved with emission cap of ${emissionCap} tons/year`);
      setApproveModal(null);
      setEmissionCap("");
      fetchCompanies(); // Refresh list
    } catch (error) {
      console.error("Error approving company:", error);
      alert("❌ Failed to approve company. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (company) => {
    if (!confirm(`Are you sure you want to reject ${company.companyName}?`)) {
      return;
    }

    setProcessing(true);
    try {
      const companyRef = doc(db, "companies", company.id);
      await updateDoc(companyRef, {
        status: "rejected",
        rejectedAt: new Date().toISOString(),
      });

      alert(`❌ ${company.companyName} has been rejected`);
      fetchCompanies(); // Refresh list
    } catch (error) {
      console.error("Error rejecting company:", error);
      alert("❌ Failed to reject company. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      pending: { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50", icon: Clock },
      approved: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/50", icon: CheckCircle },
      rejected: { color: "bg-red-500/20 text-red-400 border-red-500/50", icon: XCircle },
    };
    const { color, icon: Icon } = config[status] || config.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${color}`}>
        <Icon className="w-3 h-3" />
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="min-h-screen relative z-10">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0d131c]/70 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-400 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <span className="text-white text-lg font-bold">A</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Admin Panel</h2>
              <p className="text-xs text-gray-400">Company Management</p>
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
          <h1 className="text-3xl font-bold text-white mb-2">Company Applications</h1>
          <p className="text-gray-400">Review and approve company registrations</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-3 mb-6">
          {[
            { value: "pending", label: "Pending", count: companies.filter(c => c.status === "pending").length },
            { value: "approved", label: "Approved", count: companies.filter(c => c.status === "approved").length },
            { value: "rejected", label: "Rejected", count: companies.filter(c => c.status === "rejected").length },
            { value: "all", label: "All", count: companies.length },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === tab.value
                  ? "bg-emerald-500 text-white"
                  : "bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
            >
              {tab.label} {filter === tab.value && `(${tab.count})`}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
        ) : companies.length === 0 ? (
          <Card className="border-white/10 bg-[#0d131c]/60">
            <CardContent className="p-12 text-center">
              <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No companies found</p>
            </CardContent>
          </Card>
        ) : (
          /* Companies Grid */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {companies.map((company) => (
              <Card key={company.id} className="border-white/10 bg-[#0d131c]/60 hover:border-emerald-500/30 transition-all">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{company.companyName}</h3>
                        <p className="text-xs text-gray-400">{company.cin}</p>
                      </div>
                    </div>
                    {getStatusBadge(company.status)}
                  </div>

                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex items-center gap-2 text-gray-300">
                      <Mail className="w-4 h-4 text-gray-500" />
                      {company.email}
                    </div>
                    {company.repPhone && (
                      <div className="flex items-center gap-2 text-gray-300">
                        <Phone className="w-4 h-4 text-gray-500" />
                        {company.repPhone}
                      </div>
                    )}
                    {company.state && (
                      <div className="flex items-center gap-2 text-gray-300">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        {company.state}, {company.district}
                      </div>
                    )}
                    {company.industrySector && (
                      <div className="flex items-center gap-2 text-gray-300">
                        <Factory className="w-4 h-4 text-gray-500" />
                        {company.industrySector}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-gray-400 mb-1">Company Type</p>
                      <p className="text-white font-medium">{company.companyType || "N/A"}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-gray-400 mb-1">Year Est.</p>
                      <p className="text-white font-medium">{company.yearEstablished || "N/A"}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-gray-400 mb-1">Production Cap.</p>
                      <p className="text-white font-medium">{company.annualProductionCapacity || "N/A"}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-gray-400 mb-1">Emission Points</p>
                      <p className="text-white font-medium">{company.emissionPoints || "N/A"}</p>
                    </div>
                  </div>

                  {company.status === "pending" && (
                    <div className="mt-4 pt-4 border-t border-white/10 flex gap-2">
                      <Button 
                        size="sm" 
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handleApproveClick(company)}
                        disabled={processing}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
                        onClick={() => handleReject(company)}
                        disabled={processing}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}

                  {company.emissionCap && (
                    <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/50">
                      <p className="text-xs text-emerald-400">Emission Cap: <span className="font-bold">{company.emissionCap} tons/year</span></p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Approve Modal */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg border-white/10 bg-[#0d131c]/95 shadow-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Set Emission Cap</h3>
                <button 
                  onClick={() => setApproveModal(null)} 
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/50">
                  <p className="text-sm text-gray-300 mb-1">Company Name</p>
                  <p className="text-lg font-semibold text-white">{approveModal.companyName}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-400">Industry Sector</p>
                    <p className="text-white font-medium">{approveModal.industrySector || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Production Capacity</p>
                    <p className="text-white font-medium">{approveModal.annualProductionCapacity || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Energy Source</p>
                    <p className="text-white font-medium">{approveModal.energySource || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Energy Consumption</p>
                    <p className="text-white font-medium">{approveModal.energyConsumption || "N/A"}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">
                    Set Annual Emission Cap (tons/year) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={emissionCap}
                    onChange={(e) => setEmissionCap(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    placeholder="e.g., 5000"
                    min="1"
                  />
                  <p className="text-xs text-gray-500">
                    Based on industry sector, production capacity, and energy consumption
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => setApproveModal(null)}
                    variant="outline"
                    className="flex-1"
                    disabled={processing}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleApprove}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    disabled={processing}
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Approving...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve & Set Cap
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
