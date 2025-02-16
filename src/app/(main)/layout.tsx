import "../globals.css";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SidebarComponent } from "@/components/core/sidebar/Sidebar";
import Header from "@/components/core/Header";
import { Toaster } from "react-hot-toast";
import { TramitesProvider } from "@/contexts/TramitesContext";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider defaultOpen={false}>
      <Toaster position="top-right" />
      <SidebarComponent />
      <SidebarInset>
        <Header />
        <TramitesProvider>{children}</TramitesProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
