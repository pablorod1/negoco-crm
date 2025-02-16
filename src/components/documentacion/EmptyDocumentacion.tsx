import { Card, CardContent } from "../ui/card";
import UploadFileModal from "./UploadFileModal";

export default function EmptyDocumentacion() {
  return (
    <div className="flex items-center justify-center min-h-[400px] w-full">
      <Card className="w-full max-w-2xl">
        <CardContent className="p-6">
          <div className="text-center space-y-6">
            <div className="flex justify-center space-x-4 max-w-52 mx-auto">
              <UploadFileModal />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-gray-900">
                No hay documentación disponible
              </h3>
              <p className="text-gray-500">
                Esta carpeta está vacía. Puedes comenzar agregando archivos.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mt-4">
              <h4 className="font-medium text-gray-900 mb-2">
                Sugerencias para empezar:
              </h4>
              <ul className="text-sm text-gray-600 space-y-2 text-left list-disc pl-4">
                <li>Sube documentos importantes del proyecto</li>
                <li>Crea una nueva carpeta</li>
                <li>Comparte guías y manuales con tu equipo</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
