"use client";
import { useUser } from "@/core/contexts/UserContext";
import { User } from "@/core/types";
import { redirect } from "next/navigation";
import { useEffect } from "react";
import SupportForm from "@/soporte/components/SupportForm";

export default function SoportePage() {
  const { userData } = useUser();

  // Verificar que el usuario sea admin
  useEffect(() => {
    if (userData && userData.role !== "admin") {
      redirect("/");
    }
  }, [userData]);

  // Mostrar loading o redirecting mientras se verifica el rol
  if (!userData || userData.role !== "admin") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="text-gray-500">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  return (
    <section className="min-h-screen bg-white">
      {/* Header Section - Level 1 Critical */}
      <div className="border-b border-gray-100 bg-white">
        <div className=" px-6 py-12">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Centro de Soporte
                </h1>
                <p className="text-gray-500 text-base max-w-2xl">
                  Envía tus consultas y solicita asistencia especializada para
                  el equipo de Negoco Cloud.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Support Form Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden max-w-3xl mx-auto mt-8">
        <div className="px-8 py-8">
          <div className="space-y-2 mb-8">
            <h2 className="text-xl font-semibold text-gray-800">
              Enviar consulta
            </h2>
            <p className="text-gray-500 text-sm">
              Escribe tu consulta o describe el problema que necesitas resolver.
            </p>
          </div>

          <SupportForm userData={userData as User} />
        </div>
      </div>
    </section>
  );
}
