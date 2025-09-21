import { User } from "@/core/types";
import { Card, CardContent } from "@/core/components/ui/card";
import UploadFileModal from "./UploadFileModal";
import { FolderOpen, Upload } from "lucide-react";

export default function EmptyDocumentacion({ userData }: { userData: User }) {
  const isAdmin = userData && userData.role === "admin";

  return (
    <Card className="max-w-lg mx-auto border-0 shadow-none">
      <CardContent className="text-center space-y-6 p-8">
        {/* Icon */}
        <div className="w-16 h-16 mx-auto bg-gray-50 rounded-full flex items-center justify-center">
          <FolderOpen className="h-8 w-8 text-gray-400" />
        </div>

        {/* Main Content */}
        <div className="space-y-3">
          <h3 className="text-xl font-semibold text-gray-900">
            No hay documentos disponibles
          </h3>
          <p className="text-gray-600 leading-relaxed">
            {isAdmin
              ? "Comienza subiendo el primer documento para compartir con tu equipo."
              : "Los documentos aparecerán aquí cuando el administrador los comparta."}
          </p>
        </div>

        {/* Primary Action */}
        {isAdmin && (
          <div className="pt-2">
            <UploadFileModal />
          </div>
        )}

        {/* Contextual Information */}
        <div className="bg-gray-50 rounded-lg p-5 space-y-3">
          {isAdmin ? (
            <>
              <div className="flex items-center gap-2 justify-center">
                <Upload className="h-4 w-4 text-gray-600" />
                <h4 className="font-medium text-gray-800">
                  Organiza tu documentación
                </h4>
              </div>
              <ul className="text-sm text-gray-600 space-y-2 text-left max-w-sm mx-auto">
                <li className="flex items-start gap-2">
                  <span className="w-1 h-1 bg-gray-400 rounded-full mt-2 flex-shrink-0"></span>
                  <span>Sube manuales, guías y recursos importantes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1 h-1 bg-gray-400 rounded-full mt-2 flex-shrink-0"></span>
                  <span>Organiza en carpetas por proyecto o área</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1 h-1 bg-gray-400 rounded-full mt-2 flex-shrink-0"></span>
                  <span>Facilita el acceso a información clave del equipo</span>
                </li>
              </ul>
            </>
          ) : (
            <>
              <h4 className="font-medium text-gray-800">
                Documentación centralizada
              </h4>
              <p className="text-sm text-gray-600">
                Aquí encontrarás manuales, guías y recursos importantes cuando
                el administrador los comparta contigo.
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
