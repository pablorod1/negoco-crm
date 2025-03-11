"use client";
import "../globals.css";
import { SidebarInset } from "@/components/ui/sidebar";
import { SidebarComponent } from "@/components/core/sidebar/Sidebar";
import Header from "@/components/core/Header";
import { Toaster } from "react-hot-toast";
import { inter } from "@/fonts/fonts";

import { Providers } from "../providers";
import React from "react";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const activeOrganization = window
    ? window.location.hostname.split(".")[0]
    : "";
  return (
    <body
      data-client={activeOrganization ? activeOrganization : ""}
      className={`${inter.className} antialiased `}
    >
      <Providers>
        <Toaster position="bottom-right" />
        <SidebarComponent />
        <SidebarInset>
          <Header />
          {children}
        </SidebarInset>
      </Providers>
    </body>
  );
}
