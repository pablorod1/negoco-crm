import { ClipboardList, Flame, Lightbulb } from "lucide-react";

interface ServiceInfoProps {
  service: "Luz" | "Gas";
  tramiteId?: string;
}

export const ServiceInfo = ({ service, tramiteId }: ServiceInfoProps) => {
  const serviceIcon =
    service === "Luz" ? (
      <Lightbulb className="h-5 w-5 text-yellow-500" />
    ) : (
      <Flame className="h-5 w-5 text-orange-500" />
    );

  return (
    <>
      <div className="flex items-center gap-1">
        {serviceIcon}
        <span>Servicio: {service}</span>
      </div>
      {tramiteId && (
        <div className="flex items-center gap-1 ml-4">
          <ClipboardList className="h-4 w-4" />
          <span>Trámite: {tramiteId}</span>
        </div>
      )}
    </>
  );
};
