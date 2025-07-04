"use client";
import { useState } from "react";
import { InputComponent } from "@/tramites/components/createTramite/InputComponent";
import { Button } from "@/core/components/ui/button";
import { authClient } from "@/core/auth/auth-client";
import { User } from "@/core/types";
import { showCustomToast } from "@/core/components/CustomToast";
import { CheckCircle } from "lucide-react";

interface Props {
  userData: User;
  refreshUserData: () => Promise<void>;
}

export default function UpdatePassword({ userData, refreshUserData }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "currentPassword") {
      setCurrentPassword(value);
    } else if (name === "newPassword") {
      setNewPassword(value);
    }
  };

  const handleUpdate = async () => {
    try {
      const response = await authClient.changePassword({
        newPassword: newPassword,
        currentPassword: currentPassword,
        revokeOtherSessions: true, // revoke all other sessions the user is signed into
      });

      if (response.error) {
        console.error("Error al cambiar la contraseña");
        return;
      }

      if (userData.should_reset_password) {
        const res = await fetch(
          `/api/users/update/${userData.id}/should-reset-pass`,
          {
            method: "PATCH",
          }
        );

        const { success, error } = await res.json();

        if (!success) {
          console.error(error);
          return;
        }
      }

      showCustomToast({
        title: "Contraseña actualizada",
        message: "Tu contraseña ha sido actualizada correctamente",
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckCircle,
      });
      refreshUserData();
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      console.error(error);
    }
  };
  return (
    <div className="py-5 flex flex-col gap-4">
      <span className="text-xl text-gray-600">Cambia tu contraseña</span>
      <div className="flex items-stretch gap-4 max-w-[800px]">
        <InputComponent
          name="currentPassword"
          label="Contraseña Actual"
          type="password"
          value={currentPassword}
          onChange={handleChange}
        />
        <InputComponent
          name="newPassword"
          label="Nueva Contraseña"
          type="password"
          value={newPassword}
          onChange={handleChange}
        />
      </div>
      <Button
        onClick={handleUpdate}
        className="mt-4 max-w-44 shadow-md"
        disabled={currentPassword === "" || newPassword === ""}
      >
        Actualizar contraseña
      </Button>
    </div>
  );
}
