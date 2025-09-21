"use client";

import { useState } from "react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";
import { authClient } from "@/core/auth/auth-client";
import SendResetPassForm from "./SendResetPassForm";
import { useTransitionRouter } from "next-view-transitions";

// Validación de formulario optimizada
type FormErrors = {
  email?: string;
  password?: string;
  general?: string;
};

export default function LoginForm() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [forgotPass, setForgotPass] = useState(false);
  const router = useTransitionRouter();

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.email) {
      newErrors.email = "El correo electrónico es obligatorio";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Por favor, introduce un correo electrónico válido";
    }

    if (!formData.password) {
      newErrors.password = "La contraseña es obligatoria";
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

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const { error } = await authClient.signIn.email(
        {
          email: formData.email,
          password: formData.password,
          callbackURL: "/",
        },
        {
          onRequest: () => setIsLoading(true),
          onResponse: () => {
            router.push("/");
          },
          onError: (ctx) => {
            setErrors({ general: ctx.error.message || "Error desconocido" });
          },
        }
      );

      if (error) {
        setErrors({ general: error.message as string });
      }
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      setErrors({
        general:
          "Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">
          {forgotPass
            ? "Solicitar restablecimiento de contraseña"
            : "Iniciar sesión"}
        </h2>
        <p className="mt-2 text-gray-600">
          {forgotPass
            ? "Introduce tu correo electrónico para recibir un enlace de restablecimiento de contraseña."
            : "Accede a tu cuenta para continuar."}
        </p>
      </div>

      {!forgotPass ? (
        <form onSubmit={handleLoginSubmit} className="space-y-6">
          {errors.general && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
              <AlertCircle className="text-red-500 mt-0.5 shrink-0" size={18} />
              <p className="text-sm text-red-700">{errors.general}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Correo electrónico
            </Label>

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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </Label>
              <Button
                type="button"
                variant="link"
                onClick={() => setForgotPass(true)}
                className="text-xs font-medium text-primary-600 hover:text-primary-500"
              >
                ¿Olvidaste tu contraseña?
              </Button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                <Lock size={18} />
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                className={`pl-10 ${
                  errors.password
                    ? "border-red-300 focus-visible:ring-red-500"
                    : ""
                }`}
                value={formData.password}
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
            {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
            <ArrowRight size={16} className={isLoading ? "opacity-0" : ""} />
          </Button>
        </form>
      ) : (
        <SendResetPassForm setForgotPass={setForgotPass} />
      )}
    </div>
  );
}
