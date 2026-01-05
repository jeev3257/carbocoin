import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { 
  Mail, Lock, Building2, FileText, MapPin, Phone, ArrowLeft, Loader2,
  Calendar, Factory, Zap, Leaf, TrendingUp, Wifi
} from "lucide-react";

export function SignupPage({ onNavigate }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    // Auth
    email: "",
    password: "",
    confirmPassword: "",
    
    // Basic Company Identity
    companyName: "",
    cin: "",
    companyType: "",
    yearEstablished: "",
    pan: "",
    gst: "",
    
    // Location & Operational Details
    registeredAddress: "",
    factoryLocations: "",
    state: "",
    district: "",
    gpsCoordinates: "",
    areaType: "",
    
    // Industry & Process Details
    industrySector: "",
    productionType: "",
    annualProductionCapacity: "",
    rawMaterials: "",
    energySource: "",
    
    // Energy & Emission History
    emissionData: "",
    energyConsumption: "",
    fuelType: "",
    pollutionCertificates: "",
    
    // IoT Readiness
    emissionPoints: "",
    iotWillingness: "",
    existingSensors: "",
    internetAvailability: "",
    
    // Authorized Representative
    repName: "",
    repDesignation: "",
    repEmail: "",
    repPhone: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate required fields
    if (!formData.companyName || !formData.cin || !formData.email || !formData.password || !formData.confirmPassword) {
      setError("⚠️ Please fill in all required fields marked with *");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("⚠️ Please enter a valid email address");
      return;
    }

    // Validate passwords
    if (formData.password !== formData.confirmPassword) {
      setError("⚠️ Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("⚠️ Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      // Create user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Save company details to Firestore with pending status
      await setDoc(doc(db, "companies", userCredential.user.uid), {
        // Auth
        email: formData.email,
        userId: userCredential.user.uid,
        status: "pending", // Admin needs to approve
        
        // Basic Company Identity
        companyName: formData.companyName,
        cin: formData.cin,
        companyType: formData.companyType,
        yearEstablished: formData.yearEstablished,
        pan: formData.pan,
        gst: formData.gst,
        
        // Location & Operational Details
        registeredAddress: formData.registeredAddress,
        factoryLocations: formData.factoryLocations,
        state: formData.state,
        district: formData.district,
        gpsCoordinates: formData.gpsCoordinates,
        areaType: formData.areaType,
        
        // Industry & Process Details
        industrySector: formData.industrySector,
        productionType: formData.productionType,
        annualProductionCapacity: formData.annualProductionCapacity,
        rawMaterials: formData.rawMaterials,
        energySource: formData.energySource,
        
        // Energy & Emission History
        emissionData: formData.emissionData,
        energyConsumption: formData.energyConsumption,
        fuelType: formData.fuelType,
        pollutionCertificates: formData.pollutionCertificates,
        
        // IoT Readiness
        emissionPoints: formData.emissionPoints,
        iotWillingness: formData.iotWillingness,
        existingSensors: formData.existingSensors,
        internetAvailability: formData.internetAvailability,
        
        // Authorized Representative
        repName: formData.repName,
        repDesignation: formData.repDesignation,
        repEmail: formData.repEmail,
        repPhone: formData.repPhone,
        
        // Metadata
        createdAt: new Date().toISOString(),
        emissionCap: null, // Will be set by admin
      });

      // Show success message and navigate
      alert("✅ Company registered successfully!\n\n⏳ Your application is now pending admin review.\n\nYou will be notified once approved. Please check your email for updates.");
      onNavigate("login");
    } catch (err) {
      console.error("Registration error:", err);
      
      // Handle specific Firebase errors
      if (err.code === "auth/email-already-in-use") {
        setError("⚠️ This email is already registered. Please use a different email or sign in instead.");
      } else if (err.code === "auth/invalid-email") {
        setError("⚠️ Invalid email address format.");
      } else if (err.code === "auth/weak-password") {
        setError("⚠️ Password is too weak. Please use a stronger password.");
      } else if (err.code === "auth/network-request-failed") {
        setError("⚠️ Network error. Please check your internet connection.");
      } else {
        setError(err.message || "❌ Failed to register. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative z-10 py-20">
      <div className="absolute top-6 left-6">
        <Button
          variant="ghost"
          onClick={() => onNavigate("home")}
          className="flex items-center gap-2 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Button>
      </div>

      <Card className="w-full max-w-2xl border-white/10 bg-[#0d131c]/60 backdrop-blur-xl shadow-2xl shadow-black/50">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 mx-auto mb-4">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Company Registration
            </h1>
            <p className="text-gray-400">Create your EcoChain company account</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* A. Basic Company Identity */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-400" />
                Basic Company Identity
              </h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">
                    Company Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="companyName"
                    required
                    value={formData.companyName}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    placeholder="Acme Corporation Ltd."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">
                    CIN / Registration Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="cin"
                    required
                    value={formData.cin}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    placeholder="L12345MH2020PLC123456"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">Company Type</label>
                  <select
                    name="companyType"
                    value={formData.companyType}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  >
                    <option value="">Select Type</option>
                    <option value="Private Limited">Private Limited</option>
                    <option value="Public Limited">Public Limited</option>
                    <option value="Partnership">Partnership</option>
                    <option value="LLP">LLP</option>
                    <option value="Sole Proprietorship">Sole Proprietorship</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">Year of Establishment</label>
                  <input
                    type="number"
                    name="yearEstablished"
                    value={formData.yearEstablished}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    placeholder="2020"
                    min="1900"
                    max={new Date().getFullYear()}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">PAN / Tax ID</label>
                  <input
                    type="text"
                    name="pan"
                    value={formData.pan}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    placeholder="ABCDE1234F"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">GST Number</label>
                  <input
                    type="text"
                    name="gst"
                    value={formData.gst}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    placeholder="29ABCDE1234F1Z5"
                  />
                </div>
              </div>
            </div>

            {/* B. Location & Operational Details */}
            <div className="space-y-4 pt-4 border-t border-white/10">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-400" />
                Location & Operational Details
              </h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">Registered Address</label>
                  <textarea
                    name="registeredAddress"
                    value={formData.registeredAddress}
                    onChange={handleChange}
                    rows="2"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-none"
                    placeholder="123 Main Street, City, State - 123456"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">Factory/Plant Locations</label>
                  <textarea
                    name="factoryLocations"
                    value={formData.factoryLocations}
                    onChange={handleChange}
                    rows="2"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-none"
                    placeholder="Plant 1: Location, Plant 2: Location (comma separated)"
                  />
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300 ml-1">State</label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                      placeholder="Maharashtra"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300 ml-1">District</label>
                    <input
                      type="text"
                      name="district"
                      value={formData.district}
                      onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                      placeholder="Mumbai"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300 ml-1">Area Type</label>
                    <select
                      name="areaType"
                      value={formData.areaType}
                      onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    >
                      <option value="">Select</option>
                      <option value="Urban">Urban</option>
                      <option value="Rural">Rural</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">GPS Coordinates (Optional)</label>
                  <input
                    type="text"
                    name="gpsCoordinates"
                    value={formData.gpsCoordinates}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    placeholder="19.0760° N, 72.8777° E"
                  />
                </div>
              </div>
            </div>

            {/* C. Industry & Process Details */}
            <div className="space-y-4 pt-4 border-t border-white/10">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Factory className="w-5 h-5 text-emerald-400" />
                Industry & Process Details
              </h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">Industry Sector</label>
                  <select
                    name="industrySector"
                    value={formData.industrySector}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  >
                    <option value="">Select Sector</option>
                    <option value="Power">Power</option>
                    <option value="Cement">Cement</option>
                    <option value="Steel">Steel</option>
                    <option value="IT">IT</option>
                    <option value="Manufacturing">Manufacturing</option>
                    <option value="Textile">Textile</option>
                    <option value="Chemical">Chemical</option>
                    <option value="Automobile">Automobile</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">Production Type</label>
                  <input
                    type="text"
                    name="productionType"
                    value={formData.productionType}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    placeholder="e.g., Continuous, Batch"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">Annual Production Capacity</label>
                  <input
                    type="text"
                    name="annualProductionCapacity"
                    value={formData.annualProductionCapacity}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    placeholder="e.g., 10,000 tons/year"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">Energy Source</label>
                  <input
                    type="text"
                    name="energySource"
                    value={formData.energySource}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    placeholder="Coal, Solar, Grid, etc."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 ml-1">Raw Materials Used</label>
                <textarea
                  name="rawMaterials"
                  value={formData.rawMaterials}
                  onChange={handleChange}
                  rows="2"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-none"
                  placeholder="List main raw materials (comma separated)"
                />
              </div>
            </div>

            {/* D. Energy & Emission History */}
            <div className="space-y-4 pt-4 border-t border-white/10">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                Energy & Emission History
              </h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">Last 3-5 Years Emission Data</label>
                  <textarea
                    name="emissionData"
                    value={formData.emissionData}
                    onChange={handleChange}
                    rows="2"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-none"
                    placeholder="e.g., 2023: 5000 tons CO2, 2022: 4800 tons CO2"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">Energy Consumption (kWh/year)</label>
                  <input
                    type="text"
                    name="energyConsumption"
                    value={formData.energyConsumption}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    placeholder="e.g., 500,000 kWh"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">Fuel Type & Quantity</label>
                  <input
                    type="text"
                    name="fuelType"
                    value={formData.fuelType}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    placeholder="Coal: 1000 tons/year"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">Existing Pollution Certificates</label>
                  <select
                    name="pollutionCertificates"
                    value={formData.pollutionCertificates}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>
            </div>

            {/* E. IoT Readiness */}
            <div className="space-y-4 pt-4 border-t border-white/10">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Wifi className="w-5 h-5 text-emerald-400" />
                IoT Readiness
              </h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">Number of Emission Points</label>
                  <input
                    type="number"
                    name="emissionPoints"
                    value={formData.emissionPoints}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    placeholder="e.g., 5"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">Willing to Install IoT Sensors</label>
                  <select
                    name="iotWillingness"
                    value={formData.iotWillingness}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                    <option value="Maybe">Maybe</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">Existing Sensors</label>
                  <select
                    name="existingSensors"
                    value={formData.existingSensors}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">Internet Availability</label>
                  <select
                    name="internetAvailability"
                    value={formData.internetAvailability}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>
            </div>

            {/* F. Authorized Representative */}
            <div className="space-y-4 pt-4 border-t border-white/10">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Phone className="w-5 h-5 text-emerald-400" />
                Authorized Representative
              </h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">Name</label>
                  <input
                    type="text"
                    name="repName"
                    value={formData.repName}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    placeholder="John Doe"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">Designation</label>
                  <input
                    type="text"
                    name="repDesignation"
                    value={formData.repDesignation}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    placeholder="CEO, Manager, etc."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">Official Email</label>
                  <input
                    type="email"
                    name="repEmail"
                    value={formData.repEmail}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    placeholder="john@company.com"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">Phone Number</label>
                  <input
                    type="tel"
                    name="repPhone"
                    value={formData.repPhone}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>
            </div>

            {/* Account Credentials */}
            <div className="space-y-4 pt-4 border-t border-white/10">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-emerald-400" />
                Account Credentials
              </h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 ml-1">
                    Email Address <span className="text-red-400">*</span>
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                      placeholder="company@gmail.com"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300 ml-1">
                      Password <span className="text-red-400">*</span>
                    </label>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
                      <input
                        type="password"
                        name="password"
                        required
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300 ml-1">
                      Confirm Password <span className="text-red-400">*</span>
                    </label>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
                      <input
                        type="password"
                        name="confirmPassword"
                        required
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 text-base font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Registering...
                </>
              ) : (
                "Create Company Account"
              )}
            </Button>
          </form>

          <div className="text-center text-sm text-gray-500">
            Already have an account?{" "}
            <button
              onClick={() => onNavigate("login")}
              className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors hover:underline"
            >
              Sign in
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
