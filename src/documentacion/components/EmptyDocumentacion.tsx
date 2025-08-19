import { User } from "@/core/types";
import { Card, CardContent } from "@/core/components/ui/card";
import UploadFileModal from "./UploadFileModal";
import { FolderOpen } from "lucide-react";

export default function EmptyDocumentacion({ userData }: { userData: User }) {
  const isAdmin = userData && userData.role === "admin";

  return (
    <div className="flex items-center justify-center min-h-[400px] w-full">
      <Card className="w-full max-w-2xl shadow-sm">
        <CardContent className="p-8">
          <div className="text-center space-y-6">
            <div className="flex justify-center mb-2">
              <FolderOpen className="h-12 w-12 text-gray-400" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-gray-900">
                Esta carpeta está vacía
              </h3>
              <p className="text-gray-600">
                {isAdmin
                  ? "Aún no se ha agregado documentación a esta sección."
                  : "El administrador aún no ha subido archivos en esta sección."}
              </p>
            </div>

            {isAdmin && (
              <div className="flex justify-center mt-4">
                <UploadFileModal />
              </div>
            )}

            {isAdmin ? (
              <div className="bg-blue-50 rounded-lg p-5 mt-2">
                <h4 className="font-medium text-blue-900 mb-3">
                  ¿Qué puedes hacer?
                </h4>
                <ul className="text-sm text-blue-800 space-y-3 text-left list-disc pl-5">
                  <li>Subir documentos relevantes del proyecto</li>
                  <li>Organizar la información en subcarpetas</li>
                  <li>Compartir manuales y recursos con tu equipo</li>
                  <li>Establecer guías de procedimientos para el equipo</li>
                </ul>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-5 mt-2">
                <h4 className="font-medium text-gray-800 mb-2">
                  Información sobre la documentación
                </h4>
                <p className="text-sm text-gray-600">
                  En esta sección encontrarás documentos importantes cuando sean
                  compartidos por el administrador. Vuelve a consultar más
                  tarde.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
