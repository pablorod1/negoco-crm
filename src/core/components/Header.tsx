"use client";

import { SidebarTrigger } from "@/core/components/ui/sidebar";
import { Separator } from "@/core/components/ui/separator";
import { Skeleton } from "@/core/components/ui/skeleton";
import Image from "next/image";
import { cn } from "@/core/utils/utils";
import SmartBreadcrumb from "./SmartBreadcrumbFixed";
import { useUser } from "../contexts/UserContext";
import NotificationsMenu from "./NotificationsMenu";
import { getOrganizationLogo } from "@/core/branding/client";

interface ImprovedHeaderProps {
  className?: string;
}

export default function Header({ className }: ImprovedHeaderProps) {
  const { userData, loading, getPlan } = useUser();
  const isComparadorPlan = getPlan() === "comparador";

  const organization = userData && userData.organization;
  const { name } = organization ? organization : { name: null };
  const organizationLogo = getOrganizationLogo(organization);

  return (
    <header
      className={cn(
        "fixed top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        "px-6 py-1 transition-all duration-200 ease-in-out",
        "group-has-data-[collapsible=icon]/sidebar-wrapper:px-4",
        className
      )}
    >
      <div className="flex h-12 items-center justify-between gap-4 w-full pr-12">
        {/* Left section - Navigation */}
        <div className="flex items-center gap-4 ">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="h-8 w-8 text-muted-foreground hover:text-foreground transition-colors" />
            <Separator
              orientation="vertical"
              className="h-6 w-px bg-border opacity-60"
            />
          </div>

          <div>
            {!isComparadorPlan && (
              <SmartBreadcrumb
                variant="minimal"
                showBackButton={true}
                maxItems={4}
              />
            )}
          </div>
        </div>

        {/* Right section - Logo */}
        <div className="flex items-center">
          {!loading && userData ? (
            <div className="relative">
              <Image
                src={organizationLogo.defaultUrl}
                alt={organizationLogo.alt || name || "Negoco Cloud"}
                className="h-full w-auto max-w-32 object-contain transition-opacity hover:opacity-80"
                width={organizationLogo.width}
                height={organizationLogo.height}
                priority
              />
            </div>
          ) : (
            <Skeleton className="h-8 w-8 rounded-full" />
          )}
        </div>

        <div>
          <NotificationsMenu />
        </div>
      </div>
    </header>
  );
}
