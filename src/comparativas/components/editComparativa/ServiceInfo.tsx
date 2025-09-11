import { Flame, Lightbulb } from "lucide-react";
import { cn } from "@/core/utils";

interface ServiceInfoProps {
  service: "Luz" | "Gas";
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const ServiceInfo = ({
  service,
  className = "",
  size = "md",
}: ServiceInfoProps) => {
  const isElectric = service === "Luz";

  const sizeClasses = {
    sm: "text-xs px-2 py-1 gap-1",
    md: "text-sm px-3 py-1.5 gap-1.5",
    lg: "text-base px-4 py-2 gap-2",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full font-medium transition-colors",
        isElectric
          ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
          : "bg-orange-50 text-orange-700 border border-orange-200",
        sizeClasses[size],
        className
      )}
    >
      {isElectric ? (
        <Lightbulb className={cn(iconSizes[size], "text-yellow-600")} />
      ) : (
        <Flame className={cn(iconSizes[size], "text-orange-600")} />
      )}
      <span>{service}</span>
    </div>
  );
};
