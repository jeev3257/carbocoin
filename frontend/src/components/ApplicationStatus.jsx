import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Clock, CheckCircle, XCircle, AlertCircle, Building2, ArrowLeft } from "lucide-react";

export function ApplicationStatus({ onNavigate, userData }) {
  const status = userData?.companyData?.status || "pending";
  const companyName = userData?.companyData?.companyName || "Your Company";

  const statusConfig = {
    pending: {
      icon: Clock,
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-500/50",
      title: "Application Under Review",
      message: "Your company registration is currently being reviewed by our admin team. This usually takes 1-3 business days.",
    },
    approved: {
      icon: CheckCircle,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/50",
      title: "Application Approved",
      message: "Congratulations! Your application has been approved.",
    },
    rejected: {
      icon: XCircle,
      color: "text-red-400",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/50",
      title: "Application Rejected",
      message: "Unfortunately, your application was not approved. Please contact support for more details.",
    },
  };

  const config = statusConfig[status] || statusConfig.pending;
  const StatusIcon = config.icon;

  const handleLogout = () => {
    if (confirm("Are you sure you want to log out?")) {
      onNavigate("home");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative z-10 py-20">
      <div className="absolute top-6 left-6">
        <Button variant="ghost" onClick={handleLogout} className="flex items-center gap-2 text-gray-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Logout
        </Button>
      </div>

      <Card className="w-full max-w-2xl border-white/10 bg-[#0d131c]/60 backdrop-blur-xl shadow-2xl shadow-black/50">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-4">
            <div className={`w-20 h-20 ${config.bgColor} ${config.borderColor} border-2 rounded-full flex items-center justify-center mx-auto`}>
              <StatusIcon className={`w-10 h-10 ${config.color}`} />
            </div>
            
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{config.title}</h1>
              <p className="text-gray-400">{config.message}</p>
            </div>
          </div>

          {/* Company Info */}
          <div className={`p-6 rounded-xl border ${config.borderColor} ${config.bgColor}`}>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Application Details
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Company Name:</span>
                <span className="text-white font-medium">{companyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Email:</span>
                <span className="text-white">{userData?.companyData?.email || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Registration Number:</span>
                <span className="text-white">{userData?.companyData?.cin || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Industry Sector:</span>
                <span className="text-white">{userData?.companyData?.industrySector || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className={`${config.color} font-semibold uppercase`}>{status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Submitted:</span>
                <span className="text-white">
                  {userData?.companyData?.createdAt 
                    ? new Date(userData.companyData.createdAt).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Status-specific actions */}
          {status === "pending" && (
            <div className="bg-blue-500/10 border border-blue-500/50 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-200">
                  <p className="font-semibold mb-1">What happens next?</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-300">
                    <li>Admin reviews your application details</li>
                    <li>Emission cap is calculated based on your industry</li>
                    <li>You'll receive an email notification once approved</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {status === "rejected" && (
            <Button 
              className="w-full"
              onClick={() => window.location.href = "mailto:support@ecochain.com"}
            >
              Contact Support
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
