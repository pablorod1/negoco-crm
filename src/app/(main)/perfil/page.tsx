"use client";
import UpdatePassword from "@/perfil/components/UpdatePassword";
import UpdateUser from "@/perfil/components/UpdateUser";
import UploadAvatar from "@/perfil/components/UploadAvatar";
import { Button } from "@/core/components/ui/button";
import { useUser } from "@/core/contexts/UserContext";
import { User } from "@/core/types";
import { authClient } from "@/core/auth/auth-client";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import FullScreenLoaderComponent from "@/core/components/FullScreenLoaderComponent";

export default function AccountSettings() {
  const { userData, refreshUserData, loading } = useUser();

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          redirect("/login");
        },
      },
    });
  };

  if (loading || !userData) {
    return <FullScreenLoaderComponent />;
  }

  return (
    <section className="min-h-screen bg-white">
      {/* Content Section */}
      <div className="  px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content - Level 2 Important */}
          <div className="lg:col-span-2 space-y-8">
            {/* Profile Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-8 py-8">
                <div className="space-y-2 mb-8">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Información del perfil
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Actualiza tu foto y datos personales
                  </p>
                </div>

                <UploadAvatar
                  userData={userData as User}
                  refreshUserData={refreshUserData}
                />
              </div>

              <div className="border-t border-gray-50 px-8 py-8">
                <UpdateUser
                  userData={userData as User}
                  refreshUserData={refreshUserData}
                />
              </div>
            </div>

            {/* Security Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-8 py-8">
                <div className="space-y-2 mb-8">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Seguridad
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Mantén tu cuenta segura con una contraseña robusta
                  </p>
                </div>

                <UpdatePassword
                  userData={userData as User}
                  refreshUserData={refreshUserData}
                />
              </div>
            </div>
          </div>

          {/* Sidebar - Level 3 Contextual */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-8">
              <div className="px-6 py-6">
                <div className="space-y-6">
                  {/* Account Info */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-gray-800">
                      Información de la cuenta
                    </h3>
                    <div className="space-y-2 text-sm text-gray-500">
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
                        <span className="capitalize">
                          {userData?.role || "Usuario"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-gray-800">
                      Acciones rápidas
                    </h3>
                    <div className="space-y-2">
                      <Button
                        onClick={handleSignOut}
                        variant="destructive"
                        size="sm"
                        className="w-full justify-start rounded-xl"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Cerrar sesión
                      </Button>
                    </div>
                  </div>

                  {/* Support Info - Level 4 Minimal */}
                  <div className="pt-4 border-t border-gray-100">
                    <div className="space-y-2 text-xs text-gray-400">
                      <p>¿Necesitas ayuda?</p>
                      <p>
                        Contacta al soporte técnico para asistencia adicional.
                      </p>
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
