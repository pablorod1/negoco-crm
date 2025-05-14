"use client";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Link } from "next-view-transitions";

export default function EmptyToken() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 mx-auto">
      <div className="max-w-md w-full px-6 py-8 bg-white shadow-md rounded-lg">
        <div className="text-center mb-6">
          <Image
            src="/logo_inline.png"
            alt="Negoco Cloud IT Logo"
            width={150}
            height={50}
            className="h-12 mx-auto mb-4"
          />
          <h2 className="text-2xl font-bold text-gray-800">Enlace no válido</h2>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-yellow-50 rounded-md border border-yellow-200">
            <p className="text-yellow-700 text-sm">
              No se ha proporcionado un token de restablecimiento de contraseña
              válido.
            </p>
          </div>

          <p className="text-gray-600 text-sm">
            Es posible que el enlace que has seguido sea incorrecto, esté
            incompleto o haya expirado.
          </p>

          <div className="mt-6">
            <p className="text-gray-600 text-sm mb-2">
              Puedes intentar lo siguiente:
            </p>
            <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
              <li>
                Verificar que has seguido el enlace completo desde tu correo
              </li>
              <li>
                Solicitar un nuevo enlace de restablecimiento de contraseña
              </li>
              <li>Contactar con soporte si el problema persiste</li>
            </ul>
          </div>

          <div className="mt-6 flex flex-col space-y-3">
            <Button>
              <Link href="/login">Volver al inicio de sesión</Link>
            </Button>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            Si necesitas ayuda, contacta con nuestro equipo de soporte en{" "}
            <a
              href="mailto:soporte@negococloud.es"
              className="text-blue-600 hover:underline"
            >
              soporte@negococloud.es
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
