import { MapPinX } from "lucide-react";

interface ClientMapProps {
  coordinates: [number, number];
  zoom?: number;
  width?: string;
  height?: string;
}

const ClientMap = ({
  coordinates,
  zoom = 16,
  width = "100%",
  height = "100%",
}: ClientMapProps) => {
  if (
    !coordinates ||
    coordinates.length !== 2 ||
    coordinates[0] < -90 ||
    coordinates[0] > 90 ||
    coordinates[1] < -180 ||
    coordinates[1] > 180
  ) {
    return (
      <div
        className="flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-br-lg p-8"
        style={{ width, height, minHeight: "200px" }}
      >
        <div className="text-gray-400 mb-4">
          <MapPinX className="h-16 w-16" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Ubicación no disponible
        </h3>
        <p className="text-sm text-gray-500 text-center max-w-sm">
          No se han proporcionado coordenadas válidas para mostrar el mapa de
          este cliente.
        </p>
      </div>
    );
  }
  return (
    <iframe
      src={`https://maps.google.com/maps?q=${coordinates.join(",")}&z=${zoom}&output=embed`}
      width={width}
      height={height}
      allowFullScreen
      loading="lazy"
    ></iframe>
  );
};

export default ClientMap;
