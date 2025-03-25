"use client";
import "../globals.css";
import { SidebarInset } from "@/components/ui/sidebar";
import { SidebarComponent } from "@/components/core/sidebar/Sidebar";
import Header from "@/components/core/Header";
import { Toaster } from "react-hot-toast";
import { Providers } from "../providers";
import React, { useEffect, useState } from "react";

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
    <main data-client={activeOrganization} className="px-2">
      <Providers>
        <Toaster position="bottom-right" />
        <SidebarComponent />
        <SidebarInset>
          <Header />
          {children}
        </SidebarInset>
      </Providers>
    </main>
  );
}
