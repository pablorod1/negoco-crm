import { Button } from "@heroui/button";
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
    <div className="flex justify-between items-center w-full mb-2">
      {onCancel && <CancelOperationConfirmationModal onCancel={onCancel} />}
      <div className="flex justify-end gap-4 w-full">
        {onBack && (
          <Button onPress={onBack} variant="light" color="danger" radius="sm">
            Atrás
          </Button>
        )}
        <Button onPress={onSubmit} variant="ghost" color="primary" radius="sm">
          {lastStep ? "Guardar" : loading ? "Guardando..." : "Siguiente"}
        </Button>
      </div>
    </div>
  );
}
