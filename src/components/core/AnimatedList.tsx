"use client";

import { cn } from "@/lib/core/utils";
import { AnimatedList } from "../magicui/animated-list";
import { ExternalLink, RefreshCcw } from "lucide-react";
import { formatDateTime } from "@/lib/core/format";
import Link from "next/link";

interface RenewableTramite {
  id: string;
  renovationDate: string;
  sales_name: string;
}

const Notification = ({ id, renovationDate, sales_name }: RenewableTramite) => {
  return (
    <figure
      className={cn(
        "relative mx-auto min-h-fit h-full max-w-[700px] w-full overflow-hidden rounded-2xl p-4",
        // animation styles
        "transition-all duration-200 ease-in-out hover:scale-[101%]",
        // light styles
        "bg-white [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]",
        // dark styles
        "transform-gpu dark:bg-transparent dark:backdrop-blur-md dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset]"
      )}
    >
      <Link
        href={`/tramites?id=${id}`}
        className="group flex flex-row items-center gap-3"
      >
        <div
          className="flex size-10 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: "var(--primary-color-100)",
          }}
        >
          <span className="text-lg">
            <RefreshCcw className="text-[var(--primary-color-800)]" />
          </span>
        </div>
        <div className="flex flex-col overflow-hidden">
          <figcaption className="flex flex-row items-center whitespace-pre text-lg font-medium dark:text-white ">
            <span className="text-sm sm:text-lg">{sales_name}</span>
            <span className="mx-1">·</span>
            <span className="text-xs text-gray-500">
              {formatDateTime(renovationDate)}
            </span>
          </figcaption>
          <p className="flex items-center gap-2 text-[var(--primary-color-500)] text-sm font-normal dark:text-white/60 group-hover:underline">
            {id}
            <ExternalLink className="size-4" />
          </p>
        </div>
      </Link>
    </figure>
  );
};

export function AnimatedListDemo({
  className,
  items,
}: {
  className?: string;
  items: RenewableTramite[];
}) {
  return (
    <div
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
