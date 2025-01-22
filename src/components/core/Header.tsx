import { Bell, User } from "lucide-react";
import { Button } from "../ui/button";
import { SidebarTrigger } from "../ui/sidebar";

export default function Header() {
  return (
    <header className="border-b">
      <div className="flex items-center justify-between px-6 py-4">
        <SidebarTrigger />
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon">
            <Bell className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <User className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
