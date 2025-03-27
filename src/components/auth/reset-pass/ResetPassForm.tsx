"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, AlertCircle, Lock, CheckCircle } from "lucide-react";
import { authClient } from "@/lib/auth/auth-client";
import Link from "next/link";

// Validación de formulario optimizada
type FormErrors = {
  password?: string;
  general?: string;
};

export default function ResetPassForm({ token }: { token: string }) {
  const [formData, setFormData] = useState({
    newPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.newPassword) {
      newErrors.password = "La nueva contraseña es obligatoria";
    } else if (formData.newPassword.length < 8) {
      newErrors.password = "La contraseña debe tener al menos 8 caracteres";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    // Limpiar error cuando se edita el campo
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});
    try {
      await authClient.resetPassword({
        newPassword: formData.newPassword,
        token,
      });

      setSuccess(true);
      token = "";
    } catch (error) {
      console.error("Error al restablecer contraseña:", error);
      setErrors({ general: error as string });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">
          Restablecer Contraseña
        </h2>
        <p className="mt-2 text-gray-600">
          Introduce tu nueva contraseña para restablecer tu contraseña.
        </p>
      </div>
      {!success ? (
        <form onSubmit={handleForgotPassword} className="space-y-6">
          {errors.general && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
              <AlertCircle className="text-red-500 mt-0.5 shrink-0" size={18} />
              <p className="text-sm text-red-700">{errors.general}</p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="newPassword" className="text-sm font-medium">
                Nueva Contraseña
              </Label>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                <Lock size={18} />
              </div>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                placeholder="••••••••"
                className={`pl-10 ${
                  errors.password
                    ? "border-red-300 focus-visible:ring-red-500"
                    : ""
                }`}
                value={formData.newPassword}
                onChange={handleChange}
              />
            </div>
            {errors.password && (
              <p className="text-xs text-red-500 mt-1">{errors.password}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700"
            disabled={isLoading}
          >
            {isLoading ? "Reestableciendo..." : "Cambiar contraseña"}
            <ArrowRight size={16} className={isLoading ? "opacity-0" : ""} />
          </Button>
        </form>
      ) : (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200 flex flex-col items-center text-center justify-center gap-3">
          <CheckCircle className="text-green-500 mt-0.5 shrink-0" size={18} />
          <div className="flex flex-col gap-2">
            <p className="text-sm text-green-700">
              Se ha restablecido la contraseña correctamente.
            </p>
            <Button color="primary" variant={"link"}>
              <Link href={"/login"}>Iniciar sesión</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
