"use client";
import React from "react";
import Image from "next/image";

export default function DashboardHome({ title = "Dashboard", appType = null }) {
  return (
    <div className="flex flex-col items-center justify-center bg-slate-100 min-h-full pb-12">

      <div 
        className="w-80 h-80 md:w-[450px] md:h-[450px] mt-6 mb-4 relative select-none"
        onContextMenu={(e) => e.preventDefault()}
      >
        <Image
          src="/logo.png"
          alt="Logo"
          fill
          sizes="(max-width: 768px) 320px, 450px"
          className="object-contain"
          priority
          draggable={false}
        />
      </div>

      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-6xl font-extrabold text-slate-800 tracking-tight">
          Welcome to <span className="text-blue-600">{title}</span>
        </h1>
      </div>
    </div>
  );
}