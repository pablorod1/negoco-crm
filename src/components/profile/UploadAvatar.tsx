import { User } from "@/lib/core/types";
import AvatarComponent from "../core/AvatarComponent";
import { useState } from "react";
import { updateAvatarUser } from "@/lib/libsql/data/auth/updateUser";
import { deleteAvatar } from "@/lib/firebase/data/deleteFile";
import { Button } from "@heroui/react";
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
        return;
      }
      if (userData) {
        try {
          const { success, error } = await updateAvatarUser(userData.id, file);

          if (!success) {
            showCustomToast({
              title: "Error al subir la imagen",
              message: error,
              iconColor: "var(--danger-color)",
              iconSize: 24,
              icon: FileX2,
            });
            console.error(error);
          }

          showCustomToast({
            title: "Imagen subida correctamente",
            message: "La imagen se ha subido correctamente",
            iconColor: "var(--success-color)",
            iconSize: 24,
            icon: CheckCircle,
          });
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
        const { success, errors } = await deleteAvatar(userData.id);

        if (!success && errors) {
          showCustomToast({
            title: "Error eliminando la imagen",
            message: errors,
            iconColor: "var(--danger-color)",
            iconSize: 24,
            icon: FileX2,
          });
          console.error(errors);
        }

        showCustomToast({
          title: "Imagen eliminada correctamente",
          message: "La imagen ha sido eliminada correctamente",
          iconColor: "var(--success-color)",
          iconSize: 24,
          icon: CheckCircle,
        });
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
          className="size-24 !rounded-full"
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
          variant="solid"
          color="primary"
          onPress={() => document.getElementById("avatar-upload")?.click()}
          isDisabled={loading}
          className="shadow-md"
          radius="sm"
        >
          {loading ? "Subiendo..." : "Subir Imagen"}
        </Button>
        <Button
          onPress={handleDeleteAvatar}
          isDisabled={userData && (!userData.image || loading) ? true : false}
          variant="solid"
          color="danger"
          className="shadow-md"
          radius="sm"
        >
          {loading ? "Eliminando..." : "Eliminar Imagen"}
        </Button>
      </div>
    </div>
  );
}
