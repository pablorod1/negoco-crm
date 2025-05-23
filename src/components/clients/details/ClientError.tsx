import { Button } from "@/components/ui/button";
import { User } from "@/lib/core/types";
import { ShieldAlertIcon } from "lucide-react";
import { Link } from "next-view-transitions";

export default function ClientError({
  userData,
  error,
}: {
  userData: User | null;
  error: string | null;
}) {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-6">
      <div className="rounded-full bg-red-100 p-4">
        <ShieldAlertIcon className="h-12 w-12 text-red-500" />
      </div>
      <h3 className="mt-6 text-2xl font-medium">Error al cargar el cliente</h3>
      <p className="mt-2 text-base text-muted-foreground max-w-md text-center">
        {!userData
          ? "Debes iniciar sesión para ver esta información"
          : error ||
            "No se encontró el cliente solicitado o no tienes permiso para acceder"}
      </p>
      <Button variant="default" className="mt-6" asChild>
        <Link href="/clientes">Volver a la lista de clientes</Link>
      </Button>
    </div>
  );
}
