"use client";
import { formatComission } from "@/core/utils/format";
import { User } from "@/core/types";
import { Button } from "@/core/components/ui/button";
import {
  AlertTriangle,
  CheckCircle,
  CircleX,
  Euro,
  Pencil,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { InputComponent } from "@/tramites/components/createTramite/InputComponent";
import { showCustomToast } from "@/core/components/CustomToast";
import { ComparativaVM } from "@/comparativas/types/comparativa.types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";

interface Props {
  userData: User;
  comparativa: ComparativaVM;
  onUpdate: () => void;
  canEdit: boolean;
  embedded?: boolean;
}

interface FormData {
  comision_fijo?: number;
  comision_indexado?: number;
  comision_sales_person_fijo?: number;
  comision_sales_person_indexado?: number;
}

interface CommissionsApiResponse {
  success?: boolean;
  error?: string;
}

type SaveResult = "close" | "keep" | "stale" | "ignored";

interface RenderRevision {
  value: string;
}

interface ActiveRequest {
  comparisonId: string;
  revision: RenderRevision;
}

type ContentProps = Omit<Props, "onUpdate"> & {
  isSaving: boolean;
  onSave: (changes: Partial<FormData>) => Promise<SaveResult>;
};

function getInitialFormData(comparativa: ComparativaVM): FormData {
  return {
    comision_fijo: comparativa.comision.fijo,
    comision_indexado: comparativa.comision.indexado,
    comision_sales_person_fijo: comparativa.comision_sales_person.fijo,
    comision_sales_person_indexado:
      comparativa.comision_sales_person.indexado,
  };
}

async function readApiResponse(
  response: Response,
): Promise<CommissionsApiResponse | null> {
  try {
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return null;
    }

    const record = payload as Record<string, unknown>;
    return {
      success:
        typeof record.success === "boolean" ? record.success : undefined,
      error: typeof record.error === "string" ? record.error : undefined,
    };
  } catch {
    return null;
  }
}

