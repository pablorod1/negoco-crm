"use client";
import "../globals.css";
import { ToastBar, Toaster } from "react-hot-toast";
import { Providers } from "../providers";
import React from "react";
import { SidebarComponent } from "@/core/components/sidebar/Sidebar";
import { SidebarInset, SidebarProvider } from "@/core/components/ui/sidebar";
import Header from "@/core/components/Header";
import { PlanRedirectGuard } from "@/core/components/PlanRedirectGuard";
import { PlanGuard } from "@/core/components/PlanGuard";
import { usePathname } from "next/navigation";

const CRM_ALLOWED_PLANS = ["starter", "pro", "elite"];

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isComparadorRoute = pathname === "/comparador";
  const isPerfilRoute = pathname === "/perfil";
  const isSoporteRoute = pathname === "/soporte";
  const isAllowedForComparador =
    isComparadorRoute || isPerfilRoute || isSoporteRoute;

  return (
    <Providers>
      <PlanRedirectGuard />
      <SidebarProvider defaultOpen>
        <SidebarComponent />
        <SidebarInset>
          <div className="flex flex-col min-h-dvh min-w-0 overflow-hidden max-w-dvw">
            <Header />
            <main
              className="main-content flex-1 overflow-auto pt-12"
            >
              {isAllowedForComparador ? (
                children
              ) : (
                <PlanGuard allowedPlans={CRM_ALLOWED_PLANS}>
                  {children}
                </PlanGuard>
              )}
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
