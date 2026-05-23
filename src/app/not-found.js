'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, Search, AlertTriangle } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full text-center">
        {/* Animated Icon Container */}
        <div className="relative mb-8 inline-block">
          <div className="absolute inset-0 bg-indigo-100 rounded-full blur-2xl opacity-60 animate-pulse"></div>
          <div className="relative w-24 h-24 bg-white rounded-3xl shadow-xl shadow-indigo-100 border border-indigo-50 flex items-center justify-center mx-auto transform rotate-12 hover:rotate-0 transition-transform duration-500">
            <Search size={48} className="text-indigo-600" strokeWidth={1.5} />
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg border-4 border-white">
              <AlertTriangle size={14} fill="currentColor" />
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-3">
          <h1 className="text-7xl font-black text-slate-900 tracking-tighter">
            404
          </h1>
          <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">
            Lost in the Cloud?
          </h2>
          <p className="text-slate-500 text-sm leading-relaxed max-w-[280px] mx-auto">
            The page you're looking for doesn't exist or has been moved to a new location.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Home size={16} />
            Back to Home
          </Link>
          <button
            onClick={() => router.back()}
            className="w-full sm:w-auto px-8 py-3.5 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
          >
            Go Back
          </button>
        </div>

        {/* Footer Info */}
        <div className="mt-12 pt-8 border-t border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
            JFL ERP Portal
          </p>
        </div>
      </div>
    </main>
  );
}
