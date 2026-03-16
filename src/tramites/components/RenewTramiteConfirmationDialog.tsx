"use client";
import {
  ArrowRightLeft,
  Calendar,
  ChevronRight,
  CircleX,
  Info,
  RefreshCcw,
  Shield,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/core/components/ui/dialog";
import { Button } from "@/core/components/ui/button";
import { Checkbox } from "@/core/components/ui/checkbox";
import { Switch } from "@/core/components/ui/switch";
import { Label } from "@/core/components/ui/label";
import { Badge } from "@/core/components/ui/badge";
import { Separator } from "@/core/components/ui/separator";
import { DatePicker } from "@/core/components/DatePicker";
import { SelectComponent } from "./createTramite/InputComponent";
import LoadingStateModal from "@/core/components/LoadingStateModal";

import { showCustomToast } from "@/core/components/CustomToast";
import { Notification } from "@/core/types";
import { ClientDB, TramiteVM } from "@/tramites/types";
import { formatDate, formatUUID } from "@/core/utils/format";
import { useState } from "react";
import { useUser } from "@/core/contexts/UserContext";
import { useActiveEnergySuppliers } from "@/comercializadoras/hooks/useActiveEnergySuppliers";

interface Props {
  tramite: TramiteVM;
  client: ClientDB;
  onRenew: () => void;
}

interface RenewalFormData {
  activation_date: Date;
  renovation_date: Date;
  company_changed: boolean;
  new_company_id: string;
}

export default function RenewTramiteConfirmationDialog({
  tramite,
  onRenew,
  client,
}: Props) {
  const { userData } = useUser();

  const initialActivationDate = new Date(tramite.renovation_date);
  const initialRenovationDate = new Date(
    initialActivationDate.getFullYear() + 1,
    initialActivationDate.getMonth(),
    initialActivationDate.getDate()
  );

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendNotification, setSendNotification] = useState(true);
  const [formData, setFormData] = useState<RenewalFormData>({
    activation_date: initialActivationDate,
    renovation_date: initialRenovationDate,
    company_changed: false,
    new_company_id: "",
  });

  const { activeSuppliers, loading: suppliersLoading } =
    useActiveEnergySuppliers();

  const onClose = () => setIsOpen(false);
  const onOpen = () => setIsOpen(true);

  const renewalNumber = (tramite.renewal_count || 0) + 1;

  const handleDateChange = (date: Date, name: string) => {
    if (date) {
      setFormData((prev) => ({
        ...prev,
        [name]: date,
        ...(name === "activation_date" && {
          renovation_date: new Date(
            date.getFullYear() + 1,
            date.getMonth(),
            date.getDate()
          ),
        }),
      }));
    }
  };

  const handleRenewTramite = async () => {
    if (!userData) return;

    if (formData.company_changed && !formData.new_company_id) {
      showCustomToast({
        title: "Compañía no seleccionada",
        message:
          "Debes seleccionar la nueva compañía si has indicado cambio de compañía.",
        iconColor: "var(--warning-color)",
        iconSize: 24,
        icon: CircleX,
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/v2/contracts/${tramite.id}/renewal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userData.id,
          activation_date: formData.activation_date.toISOString(),
          renovation_date: formData.renovation_date.toISOString(),
          company_changed: formData.company_changed,
          new_company_id: formData.company_changed
            ? formData.new_company_id
            : undefined,
        }),
      });

      const { success, error } = await res.json();

      if (!success) {
        showCustomToast({
          title: "Error al renovar el trámite",
          message: error || "Error desconocido",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      if (sendNotification) {
        const notification: Notification = {
          id: tramite.id,
          title: "Trámite renovado",
          message: `El trámite ${formatUUID(tramite.id)} ha sido renovado.`,
          created_at: new Date().toISOString(),
          context: "Tramites",
          link: tramite.id,
          priority: 3,
          user_id: tramite.user_id,
        };

        const notificationRes = await fetch(`/api/v2/notifications`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ notification }),
        });

        const { success: notificationSuccess, error: notificationError } =
          await notificationRes.json();

        if (!notificationSuccess) {
          showCustomToast({
            title: "Error al enviar notificación",
            message: notificationError,
            iconColor: "var(--danger-color)",
            iconSize: 24,
            icon: CircleX,
          });
        }
      }

      showCustomToast({
        title: "Trámite renovado",
        message: `El trámite ha sido renovado correctamente. ${
          sendNotification ? `Se ha notificado a ${tramite.user.name}` : ""
        }`,
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: RefreshCcw,
      });
      onRenew();
      onClose();
    } catch (error) {
      showCustomToast({
        title: "Error al renovar el trámite",
        message: "Inténtalo de nuevo más tarde",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const supplierItems = activeSuppliers.map((s) => ({
    label: s.name,
    value: s.id,
  }));

  const selectedSupplierName =
    activeSuppliers.find((s) => s.id === formData.new_company_id)?.name || "";

  return (
    <>
      <Dialog open={isOpen}>
        <DialogTrigger asChild>
          <Button onClick={onOpen} className="gap-2">
            <RefreshCcw size={16} />
            Renovar Trámite
          </Button>
        </DialogTrigger>
        <DialogContent className="py-0 w-full max-w-lg max-h-[90vh] overflow-auto [&>button]:hidden">
          {/* Header with renewal count */}
          <DialogHeader className="sticky top-0 z-10 bg-white pt-5 pb-4 border-b" aria-describedby={undefined}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary-100">
                  <RefreshCcw className="text-primary-700" size={20} />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold text-gray-900">
                    Renovar Trámite
                  </DialogTitle>
                  <p className="text-sm text-gray-500">
                    {formatUUID(tramite.id)} &middot; {client.name} {client.last_name}
                  </p>
                </div>
              </div>
              <Badge variant={renewalNumber === 1 ? "info" : "warning"} className="tabular-nums">
                Renovación #{renewalNumber}
              </Badge>
            </div>
          </DialogHeader>

          {loading && (
            <LoadingStateModal
              title="Renovando trámite..."
              description="Espere unos segundos mientras procesamos la renovación."
            />
          )}

          <div className="space-y-5 py-4">
            {/* Previous renewal indicator */}
            {tramite.renewal_count > 0 && (
              <div className="flex items-center gap-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                <Shield size={16} className="text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-700">
                  Este trámite ha sido renovado{" "}
                  <span className="font-semibold">{tramite.renewal_count}</span>{" "}
                  {tramite.renewal_count === 1 ? "vez" : "veces"} anteriormente.
                </p>
              </div>
            )}

            {/* Date transition visualization */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Calendar size={15} className="text-gray-500" />
                Fechas del nuevo periodo
              </h3>

              {/* Current → New dates */}
              <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-3">
                <div className="text-center p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Activación actual</p>
                  <p className="text-sm font-semibold text-gray-700">{formatDate(tramite.activation_date)}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
                <div className="text-center p-3 rounded-lg bg-primary-50 border border-primary-200">
                  <p className="text-[11px] font-medium text-primary-400 uppercase tracking-wider mb-1">Nueva activación</p>
                  <DatePicker
                    date={formData.activation_date}
                    setDate={(value) =>
                      handleDateChange(value as Date, "activation_date")
                    }
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-3">
                <div className="text-center p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Renovación actual</p>
                  <p className="text-sm font-semibold text-gray-700">{formatDate(tramite.renovation_date)}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
                <div className="text-center p-3 rounded-lg bg-primary-50 border border-primary-200">
                  <p className="text-[11px] font-medium text-primary-400 uppercase tracking-wider mb-1">Nueva renovación</p>
                  <DatePicker
                    date={formData.renovation_date}
                    setDate={(value) =>
                      handleDateChange(value as Date, "renovation_date")
                    }
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Company change */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft size={15} className="text-gray-500" />
                  <Label
                    htmlFor="company_changed"
                    className="text-sm font-semibold text-gray-700 cursor-pointer"
                  >
                    Cambio de compañía
                  </Label>
                </div>
                <Switch
                  id="company_changed"
                  checked={formData.company_changed}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      company_changed: checked,
                      new_company_id: checked ? prev.new_company_id : "",
                    }))
                  }
                />
              </div>

              {formData.company_changed && (
                <div className="pl-6 border-l-2 border-primary-200">
                  <SelectComponent
                    name="new_company_id"
                    label="Nueva compañía"
                    items={supplierItems}
                    onChange={(value) =>
                      setFormData((prev) => ({ ...prev, new_company_id: value }))
                    }
                    selectedKey={formData.new_company_id}
                    textValue={selectedSupplierName}
                    isRequired
                    disabled={suppliersLoading}
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Automatic changes — compact list */}
            <div className="rounded-lg bg-blue-50/60 border border-blue-100 px-4 py-3">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Info size={13} />
                Cambios automáticos
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs bg-white border-blue-200 text-blue-700">
                  Estado → Pendiente de Firma
                </Badge>
                <Badge variant="outline" className="text-xs bg-white border-blue-200 text-blue-700">
                  Liquidez → Reiniciada
                </Badge>
                <Badge variant="outline" className="text-xs bg-white border-blue-200 text-blue-700">
                  Contrato → Renovación
                </Badge>
              </div>
            </div>

            {/* Notification checkbox */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <Checkbox
                aria-label={`Notificar a ${tramite.user?.name || "el usuario"}`}
                checked={sendNotification}
                onCheckedChange={(checked) =>
                  setSendNotification(checked as boolean)
                }
                className="mt-0.5 rounded-md"
              />
              <div>
                <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                  Notificar a{" "}
                  <span className="text-primary-700">
                    {tramite.user?.name || "el usuario"}
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Se enviará una notificación informando sobre la renovación.
                </p>
              </div>
            </label>
          </div>

          {/* Footer */}
          <DialogFooter className="sticky bottom-0 bg-white border-t py-4 gap-2">
            <Button variant="outline" onClick={onClose} className="px-5">
              Cancelar
            </Button>
            <Button
              onClick={handleRenewTramite}
              disabled={loading}
              className="px-5 gap-2"
            >
              <RefreshCcw size={15} />
              Confirmar renovación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
