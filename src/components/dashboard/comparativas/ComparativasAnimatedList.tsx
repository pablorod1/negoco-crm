"use client";

import { cn } from "@/lib/core/utils";
import { AnimatedList } from "@/components/magicui/animated-list";
import { ExternalLink } from "lucide-react";
import { formatDateTime } from "@/lib/core/format";
import Link from "next/link";
import { ComparativaVM, User } from "@/lib/core/types";
import AvatarComponent from "@/components/core/AvatarComponent";
import { useEffect } from "react";

const Notification = (comparativa: ComparativaVM) => {
  return (
    <figure
      className={cn(
        "relative mx-auto min-h-fit h-full max-w-[800px] w-full overflow-hidden rounded-2xl p-4",
        // animation styles
        "transition-all duration-200 ease-in-out hover:scale-[101%]",
        // light styles
        "bg-white [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]",
        // dark styles
        "transform-gpu dark:bg-transparent dark:backdrop-blur-md dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset]"
      )}
    >
      <Link
        href={`/comparativas/${comparativa.id}`}
        className="group flex flex-row items-center gap-3"
      >
        <div
          className="flex size-10 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: "var(--primary-color-100)",
          }}
        >
          <AvatarComponent userData={comparativa.user as User} />
        </div>
        <div className="flex flex-col overflow-hidden w-full">
          <div className="flex justify-between items-center w-full">
            <figcaption className="flex flex-row items-center whitespace-pre text-lg font-medium dark:text-white ">
              <span className="text-sm sm:text-lg">{comparativa.client}</span>
              <span className="mx-1">·</span>
              <span className="text-sm sm:text-lg">
                {comparativa.user.name || "Desconocido"}
              </span>

              <span className="mx-1">·</span>
              <span className="text-xs text-gray-500">
                {formatDateTime(comparativa.creation_date)}
              </span>
            </figcaption>
          </div>
          <p className="flex items-center gap-2 text-primary-500 text-sm font-normal dark:text-white/60 group-hover:underline">
            {comparativa.id}
            <ExternalLink className="size-4" />
          </p>
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
          {items.map((item, idx) => (
            <Notification {...item} key={idx} />
          ))}
        </AnimatedList>
      ) : (
        <Notification {...items[0]} />
      )}
    </div>
  );
}
