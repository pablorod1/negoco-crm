import { cn } from "@/core/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-gray-100 z-50", className)}
      {...props}
    />
  );
}

export { Skeleton };

