"use client";
import Link from "next/link";
import Image from "next/image";
import NotificationsMenu from "./NotificationsMenu";
import NavUser from "./sidebar/NavUser";
import { cn } from "@/core/utils";
import { Separator } from "@/core/components/ui/separator";
import { useUser } from "@/core/contexts/UserContext";
import ShortcutsMenu from "./ShortcutsMenu";
import NavigationMenuComponent from "./NavigationMenu";

export default function Header({
  activeOrganization,
}: {
  activeOrganization: string;
}) {
  const { getPlan, userData } = useUser();
  const isComercial = userData?.role === "2";
  return (
    <header className="sticky top-0 z-50 bg-white backdrop-blur-lg border-b border-border/40 shadow-sm">
      <div className="container mx-auto flex items-center justify-between px-4 ">
        <div className="flex items-center gap-6">
          <Link href="/">
            <Image
              src={
                activeOrganization === "beenergy"
                  ? "/beenergy.png"
                  : "/logo_inline.png"
              }
              alt="Logo"
              width={200}
              height={200}
              className={cn("transition-all duration-300", "w-44 h-auto")}
            />
          </Link>

          <NavigationMenuComponent activeOrganization={activeOrganization} />
        </div>

        <div className="flex items-center gap-4">
          {/* Status indicator - only on desktop */}
          {!isComercial && (
            <div className="hidden xl:flex items-center">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-50 text-xs font-medium text-primary capitalize">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                {getPlan()}
              </div>
            </div>
          )}
          <ShortcutsMenu />

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
