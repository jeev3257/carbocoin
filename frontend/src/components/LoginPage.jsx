import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Building2, Mail, Lock, ArrowLeft, Loader2 } from "lucide-react";

export function LoginPage({ onNavigate }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.email || !formData.password) {
      setError("⚠️ Please enter both email and password");
      return;
    }

    setLoading(true);

    try {
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Check if admin login
      if (formData.email === "admin@gmail.com") {
        onNavigate("admin", { userId: userCredential.user.uid, isAdmin: true });
        return;
      }

      // Get company details from Firestore
      const companyDoc = await getDoc(doc(db, "companies", userCredential.user.uid));

      if (companyDoc.exists()) {
        const companyData = companyDoc.data();
        
        // Check company status
        if (companyData.status === "approved") {
          // Navigate to dashboard
          onNavigate("dashboard", { userId: userCredential.user.uid, companyData });
        } else {
          // Navigate to application status page
          onNavigate("application-status", { userId: userCredential.user.uid, companyData });
        }
      } else {
        setError("⚠️ Company profile not found. Please contact support.");
      }
    } catch (err) {
      console.error("Login error:", err);
      
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        setError("⚠️ Invalid email or password. Please try again.");
      } else if (err.code === "auth/user-not-found") {
        setError("⚠️ No account found with this email.");
      } else if (err.code === "auth/too-many-requests") {
        setError("⚠️ Too many failed attempts. Please try again later.");
      } else if (err.code === "auth/network-request-failed") {
        setError("⚠️ Network error. Please check your internet connection.");
      } else {
        setError(err.message || "❌ Failed to sign in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative z-10 py-20">
      <div className="absolute top-6 left-6">
         <Button variant="ghost" onClick={() => onNavigate('home')} className="flex items-center gap-2 text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Back to Home
         </Button>
      </div>
      
      <Card className="w-full max-w-md border-white/10 bg-[#0d131c]/60 backdrop-blur-xl shadow-2xl shadow-black/50">
        <CardContent className="p-8 space-y-8">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 mx-auto mb-6">
              <span className="text-white text-xl font-bold">E</span>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Welcome Back</h1>
            <p className="text-gray-400">Sign in to your EcoChain account</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
                <input 
                  type="email" 
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  placeholder="company@gmail.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-sm font-medium text-gray-300">Password</label>
                <a href="#" className="text-xs text-emerald-400 hover:text-emerald-300">Forgot password?</a>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
                <input 
                  type="password" 
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full py-3.5 text-base font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="text-center text-sm text-gray-500">
            Don't have an account? <button onClick={() => onNavigate('signup')} className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors hover:underline">Create account</button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
