"use client";

import { useState } from "react";
import { useDispatch } from "react-redux";
import { useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import { Lock, Loader2, User, Eye, EyeOff } from "lucide-react";
import { setCredentials } from "@/core/store/slices/authSlice";
import { persistor } from "@/core/store/index";
import { userService } from "@/features/shared/auth/services/userService";
import { applyListViewSpanFromSession } from "@/core/utils/global";

const primaryClass =
  "w-full bg-[#1e293b] hover:bg-slate-900 disabled:bg-slate-300 text-white font-semibold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2";

const inputClass =
  "w-full pl-10 pr-10 py-2.5 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none border border-slate-200 bg-white focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

export default function UserLogin() {
  const dispatch = useDispatch();
  const searchParams = useSearchParams();
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
        dispatch(
          setCredentials({
            id: res.data.id,
            name: res.data.name,
            email: res.data.email,
            role: res.data.role ?? res.data.type ?? "user",
            permissions: res.data.permissions,
            app_access: res.data.app_access,
          })
        );
        try {
          await persistor.flush();
        } catch {}
        toast.success("Welcome to JFL Portal");
        let redirectPath = searchParams.get("redirect") || "/home";
        if (redirectPath.startsWith("/login")) {
          redirectPath = "/home";
        }
        window.location.assign(redirectPath);
        return;
      }
      toast.error(res.message || "Invalid credentials");
    } catch (err) {
      toast.error(err.message || "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#f8fafc] flex items-center justify-center px-4 sm:px-6 font-sans">
      <div className="w-full max-w-sm mx-auto text-center">
        <img
          src="/logo.png"
          alt="JFL ERP"
          className="h-14 sm:h-16 w-auto max-w-[12rem] sm:max-w-[14rem] mx-auto mb-5 object-contain"
        />
        <h1 className="text-xl font-bold text-slate-900">Welcome back</h1>
        <p className="text-slate-500 text-sm mt-1 mb-6">Sign in to your account to continue.</p>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                Username
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Enter your username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className={`${primaryClass} mt-2`}>
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
