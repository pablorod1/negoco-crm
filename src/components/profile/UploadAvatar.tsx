"use client";
import { User } from "@/lib/core/types";
import AvatarComponent from "../core/AvatarComponent";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { showCustomToast } from "../core/CustomToast";
import { CheckCircle, FileX2 } from "lucide-react";

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

          const res = await fetch(`/api/users/update/${userData.id}/avatar`, {
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
        const response = await fetch(
          `/api/users/delete/${userData.id}/avatar`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              organization_id: userData.organization.id,
            }),
          }
        );

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
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <AvatarComponent
          className="size-32 !rounded-full"
          textSize="text-4xl"
          userData={userData as User}
        />
        <div className="flex flex-col gap-2">
          <h4>Foto de Perfil</h4>
          <small> PNG, JPG, JPEG (max. 10MB) </small>
        </div>
      </div>
      <div className="flex items-center gap-4">
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
          className="shadow-md"
        >
          {loading ? "Subiendo..." : "Subir Imagen"}
        </Button>
        <Button
          onClick={handleDeleteAvatar}
          disabled={userData && (!userData.image || loading) ? true : false}
          className="shadow-md"
          variant="destructiveOutline"
        >
          {loading ? "Eliminando..." : "Eliminar Imagen"}
        </Button>
      </div>
    </div>
  );
}
