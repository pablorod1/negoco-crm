"use client";
import { useState } from "react";
import { InputComponent } from "../tramites/createTramite/InputComponent";
import { Button } from "@heroui/react";
import { authClient } from "@/lib/auth/auth-client";
import { User } from "@/lib/core/types";
import { showCustomToast } from "../core/CustomToast";
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

      const res = await fetch(`/api/users/update/should-reset-pass`, {
        method: "PATCH",
        body: JSON.stringify({ userData }),
      });

      const { success, error } = await res.json();

      if (!success) {
        console.error(error);
        return;
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
        onPress={handleUpdate}
        className="mt-4 max-w-44 shadow-md"
        variant="solid"
        radius="sm"
        color="primary"
        isDisabled={currentPassword === "" || newPassword === ""}
      >
        Actualizar contraseña
      </Button>
    </div>
  );
}
