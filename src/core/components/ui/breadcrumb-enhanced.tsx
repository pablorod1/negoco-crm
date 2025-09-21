"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/core/utils";
import Link from "next/link";

const BreadcrumbEnhanced = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<"nav"> & {
    separator?: React.ReactNode;
  }
>(({ className, ...props }, ref) => (
  <nav ref={ref} aria-label="breadcrumb" className={cn(className)} {...props} />
));
BreadcrumbEnhanced.displayName = "BreadcrumbEnhanced";

const BreadcrumbEnhancedList = React.forwardRef<
  HTMLOListElement,
  React.ComponentPropsWithoutRef<"ol">
>(({ className, ...props }, ref) => (
  <ol
    ref={ref}
    className={cn(
      "flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5",
      className
    )}
    {...props}
  />
));
BreadcrumbEnhancedList.displayName = "BreadcrumbEnhancedList";

const BreadcrumbEnhancedItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentPropsWithoutRef<"li">
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn("inline-flex items-center gap-1.5", className)}
    {...props}
  />
));
BreadcrumbEnhancedItem.displayName = "BreadcrumbEnhancedItem";

const BreadcrumbEnhancedLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<typeof Link> & {
    asChild?: boolean;
  }
>(({ className, asChild, ...props }, ref) => {
  if (asChild) {
    return <React.Fragment {...props} />;
  }

  return (
    <Link
      ref={ref}
      className={cn(
        "transition-colors hover:text-foreground focus:text-foreground focus:outline-none",
        className
      )}
      {...props}
    />
  );
});
BreadcrumbEnhancedLink.displayName = "BreadcrumbEnhancedLink";

const BreadcrumbEnhancedPage = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<"span">
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    role="link"
    aria-disabled="true"
    aria-current="page"
    className={cn("font-medium text-foreground", className)}
    {...props}
  />
));
BreadcrumbEnhancedPage.displayName = "BreadcrumbEnhancedPage";

const BreadcrumbEnhancedSeparator = ({
  children,
  className,
  ...props
}: React.ComponentProps<"li">) => (
  <li
    role="presentation"
    aria-hidden="true"
    className={cn("[&>svg]:size-3.5", className)}
    {...props}
  >
    {children ?? <ChevronRight />}
  </li>
);
BreadcrumbEnhancedSeparator.displayName = "BreadcrumbEnhancedSeparator";

const BreadcrumbEnhancedEllipsis = ({
  className,
  ...props
}: React.ComponentProps<"span">) => (
  <span
    role="presentation"
    aria-hidden="true"
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    {...props}
  >
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
    >
      <path
        d="M3.625 7.5C3.625 8.12132 3.12132 8.625 2.5 8.625C1.87868 8.625 1.375 8.12132 1.375 7.5C1.375 6.87868 1.87868 6.375 2.5 6.375C3.12132 6.375 3.625 6.87868 3.625 7.5ZM8.625 7.5C8.625 8.12132 8.12132 8.625 7.5 8.625C6.87868 8.625 6.375 8.12132 6.375 7.5C6.375 6.87868 6.87868 6.375 7.5 6.375C8.12132 6.375 8.625 6.87868 8.625 7.5ZM13.625 7.5C13.625 8.12132 13.1213 8.625 12.5 8.625C11.8787 8.625 11.375 8.12132 11.375 7.5C11.375 6.87868 11.8787 6.375 12.5 6.375C13.1213 6.375 13.625 6.87868 13.625 7.5Z"
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
    <span className="sr-only">Más elementos</span>
  </span>
);
BreadcrumbEnhancedEllipsis.displayName = "BreadcrumbEnhancedEllipsis";

export {
  BreadcrumbEnhanced,
  BreadcrumbEnhancedList,
  BreadcrumbEnhancedItem,
  BreadcrumbEnhancedLink,
  BreadcrumbEnhancedPage,
  BreadcrumbEnhancedSeparator,
  BreadcrumbEnhancedEllipsis,
};
