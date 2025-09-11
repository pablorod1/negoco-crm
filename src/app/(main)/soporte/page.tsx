"use client";
import { useUser } from "@/core/contexts/UserContext";
import { User } from "@/core/types";
import { redirect } from "next/navigation";
import { useEffect } from "react";
import { AlertTriangle, HeadphonesIcon, Mail, Phone } from "lucide-react";
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
              <div className="p-3 bg-gray-100 rounded-2xl">
                <HeadphonesIcon className="h-6 w-6 text-gray-700" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Centro de Soporte
                </h1>
                <p className="text-gray-500 text-base max-w-2xl">
                  Reporta incidencias técnicas y solicita asistencia
                  especializada para el equipo de Negoco Cloud.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className=" px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content - Level 2 Important */}
          <div className="lg:col-span-2 space-y-8">
            {/* Support Form Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-8 py-8">
                <div className="space-y-2 mb-8">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Reportar incidencia
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Describe detalladamente el problema que has encontrado para
                    que nuestro equipo pueda ayudarte.
                  </p>
                </div>

                <SupportForm userData={userData as User} />
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-8 py-8">
                <div className="space-y-2 mb-6">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Acciones rápidas
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Otras formas de obtener ayuda inmediata
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Mail className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-800 text-sm">
                          Email directo
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          soporte@negococloud.es
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Respuesta en 24h
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-green-50 rounded-lg">
                        <Phone className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-800 text-sm">
                          Soporte telefónico
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          +34 900 123 456
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          L-V 9:00-18:00
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar - Level 3 Contextual */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-8">
              <div className="px-6 py-6">
                <div className="space-y-6">
                  {/* User Info */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-gray-800">
                      Información del solicitante
                    </h3>
                    <div className="space-y-2 text-sm text-gray-500">
                      <div>
                        <span className="block font-medium text-gray-700">
                          Usuario
                        </span>
                        <span>{userData?.name}</span>
                      </div>
                      <div>
                        <span className="block font-medium text-gray-700">
                          Email
                        </span>
                        <span>{userData?.email}</span>
                      </div>
                      <div>
                        <span className="block font-medium text-gray-700">
                          Organización
                        </span>
                        <span>
                          {userData?.organization?.name || "No asignada"}
                        </span>
                      </div>
                      <div>
                        <span className="block font-medium text-gray-700">
                          Rol
                        </span>
                        <span className="capitalize bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs">
                          {userData?.role}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Priority Guidelines */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-gray-800">
                      Niveles de prioridad
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <div className="w-3 h-3 bg-red-400 rounded-full mt-0.5 flex-shrink-0"></div>
                        <div>
                          <p className="text-xs font-medium text-gray-700">
                            Crítica
                          </p>
                          <p className="text-xs text-gray-500">
                            Sistema no funcional
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-3 h-3 bg-orange-400 rounded-full mt-0.5 flex-shrink-0"></div>
                        <div>
                          <p className="text-xs font-medium text-gray-700">
                            Alta
                          </p>
                          <p className="text-xs text-gray-500">
                            Funcionalidad afectada
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-3 h-3 bg-yellow-400 rounded-full mt-0.5 flex-shrink-0"></div>
                        <div>
                          <p className="text-xs font-medium text-gray-700">
                            Media
                          </p>
                          <p className="text-xs text-gray-500">
                            Mejoras o dudas
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-3 h-3 bg-green-400 rounded-full mt-0.5 flex-shrink-0"></div>
                        <div>
                          <p className="text-xs font-medium text-gray-700">
                            Baja
                          </p>
                          <p className="text-xs text-gray-500">
                            Consultas generales
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Help Tips - Level 4 Minimal */}
                  <div className="pt-4 border-t border-gray-100">
                    <div className="space-y-2 text-xs text-gray-400">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <p>Incluye capturas de pantalla cuando sea posible</p>
                      </div>
                      <p>• Describe los pasos para reproducir el problema</p>
                      <p>• Indica el navegador y dispositivo utilizado</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
