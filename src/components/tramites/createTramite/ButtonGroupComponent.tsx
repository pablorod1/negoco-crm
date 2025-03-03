import { Button } from "@heroui/react";
import CancelCreateTramiteConfirmationModal from "./CancelCreateTramiteConfirmationModal";

interface ButtonGroupProps {
  onBack?: () => void;
  onSubmit: () => void;
  onCancel?: () => void;
  lastStep?: boolean;
}

export default function ButtonGroupComponent({
  onBack,
  onSubmit,
  onCancel,
  lastStep,
}: ButtonGroupProps) {
  return (
    <div className="flex justify-between items-center w-full mb-2">
      {onCancel && <CancelCreateTramiteConfirmationModal onCancel={onCancel} />}
      <div className="flex justify-end gap-4 w-full">
        {onBack && (
          <Button onPress={onBack} variant="solid" color="danger" radius="sm">
            Atrás
          </Button>
        )}
        <Button onPress={onSubmit} variant="ghost" color="primary" radius="sm">
          {lastStep ? "Guardar" : "Siguiente"}
        </Button>
      </div>
    </div>
  );
}
