import { Button } from "@heroui/react";

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
    <div className="flex justify-between items-center w-full">
      {onCancel && onBack && (
        <Button onPress={onCancel} variant="solid" color="danger" radius="sm">
          Cancelar
        </Button>
      )}
      <div className="flex justify-end gap-4 w-full">
        <Button
          onPress={onBack && onCancel ? onBack : onCancel}
          variant="solid"
          color="danger"
          radius="sm"
        >
          {onBack && onCancel ? "Atrás" : "Cancelar"}
        </Button>
        <Button onPress={onSubmit} variant="ghost" color="primary" radius="sm">
          {lastStep ? "Finalizar" : "Siguiente"}
        </Button>
      </div>
    </div>
  );
}
