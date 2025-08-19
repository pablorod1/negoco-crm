"use client";

import { cn } from "@/core/utils";
import { AnimatedList } from "@/core/components/magicui/animated-list";
import { formatDateTime } from "@/core/utils/format";
import { Link } from "next-view-transitions";
import { User } from "@/core/types";
import AvatarComponent from "@/core/components/AvatarComponent";
import { useEffect } from "react";
import { ComparativaVM } from "@/comparativas/types";

const ComparativaItem = (comparativa: ComparativaVM) => {
  return (
    <figure
      className={cn(
        "relative mx-auto min-h-fit h-full max-w-[800px] w-full overflow-hidden rounded-xl p-3",
        // animation styles
        "transition-all duration-300 ease-in-out hover:scale-[102%] hover:-translate-y-1",
        // light styles
        "bg-gradient-to-br from-white to-gray-50/50 border border-gray-100/80",
        "shadow-sm hover:shadow-lg hover:shadow-primary-500/10"
      )}
    >
      <Link
        href={`/comparativas/${comparativa.id}`}
        className="group flex flex-row items-center gap-4 relative"
      >
        <div className="relative">
          <div
            className="flex size-12 items-center justify-center rounded-xl shadow-sm ring-2 ring-white/50"
            style={{
              backgroundColor: "var(--primary-color-100)",
            }}
          >
            <AvatarComponent userData={comparativa.user as User} />
          </div>
        </div>

        <div className="flex flex-col overflow-hidden w-full min-w-0">
          <div className="flex justify-between items-start w-full mb-2">
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 truncate group-hover:text-primary-600 transition-colors duration-200">
                  {comparativa.client}
                </h3>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="px-2 py-1 bg-primary-50 text-primary-600 text-xs font-medium rounded-md">
                    Ver detalles
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="font-medium">
                  {comparativa.user.name || "Desconocido"}
                </span>
                <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                <span className="text-xs">
                  {formatDateTime(comparativa.creation_date)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
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
        "relative flex max-h-[340px] h-full w-full flex-col overflow-y-auto p-2",
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
        <ComparativaItem {...items[0]} />
      )}
    </div>
  );
}
