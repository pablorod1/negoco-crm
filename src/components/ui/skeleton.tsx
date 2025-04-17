import { cn } from "@/lib/core/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-primary-500/10", className)}
      {...props}
    />
  );
}

export { Skeleton };
