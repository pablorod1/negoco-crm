"use client";

import { useState } from "react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Mail, ArrowRight, AlertCircle } from "lucide-react";
import { authClient } from "@/core/auth/auth-client";

// Validación de formulario optimizada
type FormErrors = {
  email?: string;
  general?: string;
};

interface Props {
  setForgotPass: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function SendResetPassForm({ setForgotPass }: Props) {
  const [formData, setFormData] = useState({
    email: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.email) {
      newErrors.email = "El correo electrónico es obligatorio";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Por favor, introduce un correo electrónico válido";
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
      const response = await authClient.requestPasswordReset({
        email: formData.email,
        redirectTo: "/reset-pass",
      });

      if (response.error) {
        setErrors({ general: response.error.message });
        console.error(
          "Error al solicitar restablecimiento de contraseña:",
          response.error
        );
        return;
      }
      setSuccess(true);
    } catch (error) {
      console.error(
        "Error al solicitar restablecimiento de contraseña:",
        error
      );
      setErrors({
        general:
          "Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
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
              <Label htmlFor="email" className="text-sm font-medium">
                Correo electrónico
              </Label>
              <Button
                type="button"
                variant="link"
                onClick={() => setForgotPass(false)}
                className="text-xs font-medium text-primary-600 hover:text-primary-500"
              >
                Iniciar sesión
              </Button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                <Mail size={18} />
              </div>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="tu@empresa.com"
                className={`pl-10 ${
                  errors.email
                    ? "border-red-300 focus-visible:ring-red-500"
                    : ""
                }`}
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-red-500 mt-1">{errors.email}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700"
            disabled={isLoading}
          >
            {isLoading ? "Enviando..." : "Enviar enlace"}
            <ArrowRight size={16} className={isLoading ? "opacity-0" : ""} />
          </Button>
        </form>
      ) : (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200 flex flex-col items-center justify-center text-center gap-3 w-full">
          <AlertCircle className="text-green-500 mt-0.5 shrink-0" size={24} />
          <div className="flex flex-col gap-2">
            <p className="text-sm text-green-700">
              Se ha enviado un enlace de restablecimiento de contraseña a tu
              correo electrónico.
            </p>
            <p className="text-sm text-gray-500">{formData.email}</p>
          </div>
        </div>
      )}
    </>
  );
}
