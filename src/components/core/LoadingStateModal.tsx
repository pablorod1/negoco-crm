import { Spinner } from "@heroui/spinner";

export default function LoadingStateModal() {
  return (
    <div className="absolute top-0 left-0 w-full h-full flex justify-center items-center bg-white bg-opacity-85 z-50">
      <Spinner
        size="lg"
        variant="gradient"
        label="Creando trámite..."
        color="primary"
        className="text-lg"
      />
    </div>
  );
}
