"use client";

import { useState } from "react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { AlertTriangle, Lock, CheckCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { authClient } from "@/core/auth/auth-client";
import { showCustomToast } from "@/core/components/CustomToast";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
}

export default function SessionExpiredModal({
  isOpen,
  onClose,
  userEmail,
}: Props) {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      setError("La contraseña es obligatoria");
      return;
    }

    if (!userEmail) {
      setError("No se pudo obtener el email del usuario");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const { error: authError } = await authClient.signIn.email({
        email: userEmail,
        password: password,
      });

      if (authError) {
        setError("Contraseña incorrecta. Inténtalo de nuevo.");
        return;
      }

      // Sesión renovada con éxito
      showCustomToast({
        title: "Sesión renovada",
        message:
          "Tu sesión ha sido renovada correctamente. Puedes continuar trabajando.",
        icon: CheckCircle,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });

      // Limpiar formulario y cerrar modal
      setPassword("");
      setError("");
      onClose();
    } catch (error) {
      console.error("Error al renovar sesión:", error);
      setError("Ha ocurrido un error. Inténtalo de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (error) setError(""); // Limpiar error cuando se edita
  };

  const handleClose = () => {
    setPassword("");
    setError("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-4 w-full">
            <div className="p-2 bg-orange-100 rounded-full">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-left text-lg font-semibold">
                Sesión expirada
              </DialogTitle>
              <DialogDescription className="text-left mt-2">
                Tu sesión ha expirado por inactividad. Introduce tu contraseña
                para renovar la sesión y continuar desde donde estabas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handlePasswordSubmit} className="space-y-4 mt-6">
          {/* Email del usuario (solo lectura) */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={userEmail || ""}
              disabled
              className="bg-gray-50"
            />
          </div>

          {/* Campo de contraseña */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">
              Contraseña
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                <Lock size={18} />
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Introduce tu contraseña"
                className={`pl-10 ${error ? "border-red-300 focus-visible:ring-red-500" : ""}`}
                value={password}
                onChange={handlePasswordChange}
                disabled={isLoading}
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>

          {/* Botones */}
          <div className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              disabled={isLoading || !password.trim()}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Renovando sesión...
                </>
              ) : (
                "Renovar sesión"
              )}
            </Button>
            <Button
              type="button"
              onClick={handleClose}
              variant="outline"
              className="w-full"
              disabled={isLoading}
            >
              Cancelar
            </Button>
          </div>
        </form>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Nota:</strong> Al renovar la sesión, todos tus cambios y el
            estado actual de la página se mantendrán intactos.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
