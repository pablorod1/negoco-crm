import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/core/format";
import { TramiteDB } from "@/lib/core/types";
import { Tooltip } from "@heroui/tooltip";
import { Clock, InfoIcon, RefreshCcw } from "lucide-react";

interface Props {
  tramite: TramiteDB;
  isComercial: boolean;
}

export default function TramiteTimeLineSection({
  tramite,
  isComercial,
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
            <div className="space-y-1">
              <p className="text-sm font-medium text-primary-400">
                Fecha de Creación
              </p>
              <p className="font-medium ">
                {formatDate(tramite.creation_date)}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-primary-400">
                  Fecha de Tramitación
                </p>
                <Tooltip
                  radius="sm"
                  content={
                    <div className="max-w-sm flex items-start gap-2">
                      <RefreshCcw className="size-5 text-primary-800" />
                      <div className="flex flex-col gap-1">
                        <h3 className=" font-semibold text-primary-800">
                          Actualización Automática
                        </h3>
                        <p className="text-primary-500">
                          La fecha de tramitación se asignará cuando el estado
                          del trámite cambie a <strong>Verificado</strong>.
                        </p>
                      </div>
                    </div>
                  }
                >
                  <InfoIcon className="size-3 text-gray-600" />
                </Tooltip>
              </div>
              <p className="font-medium ">
                {tramite.tramitation_date
                  ? formatDate(tramite.tramitation_date)
                  : "---"}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-primary-400">
                  Fecha de Activación
                </p>
                <Tooltip
                  radius="sm"
                  content={
                    <div className="max-w-sm flex items-start gap-2">
                      <RefreshCcw className="size-5 text-primary-800" />
                      <div className="flex flex-col gap-1">
                        <h3 className=" font-semibold text-primary-800">
                          Actualización Automática
                        </h3>
                        <p className="text-primary-500">
                          La fecha de activación se asignará cuando el estado
                          del trámite cambie a <strong>Activo</strong>.
                        </p>
                      </div>
                    </div>
                  }
                >
                  <InfoIcon className="size-3 text-gray-600" />
                </Tooltip>
              </div>
              <p className="font-medium ">
                {tramite.activation_date
                  ? formatDate(tramite.activation_date)
                  : "---"}
              </p>
            </div>

            {!isComercial && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-primary-400">
                    Fecha de Renovación
                  </p>
                  <Tooltip
                    radius="sm"
                    content={
                      <div className="max-w-sm flex items-start gap-2">
                        <RefreshCcw className="size-5 text-primary-800" />
                        <div className="flex flex-col gap-1">
                          <h3 className=" font-semibold text-primary-800">
                            Actualización Automática
                          </h3>
                          <p className="text-primary-500">
                            La fecha de renovación se asignará cuando el estado
                            del trámite cambie a <strong>Activo</strong>.
                          </p>
                        </div>
                      </div>
                    }
                  >
                    <InfoIcon className="size-3 text-gray-600" />
                  </Tooltip>
                </div>
                <p className="font-medium ">
                  {tramite.renovation_date
                    ? formatDate(tramite.renovation_date)
                    : "---"}
                </p>
              </div>
            )}
          </div>
          {!isComercial && (
            <div className="flex flex-col gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-primary-400">
                    Fecha de Cobro
                  </p>
                  <Tooltip
                    radius="sm"
                    content={
                      <div className="max-w-sm flex items-start gap-2">
                        <RefreshCcw className="size-5 text-primary-800" />
                        <div className="flex flex-col gap-1">
                          <h3 className=" font-semibold text-primary-800">
                            Actualización Automática
                          </h3>
                          <p className="text-primary-500">
                            La fecha de activación se asignará cuando el estado
                            de liquidez del trámite cambie a{" "}
                            <strong>Cobrado por Comercializadora</strong>.
                          </p>
                        </div>
                      </div>
                    }
                  >
                    <InfoIcon className="size-3 text-gray-600" />
                  </Tooltip>
                </div>
                <p className="font-medium ">
                  {tramite.collection_date
                    ? formatDate(tramite.collection_date)
                    : "---"}
                </p>
              </div>

              {!isComercial && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-primary-400">
                      Fecha de Pago
                    </p>
                    <Tooltip
                      radius="sm"
                      content={
                        <div className="max-w-sm flex items-start gap-2">
                          <RefreshCcw className="size-5 text-primary-800" />
                          <div className="flex flex-col gap-1">
                            <h3 className=" font-semibold text-primary-800">
                              Actualización Automática
                            </h3>
                            <p className="text-primary-500">
                              La fecha de renovación se asignará cuando el
                              estado de liquidez del trámite cambie a{" "}
                              <strong>Pagado al Comercial</strong>.
                            </p>
                          </div>
                        </div>
                      }
                    >
                      <InfoIcon className="size-3 text-gray-600" />
                    </Tooltip>
                  </div>
                  <p className="font-medium ">
                    {tramite.payment_date
                      ? formatDate(tramite.payment_date)
                      : "---"}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
