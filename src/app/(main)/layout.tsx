"use client";
import "../globals.css";
import { ToastBar, Toaster } from "react-hot-toast";
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
          <div className="flex flex-col min-h-dvh min-w-0 overflow-hidden">
            <Header />
            <main
              className="main-content flex-1 overflow-auto"
              data-client={activeOrganization}
            >
              {children}
            </main>
            <Toaster position="bottom-center">
              {(t) => <ToastBar toast={t} />}
            </Toaster>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </Providers>
  );
}
