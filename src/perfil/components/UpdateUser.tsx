import { useState } from "react";
import { authClient } from "@/core/auth/auth-client";
import { User } from "@/core/types";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { showCustomToast } from "@/core/components/CustomToast";
import { CheckCircle, CircleX, PencilOff, Save } from "lucide-react";

interface Props {
  userData: User;
  refreshUserData: () => Promise<void>;
}

export default function UpdateUser({ userData, refreshUserData }: Props) {
  const [email, setEmail] = useState(userData.email);
  const [name, setName] = useState(userData.name);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "email") {
      setEmail(value);
    } else if (name === "name") {
      setName(value);
    }
  };

  const hasChanges = name !== userData.name || email !== userData.email;

  const handleSubmit = async () => {
    if (userData) {
      if (!hasChanges) {
        showCustomToast({
          title: "No hay cambios",
          message: "No se han realizado cambios",
          iconColor: "var(--warning-color)",
          iconSize: 24,
          icon: PencilOff,
        });
        return;
      }

      setLoading(true);

      try {
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
            return;
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
            return;
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
        showCustomToast({
          title: "Error al actualizar",
          message: "Inténtalo de nuevo más tarde",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        console.error(error);
      } finally {
        setLoading(false);
        await refreshUserData();
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Form Section */}
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium text-gray-700">
              Nombre completo
            </Label>
            <Input
              id="name"
              name="name"
              type="text"
              value={name}
              onChange={handleChange}
              disabled={loading}
              className="rounded-xl border-gray-200 focus:border-gray-300 focus:ring-0 focus:ring-offset-0"
              placeholder="Ingresa tu nombre completo"
            />
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="text-sm font-medium text-gray-700"
            >
              Correo electrónico
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={handleChange}
              disabled={loading}
              className="rounded-xl border-gray-200 focus:border-gray-300 focus:ring-0 focus:ring-offset-0"
              placeholder="tu@ejemplo.com"
            />
          </div>
        </div>

        {/* Action Section */}
        <div className="flex items-center justify-between pt-4">
          {/* Changes indicator */}
          <div className="text-sm text-gray-500">
            {hasChanges ? (
              <span className="flex items-center gap-2">
                <div className="size-2 bg-orange-400 rounded-full"></div>
                Tienes cambios sin guardar
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <div className="size-2 bg-green-400 rounded-full"></div>
                Todo actualizado
              </span>
            )}
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSubmit}
            disabled={!hasChanges || loading}
            className="rounded-xl bg-gray-900 hover:bg-gray-800 text-white px-6"
            size="sm"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </div>

      {/* Help Section - Level 4 Minimal */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-700">
            Información importante
          </p>
          <p className="text-xs text-gray-500">
            • Los cambios en el correo electrónico requieren verificación
          </p>
          <p className="text-xs text-gray-500">
            • Tu nombre aparecerá en todas las interacciones del sistema
          </p>
        </div>
      </div>
    </div>
  );
}
