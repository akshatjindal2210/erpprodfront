"use client";
import { useState } from "react";
import { useDispatch} from "react-redux";
import { toast } from "react-toastify";
import { Lock, Loader2, User, Eye, ChevronRight, EyeOff } from "lucide-react";
import { setCredentials } from "@/core/store/slices/authSlice";
import { persistor } from "@/core/store/index";
import { userService } from "@/features/shared/auth/services/userService";
import { applyListViewSpanFromSession } from "@/core/utils/global";

export default function UserLogin() {
  const dispatch = useDispatch();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await userService.login({ username: email, password });
      if (res.success) {
        applyListViewSpanFromSession(res.data);
        dispatch(setCredentials({ 
            id: res.data.id, 
            name: res.data.name,
            email: res.data.email, 
            role: res.data.role ?? res.data.type ?? "user",
            permissions: res.data.permissions,
            app_access: res.data.app_access
          }));
        try {
          await persistor.flush();
        } catch {
          /* full reload will sync session via cookie + /users/me */
        }
        toast.success("Welcome to JFL Portal");
        // Full navigation so middleware sees the auth cookie (client router.replace can race).
        window.location.assign("/home");
        return;
      } else {
        toast.error(res.message || "Invalid credentials");
      }
    } catch (err) {
      toast.error(err.message || "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center font-sans selection:bg-blue-100">
      
      {/* Main Wrapper */}
      <div className="w-full max-w-[440px] px-6">
        
        {/* Logo & Header */}
        <div className="text-center mb-10">
          <img src="/logo.png" alt="JFL Logo" className="h-12 mx-auto mb-6 object-contain" />
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sign in to your account</h1>
          <p className="text-slate-500 text-sm mt-2 font-medium">Secure Employee Authentication</p>
        </div>

        {/* Clean Login Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1),0_10px_20px_-5px_rgba(0,0,0,0.04)] p-8 lg:p-10">
          
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Input: Username */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider ml-0.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Enter your username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/5 outline-none transition-all duration-200"
                  required
                />
              </div>
            </div>

            {/* Input: Password */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider ml-0.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/5 outline-none transition-all duration-200"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Premium Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#1e293b] hover:bg-slate-900 disabled:bg-slate-300 text-white font-semibold py-3 rounded-xl text-sm shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>Sign in <ChevronRight size={16} /></>
              )}
            </button>
          </form>

        </div>

        {/* System Credits */}
        <div className="mt-8 text-center">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-[0.2em]">
            © 2026 H.P. Fasteners Pvt. Ltd.
          </p>
        </div>

      </div>
    </div>
  );
}
