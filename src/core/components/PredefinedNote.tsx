"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { UserDefaultNote } from "@/core/types";
import { Button } from "@/core/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/core/components/ui/popover";

export function PredefinedNote({ note }: { note: UserDefaultNote }) {
  const previewRef = useRef<HTMLParagraphElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useLayoutEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;

    const updateOverflow = () => {
      setIsOverflowing(preview.scrollHeight > preview.clientHeight + 1);
    };
    const animationFrame = requestAnimationFrame(updateOverflow);
    const resizeObserver = new ResizeObserver(updateOverflow);
    resizeObserver.observe(preview);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, [note.note]);

  return (
    <div className="min-w-0 rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2.5">
      <p
        ref={previewRef}
        className="line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed text-gray-700 [overflow-wrap:anywhere]"
      >
        {note.note}
      </p>
      {isOverflowing ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="mt-1 h-auto px-0 py-0 text-xs"
            >
              Mostrar más
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={8}
            className="w-[min(32rem,calc(100vw-2rem))] rounded-2xl p-0"
          >
            <div className="border-b border-gray-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Nota predefinida
              </p>
            </div>
            <div className="max-h-[min(60vh,28rem)] overflow-y-auto px-4 py-3">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 [overflow-wrap:anywhere]">
                {note.note}
              </p>
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
