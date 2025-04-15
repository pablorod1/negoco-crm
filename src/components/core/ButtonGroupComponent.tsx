import { Button } from "@/components/ui/button";
import CancelOperationConfirmationModal from "@/components/core/CancelOperationConfirmationModal";

interface ButtonGroupProps {
  onBack?: () => void;
  onSubmit: () => void;
  onCancel?: () => void;
  lastStep?: boolean;
  loading?: boolean;
}

export default function ButtonGroupComponent({
  onBack,
  onSubmit,
  onCancel,
  lastStep,
  loading,
}: ButtonGroupProps) {
  return (
    <div className="flex justify-between items-center w-full mt-4">
      {onCancel && <CancelOperationConfirmationModal onCancel={onCancel} />}
      <div className="flex justify-end gap-4 w-full">
        {onBack && (
          <Button onClick={onBack} variant="destructive">
            Atrás
          </Button>
        )}
        <Button onClick={onSubmit}>
          {lastStep ? "Guardar" : loading ? "Guardando..." : "Siguiente"}
        </Button>
      </div>
    </div>
  );
}
