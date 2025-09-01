"use client";
import "../globals.css";
import Header from "@/core/components/Header";
import { Toaster } from "react-hot-toast";
import { Providers } from "../providers";
import React, { useEffect, useState } from "react";
import { SidebarComponent } from "@/core/components/sidebar/Sidebar";
import { SidebarInset } from "@/core/components/ui/sidebar";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [activeOrganization, setActiveOrganization] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setActiveOrganization(window.location.hostname.split(".")[0]);
    }
  }, []);

  return (
    <main data-client={activeOrganization} className={`${activeOrganization}`}>
      <Providers>
        <div className="flex h-screen w-full">
          <SidebarComponent />
          <SidebarInset className="flex flex-col flex-1">
            <div className="flex-1 overflow-auto">{children}</div>
          </SidebarInset>
        </div>
        <Toaster position="bottom-right" />
      </Providers>
    </main>
  );
}
