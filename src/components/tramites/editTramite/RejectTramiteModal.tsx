"use client";
import ButtonGroupComponent from "@/components/core/ButtonGroupComponent";
import LoadingStateModal from "@/components/core/LoadingStateModal";
import TooltipComponent from "@/components/core/TooltipComponent";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { TramiteVM, User } from "@/lib/core/types";
import { getStatusBadge } from "@/lib/hooks/use-status-badge";
import { useState } from "react";
import { SelectComponent } from "../createTramite/InputComponent";
import { BAJA_LIQUIDEZ_STATUS, STATUS_TYPES } from "@/lib/core/const";
import { showCustomToast } from "@/components/core/CustomToast";
import { CircleX } from "lucide-react";

interface Props {
  tramite: TramiteVM;
  userData: User;
  onSubmit: () => void;
}

export default function RejectTramiteModal({
  tramite,
  userData,
  onSubmit,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [liquidezStatus, setLiquidezStatus] = useState(
    "Pendiente de Descontar"
  );

  const handleFieldChange = (value: string) => {
    setLiquidezStatus(value);
  };

  const onClose = () => setIsOpen(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/tramites/update/${tramite.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "Baja",
            liquidez_status: liquidezStatus,
            user_id: userData.id,
            comision: Math.abs(-tramite.comision),
            comision_sales_person: Math.abs(-tramite.comision_sales_person),
          }),
        }
      );

      const { success, error } = await response.json();

      if (!success) {
        showCustomToast({
          title: "Error al dar de baja el trámite",
          message: error,
          icon: CircleX,
          iconSize: 24,
          iconColor: "var(--danger-color)",
        });
        return;
      }

      showCustomToast({
        title: "Trámite dado de baja",
        message: "El trámite ha sido dado de baja correctamente.",
        icon: CircleX,
        iconSize: 24,
        iconColor: "var(--success-color)",
      });
      setIsOpen(false);
      onSubmit();
    } catch (error) {
      showCustomToast({
        title: "Error al dar de baja el trámite",
        message: "Error al dar de baja el trámite. Inténtalo de nuevo.",
        icon: CircleX,
        iconSize: 24,
        iconColor: "var(--danger-color)",
      });
      console.error("Error al dar de baja el trámite:", error);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog open={isOpen} modal>
      <DialogTrigger asChild>
        <Button variant="destructiveDropdown" onClick={() => setIsOpen(true)}>
          Dar de baja
        </Button>
      </DialogTrigger>
      <DialogContent className="[&>button]:hidden overflow-auto max-h-[90vh]">
        <DialogHeader
          className="flex flex-row items-start justify-between space-y-0 pb-2"
          aria-describedby="modal-description"
        >
          <div className="flex flex-col">
            <DialogTitle className="text-xl font-semibold text-danger">
              Dar de baja el trámite
            </DialogTitle>
            <DialogDescription>
              <TooltipComponent content="ID del trámite">
                <span className="text-xs text-danger-400">#{tramite.id}</span>
              </TooltipComponent>
            </DialogDescription>
          </div>

          {getStatusBadge(tramite.status)}
        </DialogHeader>

        <Separator className="my-1" />

        <>
          {/* Información del trámite */}
          {loading && (
            <LoadingStateModal
              title="Actualizando trámite..."
              description="Espere unos segundos mientras actualizamos el estado del trámite."
            />
          )}
          <div className="space-y-6">
            <SelectComponent
              label="Estado"
              selectedKey="Baja"
              items={STATUS_TYPES}
              disabled
              name="status"
              onChange={() => {}}
            />
            <SelectComponent
              label="Estado de liquidez"
              selectedKey={liquidezStatus}
              items={BAJA_LIQUIDEZ_STATUS}
              name="liquidez_status"
              onChange={handleFieldChange}
            />
          </div>
        </>
        <DialogFooter>
          <ButtonGroupComponent
            onCancel={onClose}
            onSubmit={handleSubmit}
            lastStep
            loading={loading}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
