"use client";
import "../globals.css";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SidebarComponent } from "@/components/core/sidebar/Sidebar";
import Header from "@/components/core/Header";
import { Toaster } from "react-hot-toast";
import { TramitesProvider } from "@/contexts/TramitesContext";
import { UserProvider } from "@/contexts/UserContext";
import { UsersProvider } from "@/contexts/UsersContext";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <UserProvider>
      <UsersProvider>
        <SidebarProvider defaultOpen={false}>
          <Toaster position="bottom-right" />
          <SidebarComponent />
          <SidebarInset>
            <Header />
            <TramitesProvider>{children}</TramitesProvider>
          </SidebarInset>
        </SidebarProvider>
      </UsersProvider>
    </UserProvider>
  );
}
