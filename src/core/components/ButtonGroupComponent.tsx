"use client";
import { Button } from "@/core/components/ui/button";
import CancelOperationConfirmationModal from "@/core/components/CancelOperationConfirmationModal";

interface ButtonGroupProps {
  onBack?: () => void;
  onSubmit: () => void;
  onCancel?: () => void;
  lastStep?: boolean;
  loading?: boolean;
  submitDisabled?: boolean;
  submitLabel?: string;
}

export default function ButtonGroupComponent({
  onBack,
  onSubmit,
  onCancel,
  lastStep,
  loading,
  submitDisabled,
  submitLabel,
}: ButtonGroupProps) {
  const defaultSubmitLabel = lastStep ? "Guardar" : "Siguiente";

  return (
    <div className="flex justify-between items-center w-full mt-4 z-10">
      {onCancel && (
        <CancelOperationConfirmationModal
          disabled={loading}
          onCancel={onCancel}
        />
      )}
      <div className="flex justify-end gap-4 w-full">
        {onBack && (
          <Button onClick={onBack} variant="destructive" disabled={loading}>
            Atrás
          </Button>
        )}
        <Button
          onClick={onSubmit}
          disabled={loading || submitDisabled}
          type="button"
        >
          {loading ? "Guardando..." : submitLabel || defaultSubmitLabel}
        </Button>
      </div>
    </div>
  );
}
