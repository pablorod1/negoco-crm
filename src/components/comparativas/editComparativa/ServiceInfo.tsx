import { Flame, Lightbulb } from "lucide-react";

interface ServiceInfoProps {
  service: "Luz" | "Gas";
}

export const ServiceInfo = ({ service }: ServiceInfoProps) => {
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
        <span className="text-primary-400">Servicio: {service}</span>
      </div>
    </>
  );
};
