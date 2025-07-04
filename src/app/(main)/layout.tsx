"use client";
import "../globals.css";
import Header from "@/core/components/Header";
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
    <main data-client={activeOrganization} className={`${activeOrganization}`}>
      <Providers>
        <Toaster position="bottom-right" />
        <Header activeOrganization={activeOrganization} />
        {children}
      </Providers>
    </main>
  );
}

