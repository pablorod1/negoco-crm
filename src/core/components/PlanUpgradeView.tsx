import { Rocket } from "lucide-react";
import { Button } from "./ui/button";
import { useTransitionRouter } from "next-view-transitions";
import { slideOut } from "@/core/view-transitions/view-transitions";

export default function PlanUpgradeView() {
  const router = useTransitionRouter();
  // Handle navigation
  const handleBack = () => {
    router.push("/", { onTransitionReady: slideOut });
  };
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="bg-white shadow-md rounded-lg p-8 max-w-md w-full border border-gray-100">
        <div className="flex flex-col items-center text-center">
          <div className="bg-primary/10 p-3 rounded-full mb-4">
            <Rocket className="text-primary w-8 h-8" />
          </div>
          <h2 className="text-2xl font-semibold text-primary mb-2">
            Mejora tu plan
          </h2>
          <p className="text-gray-600 mb-4">
            Esta funcionalidad está disponible en nuestros planes Pro y Elite.
          </p>
          <div className="bg-gray-50 border border-gray-100 rounded-md p-4 mb-6 w-full">
            <p className="text-sm text-gray-500">
              Actualiza tu suscripción para acceder a todas las funcionalidades
              premium.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() =>
                (window.location.href =
                  "mailto:soporte@negococloud.es?subject=Interesado en actualizar mi plan")
              }
              className="bg-primary hover:bg-primary/90"
            >
              Contactar a soporte
            </Button>
            <Button variant="outline" onClick={handleBack}>
              Volver
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
