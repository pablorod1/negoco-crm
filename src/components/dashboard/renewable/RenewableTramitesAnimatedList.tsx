"use client";

import { cn } from "@/lib/core/utils";
import { AnimatedList } from "@/components/magicui/animated-list";
import { formatDateTime } from "@/lib/core/format";
import { Link } from "next-view-transitions";
import { useEffect } from "react";
import Image from "next/image";

interface RenewableTramite {
  id: string;
  renovationDate: string;
  sales_name: string;
}

const RenewableTramite = ({
  id,
  renovationDate,
  sales_name,
}: RenewableTramite) => {
  return (
    <figure
      className={cn(
        "relative mx-auto min-h-fit h-full w-full overflow-hidden rounded-xl p-3",
        // animation styles
        "transition-all duration-300 ease-in-out hover:scale-[102%] hover:-translate-y-1",
        // light styles
        "bg-gradient-to-br from-white to-gray-50/50 border border-gray-100/80",
        "shadow-sm hover:shadow-lg hover:shadow-primary-500/10"
      )}
    >
      <Link
        href={`/tramites/${id}`}
        className="group flex flex-row items-center gap-4 relative"
      >
        <div className="relative">
          <div className="flex size-12 items-center justify-center rounded-xl shadow-sm ring-2 ring-white/50 bg-primary-50">
            <Image
              src="/icons/renovacion.webp"
              alt="Renovación Icon"
              width={24}
              height={24}
            />
          </div>
        </div>

        <div className="flex flex-col overflow-hidden w-full min-w-0">
          <div className="flex justify-between items-start w-full mb-2">
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 truncate group-hover:text-primary-600 transition-colors duration-200">
                  {sales_name}
                </h3>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="px-2 py-1 bg-primary-50 text-primary-500 text-xs font-medium rounded-md">
                    Ver trámite
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="text-xs">
                  {formatDateTime(renovationDate)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </figure>
  );
};

export function RenewableTramitesAnimatedList({
  className,
  items,
}: {
  className?: string;
  items: RenewableTramite[];
}) {
  useEffect(() => {
    const container = document.getElementById("RenewableAnimatedList");
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
      id="RenewableAnimatedList"
      className={cn(
        "relative flex max-h-[340px] h-full w-full flex-col overflow-y-auto p-2",
        className
      )}
    >
      {items.length > 0 ? (
        <AnimatedList>
          {items.map((item) => (
            <RenewableTramite {...item} key={item.id} />
          ))}
        </AnimatedList>
      ) : (
        <RenewableTramite {...items[0]} />
      )}
    </div>
  );
}
