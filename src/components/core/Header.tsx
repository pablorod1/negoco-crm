import Link from "next/link";
import Image from "next/image";
import NavigationMenuComponent from "./NavigationMenu";
import NotificationsMenu from "./NotificationsMenu";
import { NavUser } from "./sidebar/NavUser";
import { cn } from "@/lib/core/utils";
import { Separator } from "@/components/ui/separator";

export default function Header({
  activeOrganization,
}: {
  activeOrganization: string;
}) {
  return (
    <header className="sticky top-0 z-50 bg-white backdrop-blur-lg border-b border-border/40 shadow-sm">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src={
                activeOrganization === "beenergy"
                  ? "/beenergy/favicon.png"
                  : "/logo_200x200.png"
              }
              alt="Logo"
              width={36}
              height={36}
              className={cn(
                "transition-all duration-300",
                activeOrganization === "beenergy" ? "w-8 h-8" : "w-9 h-9"
              )}
            />
            <span className="font-semibold text-primary hidden sm:inline-block">
              {activeOrganization === "beenergy" ? "BeEnergy" : "Negoco"}
            </span>
          </Link>

          <NavigationMenuComponent activeOrganization={activeOrganization} />
        </div>

        <div className="flex items-center">
          {/* Status indicator - only on desktop */}
          <div className="hidden xl:flex items-center mr-6">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-50 text-xs font-medium text-primary">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Conectado
            </div>
          </div>

          {/* Notifications with separator */}
          <div className="flex items-center">
            <NotificationsMenu />
            <Separator
              orientation="vertical"
              className="mx-4 h-6 hidden sm:block"
            />
            <div className="hidden sm:block">
              <NavUser />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
