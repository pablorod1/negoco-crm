"use client";
import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

export default function TooltipComponent({
  content,
  children,
  color,
  placement = "top",
  disabled = false,
}: {
  content: string | React.ReactNode;
  children: React.ReactNode;
  color?: string;
  placement?: "top" | "bottom" | "left" | "right" | undefined;
  disabled?: boolean;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger disabled={disabled} asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent side={placement} className={color}>
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
