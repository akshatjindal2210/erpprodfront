"use client";

import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import { Lock, Loader2, User, Eye, EyeOff } from "lucide-react";
import { setCredentials } from "@/platform/store/slices/authSlice";
import { persistor } from "@/platform/store/index";
import { userService } from "@/common/auth/services/userService";
import { applyListViewSpanFromSession } from "@/platform/utils/global";
import { linkPushSubscriptionToUser } from "@/common/pwa/webPushSubscribe";

const loginFont = {
  fontFamily: "'Montserrat', 'Poppins', ui-sans-serif, sans-serif",
};

const cardStyle = {
  background: "rgba(6, 14, 24, 0.90)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(56, 116, 179, 0.35)",
  borderRadius: "16px",
  boxShadow:
    "0 0 0 1px rgba(45, 110, 180, 0.15), 0 0 30px rgba(10, 50, 100, 0.45), 0 20px 45px rgba(0, 0, 0, 0.8)",
};

const inputClass =
  "w-full h-11 pl-11 pr-11 rounded-lg text-[13.5px] font-medium text-[#82888d] placeholder:text-[#50647c] outline-none border border-[#1b2b3e] bg-[#050a12] focus:border-[#2b6cb0] focus:ring-1 focus:ring-[#2b6cb0] transition-all ";

const btnStyle = {
  background: "linear-gradient(180deg, #1d509e 0%, #113a78 50%, #0a2754 100%)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.18), 0 4px 15px rgba(10, 40, 90, 0.6)",
  borderRadius: "8px",
};

export default function UserLogin() {
  const dispatch = useDispatch();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    const fontId = "login-montserrat-font";
    if (!document.getElementById(fontId)) {
      const link = document.createElement("link");
      link.id = fontId;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap";
      document.head.appendChild(link);
    }

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await userService.login({ username: email, password });
      if (res.success) {
        let profile = res.data;
        try {
          const meRes = await userService.me();
          if (meRes?.success && meRes.data) {
            profile = { ...profile, ...meRes.data };
          }
        } catch {
          /* login payload is enough to continue */
        }
        applyListViewSpanFromSession(profile);
        dispatch(
          setCredentials({
            id: profile.id,
            name: profile.name,
            email: profile.email,
            role: profile.role ?? profile.type ?? "user",
            type: profile.type ?? profile.role ?? "user",
            designation: profile.designation ?? null,
            designation_name:
              profile.designation_name ?? profile.designation?.name ?? null,
            department: profile.department ?? null,
            department_id:
              profile.department_id ?? profile.department?.id ?? null,
            permissions: profile.permissions,
            app_access: profile.app_access,
          })
        );
        try {
          await persistor.flush();
        } catch {}
        void linkPushSubscriptionToUser({ userId: profile.id }).catch(() => {});
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
    <div
      className="fixed inset-0 z-0 flex justify-center items-start overflow-hidden bg-[#070c14]"
      style={loginFont}
    >
      {/* Background Image: Absolute Edge-to-Edge Fill */}
      <img
        src="/bg_img.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none fixed top-0 left-0 w-screen h-screen m-0 p-0 border-none outline-none"
        style={{ objectFit: "fill" }}
      />

      {/* Login Card Overlay - Lowered & Enlarged */}
      <div className="relative z-10 w-full max-w-[400px] mx-auto mt-[38vh] px-4 pb-10">
        <div className="w-full px-7 py-7" style={cardStyle}>
          <div className="text-center mb-6">
            <h1
              className="text-white"
              style={{
                fontSize: "16px",
                fontWeight: 600,
                letterSpacing: "0.22em",
                color: "#dfe4e9",
                lineHeight: 1.2,
              }}
            >
              WELCOME BACK
            </h1>
            <p
              className="mt-1.5"
              style={{
                fontSize: "12px",
                fontWeight: 400,
                color: "#82888d",
                letterSpacing: "0.01em",
              }}
            >
              Login to your ERP account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div className="relative">
              <User
                size={16}
                strokeWidth={1.75}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4f637a] pointer-events-none"
              />
              <input
                type="text"
                placeholder="Username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
                style={loginFont}
              />
            </div>

            <div className="relative">
              <Lock
                size={16}
                strokeWidth={1.75}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4f637a] pointer-events-none"
              />
              <input
                type={showPass ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={inputClass}
                style={loginFont}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4f637a] hover:text-[#a0aec0] transition-colors"
                aria-label={showPass ? "Hide password" : "Show password"}
              >
                {showPass ? (
                  <Eye size={16} strokeWidth={1.75} />
                ) : (
                  <EyeOff size={16} strokeWidth={1.75} />
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 mt-1 text-white flex items-center justify-center gap-2 disabled:opacity-50 hover:brightness-110 transition-all"
              style={{
                ...btnStyle,
                ...loginFont,
                fontSize: "13px",
                fontWeight: 600,
                color: "#dfe4e9",
                letterSpacing: "0.2em",
              }}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "LOGIN"
              )}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}