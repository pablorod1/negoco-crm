import TooltipComponent from "@/components/core/TooltipComponent";
import { formatDate } from "@/lib/core/format";
import { InfoIcon, RefreshCcw } from "lucide-react";
import UpdateTramiteDateModal from "./dates/UpdateTramiteDateModal";

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
  return (
    <div className="space-y-1 group">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-primary-400">{label}</p>
        {tooltipContent && (
          <TooltipComponent
            color="bg-white shadow"
            content={
              <div className="max-w-sm flex items-start gap-2">
                <RefreshCcw className="size-5 text-primary-800" />
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold text-primary-800">
                    Actualización Automática
                  </h3>
                  <p className="text-primary-500">{tooltipContent}</p>
                </div>
              </div>
            }
          >
            <InfoIcon className="size-3 text-gray-600" />
          </TooltipComponent>
        )}
      </div>
      <div className="flex items-center gap-8">
        <p className="font-medium">{date ? formatDate(date) : "---"}</p>
        {date && isAdmin && (
          <UpdateTramiteDateModal
            dateToChange={label}
            date={new Date(date as string)}
            tramite_id={tramite_id}
            fieldToChange={fieldToChange}
            onUpdate={onUpdate}
          />
        )}
      </div>
    </div>
  );
}
