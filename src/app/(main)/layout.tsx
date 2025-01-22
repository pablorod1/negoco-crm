import "../globals.css";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SidebarComponent } from "@/components/core/sidebar/Sidebar";
import Header from "@/components/core/Header";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <SidebarComponent />
      <SidebarInset>
        <Header />

        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
