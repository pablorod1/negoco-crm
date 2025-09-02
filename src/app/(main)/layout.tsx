"use client";
import "../globals.css";
import { Toaster } from "react-hot-toast";
import { Providers } from "../providers";
import React, { useEffect, useState } from "react";
import { SidebarComponent } from "@/core/components/sidebar/Sidebar";
import { SidebarInset, SidebarProvider } from "@/core/components/ui/sidebar";
import Header from "@/core/components/Header";

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
    <Providers>
      <SidebarProvider defaultOpen={false}>
        <SidebarComponent />
        <SidebarInset>
          <div>
            <Header />
            <main className="main-content" data-client={activeOrganization}>
              {children}
            </main>
            <Toaster position="bottom-right" />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </Providers>
  );
}
