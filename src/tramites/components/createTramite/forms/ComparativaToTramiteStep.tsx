import FormWrapper from "../FormWrapper";
import { SelectComponent } from "../InputComponent";
import { User } from "@/core/types";
import ButtonGroupComponent from "@/core/components/ButtonGroupComponent";
import { ScrollArea } from "@/core/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { getStatusBadge } from "@/core/hooks/use-status-badge";
import {
  formatComission,
  formatFileSize,
  formatUUID,
} from "@/core/utils/format";
import { ComparativaVM, ComparativaStatus } from "@/comparativas/types";
import { useEnergySupplierById } from "@/comercializadoras/hooks/useEnergySupplierById";
import { Badge } from "@/core/components/ui/badge";
import {
  FileText,
  User as UserIcon,
  Building,
  Euro,
  Zap,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { useState } from "react";

interface Props {
  comparativa: ComparativaVM;
  onSubmit: () => void;
  onCancel: () => void;
  plan: "fijo" | "indexado" | undefined;
  setPlan: React.Dispatch<
    React.SetStateAction<"fijo" | "indexado" | undefined>
  >;
  userData: User;
}

export default function ComparativaToTramiteStep({
  comparativa,
  onSubmit,
  onCancel,
  setPlan,
  plan,
  userData,
}: Props) {
  const { supplier } = useEnergySupplierById(comparativa.company_id);
  const company_name = supplier?.name;
  const isComercial = userData.role === "2";
  const isSubcomercial = userData.role === "2" && userData.super_id;
  const [showDetails, setShowDetails] = useState(false);

  const handleChange = (value: string) => {
    setPlan(value as "fijo" | "indexado");
  };

  const checkFijoEmpty = () => {
    return (
      comparativa.comision.fijo === 0 &&
      comparativa.comision_sales_person.fijo === 0
    );
  };

  const checkIndexadoEmpty = () => {
    return (
      comparativa.comision.indexado === 0 &&
      comparativa.comision_sales_person.indexado === 0
    );
  };

  const handleSubmit = () => {
    onSubmit();
  };

  return (
    <FormWrapper>
      {/* Step Header - Clear and Focused */}
      <div className="space-y-2 mb-6">
        <div className="flex items-center gap-2">
          <Building className="h-5 w-5 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-900">
            Crear trámite desde comparativa
          </h2>
        </div>
        <p className="text-sm text-gray-600">
          Selecciona el plan tarifario y revisa la información de la comparativa
          antes de continuar
        </p>
      </div>

      {/* Plan Selection - Primary Action */}
      <div className="grid grid-cols-2 gap-6">
        <Card className="bg-primary-50 border-primary-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Euro className="h-4 w-4 text-primary-600" />
                <h3 className="text-sm font-medium text-gray-900">
                  Plan Tarifario
                </h3>
                <Badge variant="secondary" className="text-xs">
                  Requerido
                </Badge>
              </div>
              <div className="w-full max-w-44">
                <SelectComponent
                  name="plan"
                  label=""
                  selectedKey={plan as string}
                  onChange={handleChange}
                  items={
                    checkFijoEmpty()
                      ? ["indexado"]
                      : checkIndexadoEmpty()
                        ? ["fijo"]
                        : ["fijo", "indexado"]
                  }
                />
              </div>
            </div>
            {plan && (
              <div className="mt-4 p-3 bg-white rounded-lg border border-primary-100">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {!isComercial ? (
                    <div>
                      <span className="text-gray-600">Comisión:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {formatComission(comparativa.comision[plan])}
                      </span>
                    </div>
                  ) : null}
                  {!isSubcomercial ? (
                    <div>
                      <span className="text-gray-600">
                        Comisión {!isComercial ? "Comercial" : ""}:
                      </span>
                      <span className="ml-2 font-medium text-gray-900">
                        {formatComission(
                          comparativa.comision_sales_person[plan],
                        )}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Comparativa Summary - Essential Info Only */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-gray-600" />
                <CardTitle className="text-base text-gray-900">
                  {comparativa.client} • #{formatUUID(comparativa.id)}
                </CardTitle>
              </div>
              {getStatusBadge(
                comparativa.status as ComparativaStatus,
                "comparativa",
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Comercial:</span>
                <p className="font-medium text-gray-900">
                  {comparativa.user.name}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Servicio:</span>
                <p className="font-medium text-gray-900">
                  {comparativa.service}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Compañía:</span>
                <p className="font-medium text-gray-900">{company_name}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Abarca Study Data Summary */}
      {comparativa.abarca_estudio && (
        <Card className="mb-4 border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-sm font-medium text-gray-700">
                Datos del Estudio Abarca
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Titular:</span>
                <p className="font-medium text-gray-900">
                  {comparativa.abarca_estudio.nombre_completo || "—"}
                </p>
              </div>
              <div>
                <span className="text-gray-500">DNI:</span>
                <p className="font-medium text-gray-900">
                  {comparativa.abarca_estudio.dni || "—"}
                </p>
              </div>
              <div>
                <span className="text-gray-500">CUPS:</span>
                <p className="font-medium text-gray-900 break-all">
                  {comparativa.abarca_estudio.cups}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Tarifa:</span>
                <p className="font-medium text-gray-900">
                  {comparativa.abarca_estudio.tipo_tarifa || "—"}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Email:</span>
                <p className="font-medium text-gray-900">
                  {comparativa.abarca_estudio.email || "—"}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Teléfono:</span>
                <p className="font-medium text-gray-900">
                  {comparativa.abarca_estudio.movil || "—"}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Dirección:</span>
                <p className="font-medium text-gray-900">
                  {[
                    comparativa.abarca_estudio.calle_cups,
                    comparativa.abarca_estudio.numero_cups,
                  ]
                    .filter(Boolean)
                    .join(" ") || "—"}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Localidad:</span>
                <p className="font-medium text-gray-900">
                  {[
                    comparativa.abarca_estudio.localidad_cups,
                    comparativa.abarca_estudio.codpostal_cups,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progressive Disclosure - Additional Details */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => setShowDetails(!showDetails)}
          className="w-full justify-between text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50"
        >
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Ver detalles adicionales ({
              comparativa.files.length
            } documentos, {comparativa.notes ? comparativa.notes.length : 0}{" "}
            notas)
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${showDetails ? "rotate-180" : ""}`}
          />
        </Button>

        {showDetails && (
          <div className="mt-4 space-y-4">
            <ScrollArea className="h-full w-full max-h-[200px]">
              <div className="space-y-4 px-2">
                {/* Documents */}
                {comparativa.files.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-gray-700">
                        Documentos ({comparativa.files.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {comparativa.files.map((doc, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded-md text-xs"
                          >
                            <span className="text-gray-900 truncate">
                              {doc.filename}
                            </span>
                            <span className="text-gray-500 ml-2 flex-shrink-0">
                              {formatFileSize(Number(doc.size))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Notes */}
                {comparativa.notes && comparativa.notes.length > 0 ? (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-gray-700">
                        Notas ({comparativa.notes.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {comparativa.notes.map((note, index) => (
                          <div
                            key={index}
                            className="p-2 bg-gray-50 rounded-md text-xs text-gray-900"
                          >
                            {note}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      <ButtonGroupComponent onSubmit={handleSubmit} onCancel={onCancel} />
    </FormWrapper>
  );
}