export default function ComparativaComissionsSection({
  userData,
  comparativa,
  onUpdate,
  canEdit,
  embedded = false,
}: Props) {
  const editorRevision = JSON.stringify([
    comparativa.id,
    comparativa.plan,
    comparativa.comision.fijo,
    comparativa.comision.indexado,
    comparativa.comision_sales_person.fijo,
    comparativa.comision_sales_person.indexado,
    canEdit,
  ]);
  const [pendingRequest, setPendingRequest] =
    useState<ActiveRequest | null>(null);
  const activeRequestRef = useRef<ActiveRequest | null>(null);
  const currentRevisionRef = useRef<RenderRevision | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const renderedRevision = useMemo<RenderRevision>(
    () => ({ value: editorRevision }),
    [editorRevision],
  );

  useEffect(() => {
    currentRevisionRef.current = renderedRevision;

    return () => {
      if (currentRevisionRef.current === renderedRevision) {
        currentRevisionRef.current = null;
      }
    };
  }, [renderedRevision]);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const saveCommissions = async (
    changes: Partial<FormData>,
  ): Promise<SaveResult> => {
    if (activeRequestRef.current) {
      return "ignored";
    }

    const activeRequest: ActiveRequest = {
      comparisonId: comparativa.id,
      revision: renderedRevision,
    };
    activeRequestRef.current = activeRequest;
    setPendingRequest(activeRequest);

    const requestIsCurrent = () =>
      currentRevisionRef.current === activeRequest.revision;

    try {
      const response = await fetch(
        `/api/v2/comparisons/${activeRequest.comparisonId}/commissions`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            comissions: changes,
          }),
        },
      );
      const payload = await readApiResponse(response);

      if (!requestIsCurrent()) {
        return "stale";
      }

      if (response.status === 401) {
        showCustomToast({
          title: "Sesión caducada",
          message:
            "Vuelve a iniciar sesión para guardar. Tus cambios siguen disponibles.",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return "keep";
      }

      if (response.status === 403) {
        showCustomToast({
          title: "Sin permiso para editar",
          message:
            "No tienes permiso para modificar estas comisiones. Tus cambios siguen disponibles.",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return "keep";
      }

      if (response.status === 409) {
        showCustomToast({
          title: "La comparativa ha cambiado",
          message:
            "Hemos recargado los datos para que puedas revisar las comisiones actuales.",
          iconColor: "var(--warning-color)",
          iconSize: 24,
          icon: AlertTriangle,
        });
        onUpdateRef.current();
        return "close";
      }

      if (!response.ok || payload?.success !== true) {
        showCustomToast({
          title: "No se pudieron guardar las comisiones",
          message:
            payload?.error?.trim() ||
            "No se pudieron guardar los cambios. Tus datos siguen disponibles para reintentarlo.",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return "keep";
      }

      showCustomToast({
        title: "Comisiones actualizadas",
        message: "Las comisiones se han actualizado correctamente",
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckCircle,
      });
      onUpdateRef.current();
      return "close";
    } catch {
      if (!requestIsCurrent()) {
        return "stale";
      }

      showCustomToast({
        title: "No se pudieron guardar las comisiones",
        message:
          "No se ha podido conectar. Tus cambios siguen disponibles para reintentarlo.",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
      return "keep";
    } finally {
      if (activeRequestRef.current === activeRequest) {
        activeRequestRef.current = null;
        setPendingRequest(null);
      }
    }
  };

  return (
    <ComparativaComissionsSectionContent
      key={editorRevision}
      userData={userData}
      comparativa={comparativa}
      canEdit={canEdit}
      embedded={embedded}
      isSaving={pendingRequest !== null}
      onSave={saveCommissions}
    />
  );
}

function ComparativaComissionsSectionContent({
  userData,
  comparativa,
  canEdit,
  embedded = false,
  isSaving,
  onSave,
}: ContentProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<FormData>(() =>
    getInitialFormData(comparativa),
  );

  const isComercial = userData && userData.role === "2";
  const isSubcomercial = userData && userData.role === "2" && userData.super_id;
  const hasFijo = comparativa.plan.includes("fijo");
  const hasIndexado = comparativa.plan.includes("indexado");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: parseFloat(value) || 0,
    }));
  };

  const checkChanges = () => {
    const changes: Partial<FormData> = {};

    if (hasFijo) {
      if (formData.comision_fijo !== comparativa.comision.fijo) {
        changes.comision_fijo = formData.comision_fijo;
      }
      if (
        formData.comision_sales_person_fijo !==
        comparativa.comision_sales_person.fijo
      ) {
        changes.comision_sales_person_fijo =
          formData.comision_sales_person_fijo;
      }
    }

    if (hasIndexado) {
      if (formData.comision_indexado !== comparativa.comision.indexado) {
        changes.comision_indexado = formData.comision_indexado;
      }
      if (
        formData.comision_sales_person_indexado !==
        comparativa.comision_sales_person.indexado
      ) {
        changes.comision_sales_person_indexado =
          formData.comision_sales_person_indexado;
      }
    }

    return Object.keys(changes).length > 0 ? changes : null;
  };

  const closeEditor = () => {
    setFormData(getInitialFormData(comparativa));
    setIsEditMode(false);
  };

  const handleSubmit = async () => {
    if (isSaving) {
      return;
    }

    const changes = checkChanges();

    if (!changes) {
      closeEditor();
      showCustomToast({
        title: "No se han realizado cambios",
        message: "No se han realizado cambios en el formulario",
        iconColor: "var(--warning-color)",
        iconSize: 24,
        icon: CircleX,
      });
      return;
    }

    const result = await onSave(changes);
    if (result === "close") {
      closeEditor();
    }
  };

  const getComissionText = (comission: number) => {
    if (comission === 0) {
      if (comparativa.status === "awaiting_review") {
        return "Pendiente de revisión";
      } else if (comparativa.status !== "pending") {
        return "No hay ahorro";
      }
    }

    return formatComission(comission);
  };

  const handleCancel = () => {
    closeEditor();
  };

  const content = (
    <>
      {/* Header with edit button */}
      <CardHeader className={embedded ? "p-0 pb-3" : undefined}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Euro className="h-4 w-4" />
            Comisiones
          </CardTitle>
          {canEdit && !isEditMode ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isSaving}
              onClick={() => setIsEditMode(true)}
            >
              <Pencil className="h-3 w-3 mr-1" />
              Editar
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className={embedded ? "p-0" : undefined}>
        {!isEditMode ? (
          /* View Mode */
          <div className="grid grid-cols-2 gap-6">
            {/* Organization Commissions */}
            {!isComercial && (
              <div>
                <p className="text-xs text-gray-500 mb-2">
                  {userData.organization.name}
                </p>
                <div className="space-y-1">
                  {hasFijo && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Fijo:</span>
                      <span className="font-medium text-primary-900">
                        {getComissionText(comparativa.comision.fijo)}
                      </span>
                    </div>
                  )}
                  {hasIndexado && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Indexado:</span>
                      <span className="font-medium text-primary-900">
                        {getComissionText(comparativa.comision.indexado)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sales Person Commissions */}
            {!isSubcomercial ? (
              <div>
                <p className="text-xs text-gray-500 mb-2">
                  {comparativa.user.name}
                </p>
                <div className="space-y-1">
                  {hasFijo && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Fijo:</span>
                      <span className="font-medium text-primary-900">
                        {getComissionText(
                          comparativa.comision_sales_person.fijo,
                        )}
                      </span>
                    </div>
                  )}
                  {hasIndexado && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Indexado:</span>
                      <span className="font-medium text-primary-900">
                        {getComissionText(
                          comparativa.comision_sales_person.indexado,
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          /* Edit Mode */
          <div className="space-y-4">
            {/* Organization Commissions */}
            {!isComercial && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">
                  {userData.organization.name}
                </p>
                <div className="space-y-3">
                  {hasFijo && (
                    <div>
                      <label
                        htmlFor="comision_fijo"
                        className="text-xs text-gray-500 mb-1 block"
                      >
                        Comisión Fijo
                        <span className="sr-only">
                          {" "}
                          de {userData.organization.name}
                        </span>
                      </label>
                      <InputComponent
                        label=""
                        name="comision_fijo"
                        type="number"
                        value={formData.comision_fijo?.toString() || ""}
                        onChange={handleChange}
                        disabled={isSaving}
                      />
                    </div>
                  )}
                  {hasIndexado && (
                    <div>
                      <label
                        htmlFor="comision_indexado"
                        className="text-xs text-gray-500 mb-1 block"
                      >
                        Comisión Indexado
                        <span className="sr-only">
                          {" "}
                          de {userData.organization.name}
                        </span>
                      </label>
                      <InputComponent
                        label=""
                        name="comision_indexado"
                        type="number"
                        value={formData.comision_indexado?.toString() || ""}
                        onChange={handleChange}
                        disabled={isSaving}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sales Person Commissions */}
            {!isSubcomercial ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">
                  {comparativa.user.name}
                </p>
                <div className="space-y-3">
                  {hasFijo && (
                    <div>
                      <label
                        htmlFor="comision_sales_person_fijo"
                        className="text-xs text-gray-500 mb-1 block"
                      >
                        Comisión Fijo
                        <span className="sr-only">
                          {" "}
                          de {comparativa.user.name}
                        </span>
                      </label>
                      <InputComponent
                        label=""
                        name="comision_sales_person_fijo"
                        type="number"
                        value={
                          formData.comision_sales_person_fijo?.toString() || ""
                        }
                        onChange={handleChange}
                        disabled={isSaving}
                      />
                    </div>
                  )}
                  {hasIndexado && (
                    <div>
                      <label
                        htmlFor="comision_sales_person_indexado"
                        className="text-xs text-gray-500 mb-1 block"
                      >
                        Comisión Indexado
                        <span className="sr-only">
                          {" "}
                          de {comparativa.user.name}
                        </span>
                      </label>
                      <InputComponent
                        label=""
                        name="comision_sales_person_indexado"
                        type="number"
                        value={
                          formData.comision_sales_person_indexado?.toString() ||
                          ""
                        }
                        onChange={handleChange}
                        disabled={isSaving}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                size="sm"
                aria-label="Guardar comisiones"
                aria-busy={isSaving}
                disabled={isSaving}
                onClick={handleSubmit}
                className="flex-1"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                {isSaving ? "Guardando..." : "Guardar"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label="Cancelar edición de comisiones"
                disabled={isSaving}
                onClick={handleCancel}
                className="flex-1"
              >
                <CircleX className="h-3 w-3 mr-1" />
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </>
  );

  if (embedded) {
    return <div>{content}</div>;
  }

  return (
    <Card>
      {content}
    </Card>
  );
}
