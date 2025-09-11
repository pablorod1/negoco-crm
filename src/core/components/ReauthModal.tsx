"use client";

import { useState } from "react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/core/components/ui/dialog";

import { authClient } from "@/core/auth/auth-client";
import { AlertCircle, Eye, EyeOff } from "lucide-react";

interface ReauthModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  userEmail: string;
}

export function ReauthModal({
  isOpen,
  onSuccess,
  userEmail,
}: ReauthModalProps) {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleReauth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await authClient.signIn.email({
        email: userEmail,
        password: password,
      });

      if (result.error) {
        setError(
          "Contraseña incorrecta. Por favor, verifica e intenta de nuevo."
        );
        return;
      }

      // Reset form
      setPassword("");
      onSuccess();
    } catch (error) {
      console.error("Error during reauthentication:", error);
      setError("Error al reautenticar. Por favor, intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
            <AlertCircle className="h-6 w-6 text-yellow-600" />
          </div>
          <DialogTitle className="text-xl font-semibold">
            Tu sesión ha expirado
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Para continuar trabajando, por favor confirma tu contraseña
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleReauth} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={userEmail}
              disabled
              className="bg-gray-50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa tu contraseña"
                required
                disabled={isLoading}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !password.trim()}
          >
            {isLoading ? "Verificando..." : "Continuar"}
          </Button>
        </form>

        <div className="text-center text-sm text-gray-500">
          <p>Si no recuerdas tu contraseña, puedes</p>
          <Button
            variant="link"
            className="p-0 h-auto text-sm"
            onClick={() => {
              window.location.href = "/login";
            }}
          >
            ir al login y recuperarla
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
