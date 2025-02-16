import { Spinner } from "@heroui/react";

export default function LoadingComponent() {
  return (
    <div className="flex items-center justify-center min-h-[400px] w-full">
      <Spinner
        size="lg"
        color="primary"
        label="Cargando..."
        className="text-3xl"
      />
    </div>
  );
}
