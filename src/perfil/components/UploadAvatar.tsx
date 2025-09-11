"use client";
import { User } from "@/core/types";
import AvatarComponent from "@/core/components/AvatarComponent";
import { useState } from "react";
import { Button } from "@/core/components/ui/button";
import { showCustomToast } from "@/core/components/CustomToast";
import {
  CheckCircle,
  FileX2,
  Upload,
  Trash2,
  User2,
  ImageIcon,
} from "lucide-react";

interface Props {
  userData: User;
  refreshUserData: () => Promise<void>;
}

export default function UploadAvatar({ userData, refreshUserData }: Props) {
  const [loading, setLoading] = useState(false);

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoading(true);
    if (e.target.files?.length) {
      const file = e.target.files[0];

      // Validación de tipo de archivo
      if (
        file.type !== "image/png" &&
        file.type !== "image/jpeg" &&
        file.type !== "image/jpg"
      ) {
        showCustomToast({
          title: "Formato no soportado",
          message: "Solo se permiten archivos PNG, JPG, JPEG",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: FileX2,
        });
        setLoading(false);
        return;
      }

      if (userData) {
        try {
          // Crear FormData para enviar el archivo
          const formData = new FormData();
          formData.append("file", file);
          formData.append("organization_id", userData.organization.id);

          const res = await fetch(`/api/v2/users/${userData.id}/avatar`, {
            method: "PATCH",
            body: formData,
          });

          const { success, error } = await res.json();

          if (!success) {
            showCustomToast({
              title: "Error al subir la imagen",
              message: error || "Error desconocido",
              iconColor: "var(--danger-color)",
              iconSize: 24,
              icon: FileX2,
            });
            console.error(error);
          } else {
            showCustomToast({
              title: "Imagen subida correctamente",
              message: "La imagen se ha subido correctamente",
              iconColor: "var(--success-color)",
              iconSize: 24,
              icon: CheckCircle,
            });
          }
        } catch (error) {
          showCustomToast({
            title: "Error al subir la imagen",
            message: "Inténtalo de nuevo más tarde",
            iconColor: "var(--danger-color)",
            iconSize: 24,
            icon: FileX2,
          });
          console.error(error);
        } finally {
          await refreshUserData();
          setLoading(false);
        }
      }
    }
  };

  const handleDeleteAvatar = async () => {
    setLoading(true);
    if (userData) {
      try {
        const response = await fetch(`/api/v2/users/${userData.id}/avatar`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            organization_id: userData.organization.id,
          }),
        });

        const { success, errors } = await response.json();

        if (!success) {
          showCustomToast({
            title: "Error eliminando la imagen",
            message: errors,
            iconColor: "var(--danger-color)",
            iconSize: 24,
            icon: FileX2,
          });
          console.error(errors);
        } else {
          showCustomToast({
            title: "Imagen eliminada correctamente",
            message: "La imagen ha sido eliminada correctamente",
            iconColor: "var(--success-color)",
            iconSize: 24,
            icon: CheckCircle,
          });
        }
      } catch (error) {
        showCustomToast({
          title: "Error eliminando la imagen",
          message: "Inténtalo de nuevo más tarde",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: FileX2,
        });
        console.error(error);
      } finally {
        await refreshUserData();
        setLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Avatar Display Section */}
      <div className="flex items-start gap-6">
        <div className="relative">
          <AvatarComponent
            className="size-20 rounded-2xl border-2 border-gray-100"
            textSize="text-2xl"
            userData={userData as User}
          />
          {/* Status indicator */}
          <div className="absolute -bottom-1 -right-1 size-6 bg-white rounded-full flex items-center justify-center border-2 border-gray-100">
            <User2 className="size-3 text-gray-400" />
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              Foto de perfil
            </h3>
            <p className="text-gray-500 text-sm">
              Esta imagen aparecerá en tu perfil y será visible para otros
              usuarios.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <input
              type="file"
              accept="image/*"
              id="avatar-upload"
              className="hidden"
              onChange={handleUploadAvatar}
            />

            <Button
              onClick={() => document.getElementById("avatar-upload")?.click()}
              disabled={loading}
              size="sm"
              variant="outline"
              className="rounded-xl border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            >
              <Upload className="h-4 w-4 mr-2" />
              {loading ? "Subiendo..." : "Subir imagen"}
            </Button>

            {userData?.image && (
              <Button
                onClick={handleDeleteAvatar}
                disabled={loading}
                size="sm"
                variant="ghost"
                className="rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {loading ? "Eliminando..." : "Eliminar"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Technical specs - Level 4 Minimal */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-white rounded-lg border border-gray-200">
            <ImageIcon className="h-4 w-4 text-gray-500" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-700">
              Especificaciones técnicas
            </p>
            <p className="text-xs text-gray-500">
              Formatos soportados: PNG, JPG, JPEG • Tamaño máximo: 10MB
            </p>
            <p className="text-xs text-gray-500">
              Recomendado: Imagen cuadrada de al menos 400x400px para mejor
              calidad
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
