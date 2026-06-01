"use client";
import React from "react";
import Image from "next/image";

export default function DashboardHome({ title = "Dashboard" }) {
  return (
    <div className="flex flex-col items-center justify-center bg-slate-100 min-h-full">

      <div 
        className="w-80 h-80 md:w-[450px] md:h-[450px] mt-10 mb-8 relative select-none"
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

      <div className="text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold text-slate-800 tracking-tight">
          Welcome to <span className="text-blue-600">{title}</span>
        </h1>
        {/* <p className="mt-4 text-slate-500 text-lg md:text-xl">Manage everything in one place.</p> */}
      </div>
    </div>
  );
}