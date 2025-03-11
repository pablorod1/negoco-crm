import { SidebarTrigger } from "../ui/sidebar";
import NotificationsMenu from "./NotificationsMenu";

export default function Header() {
  return (
    <header className="border-b sticky top-0 bg-white/80 z-50 backdrop-blur-lg">
      <div className="flex items-center justify-between px-6 py-4">
        <SidebarTrigger />
        <div className="flex items-center space-x-4">
          <NotificationsMenu />
        </div>
      </div>
    </header>
  );
}
