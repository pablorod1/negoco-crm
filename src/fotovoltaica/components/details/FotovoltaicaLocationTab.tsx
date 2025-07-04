import { FotovoltaicaVM } from "@/fotovoltaica/types";
import { MapPin, MapPinned } from "lucide-react";
import { Label } from "@/core/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/core/components/ui/card";

interface Props {
  fotovoltaica: FotovoltaicaVM;
}

export default function FotovoltaicaLocationTab({ fotovoltaica }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Ubicación de la Instalación
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <a
          href={fotovoltaica.location}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 flex items-center gap-2 hover:underline"
        >
          <MapPinned className="h-4 w-4 mr-1" />
          Ver en Google Maps
        </a>
        {fotovoltaica.coordinates && (
          <div>
            <Label className="text-sm font-medium text-muted-foreground">
              Coordenadas
            </Label>
            <p className="font-mono">
              Lat: {fotovoltaica.coordinates[0]}, Lng:{" "}
              {fotovoltaica.coordinates[1]}
            </p>
          </div>
        )}
        <div className="h-[70vh] bg-muted rounded-lg flex items-center justify-center overflow-hidden">
          {fotovoltaica.coordinates ? (
            <iframe
              src={`https://maps.google.com/maps?q=${fotovoltaica.coordinates.join(",")}&z=16&output=embed`}
              width="100%"
              height="100%"
              allowFullScreen
              loading="lazy"
            ></iframe>
          ) : (
            <p className="text-red-500">No se han proporcionado coordenadas.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
