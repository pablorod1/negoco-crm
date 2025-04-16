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
}: {
  content: string;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className={color}>{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
