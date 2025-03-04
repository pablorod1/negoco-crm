"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@heroui/react";
import { motion } from "framer-motion";
import { Zap, Lock, Mail } from "lucide-react";
import { authClient } from "@/lib/auth/auth-client";

export default function LoginForm() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoginSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await authClient.signIn.email(
        {
          email,
          password,
          callbackURL: "/",
        },
        {
          onRequest: () => {
            setIsLoading(true);
          },
          onResponse: () => {
            setIsLoading(false);
          },
          onError: (ctx) => {
            setError(ctx.error.message || "Error desconocido");
          },
        }
      );

      if (error) {
        setError(error.message as string);
        return;
      }
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      setError("Error desconocido");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white bg-opacity-10 backdrop-filter backdrop-blur-lg rounded-xl p-8 shadow-2xl max-w-md w-full"
    >
      <form className="flex flex-col gap-6">
        {error && (
          <div className="p-3 text-sm text-red-500 bg-red-100 rounded">
            {error}
          </div>
        )}
        <div className="space-y-2">
          <Input
            id="email"
            label="Correo Electrónico"
            labelPlacement="outside"
            type="email"
            size="lg"
            radius="sm"
            variant="faded"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            startContent={<Mail size={18} />}
          />
        </div>
        <div className="space-y-2">
          <Input
            size="lg"
            variant="faded"
            label="Contraseña"
            labelPlacement="outside"
            id="password"
            radius="sm"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            startContent={<Lock size={18} />}
          />
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="remember"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          >
            Recordarme
          </Checkbox>
        </div>
        <Button
          onClick={handleLoginSubmit}
          className="w-full bg-[var(--primary-color-500)] hover:bg-[var(--primary-color-600)]"
          disabled={isLoading}
        >
          <Zap className="mr-2" size={18} />
          {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
        </Button>
      </form>
      <div className="mt-6 text-center">
        <a
          href="/forgot-password"
          className="text-sm text-[var(--primary-color-400)] hover:underline"
        >
          Forgot password?
        </a>
      </div>
    </motion.div>
  );
}
