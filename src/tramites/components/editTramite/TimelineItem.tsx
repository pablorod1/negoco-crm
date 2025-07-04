import TooltipComponent from "@/core/components/TooltipComponent";
import { formatDate } from "@/core/utils/format";
import { InfoIcon, RefreshCcw } from "lucide-react";
import UpdateTramiteDateModal from "./dates/UpdateTramiteDateModal";
import { cn } from "@/core/utils";

interface TimelineItemProps {
  label: string;
  date: string | null;
  tooltipContent?: string;
  tramite_id: string;
  fieldToChange?: string;
  onUpdate?: () => void;
  isAdmin?: boolean;
}

export default function TimelineItem({
  label,
  date,
  tooltipContent,
  tramite_id,
  fieldToChange,
  onUpdate,
  isAdmin,
}: TimelineItemProps) {
  // Determine status based on date presence
  const hasDate = date && date !== "---";

  return (
    <div className="group px-3 py-2.5 transition-colors hover:bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div
            className={cn(
              "w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-300",
              hasDate
                ? fieldToChange === "rejected_date"
                  ? "bg-danger shadow-sm shadow-danger/20"
                  : "bg-primary-500 shadow-sm shadow-primary-500/20"
                : "bg-gray-200"
            )}
          />

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "text-sm font-medium tracking-tight",
                  fieldToChange === "rejected_date"
                    ? "text-danger"
                    : hasDate
                      ? "text-gray-900"
                      : "text-gray-500"
                )}
              >
                {label}
              </span>

              {tooltipContent && (
                <TooltipComponent
                  color="bg-white shadow-md"
                  content={
                    <div className="flex items-start gap-2 p-2.5 max-w-xs">
                      <RefreshCcw className="size-4 text-primary-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-medium text-gray-800 text-sm">
                          Actualización Automática
                        </h3>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {tooltipContent}
                        </p>
                      </div>
                    </div>
                  }
                >
                  <InfoIcon className="size-3 text-gray-400 hover:text-primary-400 transition-colors cursor-help" />
                </TooltipComponent>
              )}
            </div>

            <span
              className={cn(
                "text-sm mt-0.5",
                hasDate ? "text-gray-600 font-medium" : "text-gray-400"
              )}
            >
              {hasDate ? formatDate(date as string) : "Pendiente"}
            </span>
          </div>
        </div>

        {hasDate && isAdmin && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <UpdateTramiteDateModal
              dateToChange={label}
              date={new Date(date as string)}
              tramite_id={tramite_id}
              fieldToChange={fieldToChange}
              onUpdate={onUpdate}
            />
          </div>
        )}
      </div>
    </div>
  );
}

