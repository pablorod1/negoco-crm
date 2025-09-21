"use client";

import { cn } from "@/core/utils";
import { AnimatedList } from "@/core/components/magicui/animated-list";
import { formatDateTime } from "@/core/utils/format";
import { User } from "@/core/types";
import AvatarComponent from "@/core/components/AvatarComponent";
import { useEffect } from "react";
import { ComparativaVM } from "@/comparativas/types";
import { getStatusBadge } from "@/core/hooks/use-status-badge";
import { useSidebarSlideNavigation } from "@/core/view-transitions/useGenieEffect";

const ComparativaItem = (comparativa: ComparativaVM) => {
  const handleSidebarClick = useSidebarSlideNavigation();
  return (
    <figure
      className={cn(
        "relative mx-auto min-h-fit h-full max-w-[800px] w-full overflow-hidden rounded-lg p-4",
        // Minimalist animation - subtle and purposeful
        "transition-all duration-200 ease-out hover:bg-gray-50",
        // Clean minimalist styling - white background, subtle border
        "bg-white border border-gray-200",
        "hover:shadow"
      )}
    >
      <a
        href={`/comparativas/${comparativa.id}`}
        onClick={handleSidebarClick}
        className="group flex flex-row items-center gap-4 relative"
      >
        <div className="relative">
          <div className="flex size-12 items-center justify-center rounded-lg bg-gray-100 border border-gray-200">
            <AvatarComponent userData={comparativa.user as User} />
          </div>
        </div>

        <div className="flex flex-col overflow-hidden w-full min-w-0">
          <div className="flex justify-between items-start w-full mb-2">
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900 truncate group-hover:text-gray-700 transition-colors duration-200">
                  {comparativa.client}
                </h3>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {getStatusBadge(comparativa.status, "comparativa")}
                  <div className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-md">
                    Ver detalles
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="font-medium">
                  {comparativa.user.name ?? "Desconocido"}
                </span>
                <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                <span className="text-xs">
                  {formatDateTime(comparativa.creation_date)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </a>
    </figure>
  );
};

export function ComparativasAnimatedList({
  className,
  items,
}: {
  className?: string;
  items: ComparativaVM[];
}) {
  useEffect(() => {
    const container = document.getElementById("ComparativasAnimatedList");
    if (!container) return;

    const handleMouseEnter = () => {
      document.body.style.overflow = "hidden";
    };

    const handleMouseLeave = () => {
      document.body.style.overflow = "";
    };

    container.addEventListener("mouseenter", handleMouseEnter);
    container.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      container.removeEventListener("mouseenter", handleMouseEnter);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div
      id="ComparativasAnimatedList"
      className={cn(
        "relative flex max-h-[280px] h-full w-full flex-col overflow-y-auto gap-3 py-2",
        // Clean scrollbar styling
        "scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300",
        "mask-t-from-95% mask-b-from-95%",
        className
      )}
    >
      {items.length > 0 ? (
        <AnimatedList>
          {items.map((item) => (
            <ComparativaItem {...item} key={item.id} />
          ))}
        </AnimatedList>
      ) : (
        items[0] && <ComparativaItem {...items[0]} />
      )}
    </div>
  );
}
