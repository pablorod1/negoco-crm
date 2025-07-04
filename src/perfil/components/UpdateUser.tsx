import { useState } from "react";
import { InputComponent } from "@/tramites/components/createTramite/InputComponent";
import { authClient } from "@/core/auth/auth-client";
import { User } from "@/core/types";
import { Button } from "@/core/components/ui/button";
import { showCustomToast } from "@/core/components/CustomToast";
import { CheckCircle, CircleX, PencilOff } from "lucide-react";

interface Props {
  userData: User;
  refreshUserData: () => Promise<void>;
}

export default function UpdateUser({ userData, refreshUserData }: Props) {
  const [email, setEmail] = useState(userData.email);
  const [name, setName] = useState(userData.name);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "email") {
      setEmail(value);
    } else if (name === "name") {
      setName(value);
    }
  };

  const handleSubmit = async () => {
    if (userData) {
      try {
        if (name === userData.name && email === userData.email) {
          showCustomToast({
            title: "No hay cambios",
            message: "No se han realizado cambios",
            iconColor: "var(--warning-color)",
            iconSize: 24,
            icon: PencilOff,
          });
          return;
        }

        if (email !== userData.email) {
          const response = await authClient.changeEmail({
            newEmail: email as string,
            callbackURL: "/",
          });

          if (response.error) {
            showCustomToast({
              title: "Error al cambiar el correo electrónico",
              message: response.error.message,
              iconColor: "var(--danger-color)",
              iconSize: 24,
              icon: CircleX,
            });
          }

          showCustomToast({
            title: "Correo electrónico cambiado",
            message: "El correo electrónico ha sido cambiado correctamente",
            iconColor: "var(--success-color)",
            iconSize: 24,
            icon: CheckCircle,
          });
        }

        if (name !== userData.name) {
          const response = await authClient.updateUser({
            name: name as string,
          });

          if (response.error) {
            showCustomToast({
              title: "Error al cambiar el nombre",
              message: response.error.message,
              iconColor: "var(--danger-color)",
              iconSize: 24,
              icon: CircleX,
            });
          }

          showCustomToast({
            title: "Nombre cambiado",
            message: "El nombre ha sido cambiado correctamente",
            iconColor: "var(--success-color)",
            iconSize: 24,
            icon: CheckCircle,
          });
        }
      } catch (error) {
        console.error(error);
      } finally {
        await refreshUserData();
      }
    }
  };

  return (
    <div className="py-5 flex flex-col gap-4">
      <div className="flex items-stretch gap-4 max-w-[800px]">
        <InputComponent
          label="Nombre"
          name="name"
          onChange={handleChange}
          type="text"
          value={name}
        />
        <InputComponent
          label="Correo Electrónico"
          name="email"
          onChange={handleChange}
          type="email"
          value={email}
        />
      </div>
      <Button
        onClick={handleSubmit}
        className="mt-4 max-w-36 shadow-md"
        disabled={name === userData.name && email === userData.email}
      >
        Guardar Cambios
      </Button>
    </div>
  );
}
