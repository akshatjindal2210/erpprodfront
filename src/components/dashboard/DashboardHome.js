import React from "react";

export default function DashboardHome() {
  return (
    <div className="flex flex-col items-center justify-center bg-slate-100" >

      {/* 1. Bada Logo Container */}
      <div className="w-80 h-80 md:w-[450px] md:h-[450px] mt-10 mb-8"> 
        <img 
          src="/logo.png" 
          alt="Logo" 
          className="w-full h-full object-contain" 
        />
      </div>

      {/* 2. Welcome Text */}
      <div className="text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold text-slate-800 tracking-tight">
          Welcome to <span className="text-blue-600">Dashboard</span>
        </h1>
        {/* <p className="mt-4 text-slate-500 text-lg md:text-xl">Manage everything in one place.</p> */}
      </div>
    </div>
  );
}