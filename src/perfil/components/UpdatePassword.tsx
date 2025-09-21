"use client";
import { useState } from "react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { authClient } from "@/core/auth/auth-client";
import { User } from "@/core/types";
import { showCustomToast } from "@/core/components/CustomToast";
import {
  CheckCircle,
  Eye,
  EyeOff,
  Shield,
  Key,
  AlertCircle,
} from "lucide-react";

interface Props {
  userData: User;
  refreshUserData: () => Promise<void>;
}

export default function UpdatePassword({ userData, refreshUserData }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "currentPassword") {
      setCurrentPassword(value);
    } else if (name === "newPassword") {
      setNewPassword(value);
    }
  };

  // Password strength validation
  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(newPassword);
  const isValidPassword = passwordStrength >= 3 && newPassword.length >= 8;
  const canSubmit = currentPassword.length > 0 && isValidPassword;

  const getStrengthColor = (strength: number) => {
    if (strength <= 2) return "bg-red-400";
    if (strength === 3) return "bg-orange-400";
    if (strength === 4) return "bg-yellow-400";
    return "bg-green-400";
  };

  const getStrengthText = (strength: number) => {
    if (strength <= 2) return "Débil";
    if (strength === 3) return "Aceptable";
    if (strength === 4) return "Buena";
    return "Muy fuerte";
  };

  const handleUpdate = async () => {
    if (!canSubmit) return;

    setLoading(true);

    try {
      const response = await authClient.changePassword({
        newPassword: newPassword,
        currentPassword: currentPassword,
        revokeOtherSessions: true,
      });

      if (response.error) {
        showCustomToast({
          title: "Error al cambiar la contraseña",
          message: response.error.message || "Verifica tu contraseña actual",
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: AlertCircle,
        });
        return;
      }

      if (userData.should_reset_password) {
        const res = await fetch(`/api/v2/users/${userData.id}/password-reset`, {
          method: "PATCH",
        });

        const { success, error } = await res.json();

        if (!success) {
          console.error(error);
          return;
        }
      }

      showCustomToast({
        title: "Contraseña actualizada",
        message:
          "Tu contraseña ha sido actualizada correctamente y se han cerrado todas las sesiones activas",
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckCircle,
      });

      await refreshUserData();
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      showCustomToast({
        title: "Error al actualizar",
        message: "Inténtalo de nuevo más tarde",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: AlertCircle,
      });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Form Section */}
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Current Password Field */}
          <div className="space-y-2">
            <Label
              htmlFor="currentPassword"
              className="text-sm font-medium text-gray-700"
            >
              Contraseña actual
            </Label>
            <div className="relative">
              <Input
                id="currentPassword"
                name="currentPassword"
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={handleChange}
                disabled={loading}
                className="rounded-xl border-gray-200 focus:border-gray-300 focus:ring-0 focus:ring-offset-0 pr-10"
                placeholder="Ingresa tu contraseña actual"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrentPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* New Password Field */}
          <div className="space-y-2">
            <Label
              htmlFor="newPassword"
              className="text-sm font-medium text-gray-700"
            >
              Nueva contraseña
            </Label>
            <div className="relative">
              <Input
                id="newPassword"
                name="newPassword"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={handleChange}
                disabled={loading}
                className="rounded-xl border-gray-200 focus:border-gray-300 focus:ring-0 focus:ring-offset-0 pr-10"
                placeholder="Ingresa una nueva contraseña"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Password strength indicator */}
            {newPassword.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          level <= passwordStrength
                            ? getStrengthColor(passwordStrength)
                            : "bg-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-500 min-w-fit">
                    {getStrengthText(passwordStrength)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Section */}
        <div className="flex items-center justify-between pt-4">
          {/* Security status */}
          <div className="text-sm text-gray-500">
            {canSubmit ? (
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                Lista para actualizar
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Key className="h-4 w-4 text-gray-400" />
                {currentPassword.length === 0
                  ? "Ingresa tu contraseña actual"
                  : "La nueva contraseña debe ser más fuerte"}
              </span>
            )}
          </div>

          {/* Update Button */}
          <Button
            onClick={handleUpdate}
            disabled={!canSubmit || loading}
            className="rounded-xl bg-gray-900 hover:bg-gray-800 text-white px-6"
            size="sm"
          >
            <Shield className="h-4 w-4 mr-2" />
            {loading ? "Actualizando..." : "Actualizar contraseña"}
          </Button>
        </div>
      </div>

      {/* Security info - Level 4 Minimal */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-700">
            Recomendaciones de seguridad
          </p>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>
              • Usa al menos 8 caracteres con mayúsculas, minúsculas y números
            </li>
            <li>• Incluye símbolos especiales para mayor seguridad</li>
            <li>
              • Se cerrarán todas las sesiones activas al cambiar la contraseña
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
