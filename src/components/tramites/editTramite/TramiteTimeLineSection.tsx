import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TramiteDB } from "@/lib/core/types";
import { Clock } from "lucide-react";
import TimelineItem from "./TimelineItem";

interface Props {
  tramite: TramiteDB;
  isComercial: boolean;
  onUpdate?: () => void;
}

export default function TramiteTimeLineSection({
  tramite,
  isComercial,
  onUpdate,
}: Props) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary-800">
          <Clock className="h-5 w-5" />
          Línea de Tiempo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex flex-col gap-4">
            <TimelineItem
              label="Fecha de Creación"
              date={tramite.creation_date}
              tramite_id={tramite.id}
            />

            {!isComercial && (
              <TimelineItem
                label="Fecha de Tramitación"
                date={tramite.tramitation_date}
                tooltipContent="La fecha de tramitación se asignará cuando el estado del trámite cambie a Verificado."
                tramite_id={tramite.id}
                fieldToChange="tramitation_date"
                onUpdate={onUpdate}
                isAdmin={!isComercial}
              />
            )}
          </div>
          {isComercial && (
            <TimelineItem
              label="Fecha de Tramitación"
              date={tramite.tramitation_date}
              tooltipContent="La fecha de tramitación se asignará cuando el estado del trámite cambie a Verificado."
              tramite_id={tramite.id}
              fieldToChange="tramitation_date"
              onUpdate={onUpdate}
              isAdmin={!isComercial}
            />
          )}
          <div className="flex flex-col gap-4">
            <TimelineItem
              label="Fecha de Activación"
              date={tramite.activation_date}
              tooltipContent="La fecha de activación se asignará cuando el estado del trámite cambie a Activo."
              tramite_id={tramite.id}
              fieldToChange="activation_date"
              onUpdate={onUpdate}
              isAdmin={!isComercial}
            />

            {!isComercial && (
              <TimelineItem
                label="Fecha de Renovación"
                date={tramite.renovation_date}
                tooltipContent="La fecha de renovación se asignará cuando el estado del trámite cambie a Activo."
                tramite_id={tramite.id}
                fieldToChange="renovation_date"
                onUpdate={onUpdate}
                isAdmin={!isComercial}
              />
            )}
          </div>
          {!isComercial && (
            <div className="flex flex-col gap-4">
              <TimelineItem
                label="Fecha de Cobro"
                date={tramite.collection_date}
                tooltipContent="La fecha de activación se asignará cuando el estado de liquidez del trámite cambie a Cobrado por Comercializadora."
                tramite_id={tramite.id}
                fieldToChange="collection_date"
                onUpdate={onUpdate}
                isAdmin={!isComercial}
              />

              <TimelineItem
                label="Fecha de Pago"
                date={tramite.payment_date}
                tooltipContent="La fecha de renovación se asignará cuando el estado de liquidez del trámite cambie a Pagado al Comercial."
                tramite_id={tramite.id}
                fieldToChange="payment_date"
                onUpdate={onUpdate}
                isAdmin={!isComercial}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
