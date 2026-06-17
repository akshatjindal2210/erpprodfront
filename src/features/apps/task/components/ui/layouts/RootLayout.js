"use client";

import { useState } from "react";
import { useSelector } from "react-redux";
import dynamic from "next/dynamic";

import RouteGuard from "@/features/apps/task/guards/RouteGuard";
import SidebarSkeleton from "../skeletons/SidebarSkeleton";
import NavbarSkeleton from "../skeletons/NavbarSkeleton";

const SidebarClient = dynamic(() => import("./Sidebar"), {
  ssr: false,
  loading: () => <SidebarSkeleton />,
});

const NavbarClient = dynamic(() => import("./Navbar"), {
  ssr: true,
  loading: () => <NavbarSkeleton />,
});

export default function RootLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const userRole = useSelector((state) => state.auth?.role) ?? "guest";
  const whoAmi   = useSelector((state) => state.auth?.user) ?? null;

  return (
    <RouteGuard>
      <div className="flex h-screen bg-white">

        <SidebarClient
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          userRole={userRole}
          currentUser={whoAmi}
        />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

          <NavbarClient
            setSidebarOpen={setSidebarOpen}
            userRole={userRole}
            whoAmi={whoAmi}
          />

          <main className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50/30">
            <div className="w-full h-full animate-in fade-in duration-500">
              {children}
            </div>
          </main>

        </div>

      </div>
    </RouteGuard>
  );
}
