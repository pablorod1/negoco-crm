import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/core/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground shadow-sm hover:bg-muted/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        success: "bg-success-50 text-success-600 border-success-400",
        warning: "bg-warning-50 text-warning-600 border-warning-400",
        danger: "bg-danger-50 text-danger border-danger-400",
        info: "bg-info-50 text-info-600 border-info-400",
        pending: "bg-pending-50 text-pending-600 border-pending-400",
        secondary: "bg-secondary-50 text-secondary-600 border-secondary-400",
        successShadow:
          "bg-success-500 text-white border-0 shadow-lg shadow-success-500/50",
        dangerShadow:
          "bg-danger-500 text-white border-0 shadow-lg shadow-danger-500/50",
        shadow:
          "bg-primary-500 text-white border-0 shadow-lg shadow-primary-500/50",
        // Removed 'primary' variant as it duplicates 'shadow' variant
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

