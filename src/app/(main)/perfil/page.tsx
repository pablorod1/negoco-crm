"use client";
import UpdatePassword from "@/perfil/components/UpdatePassword";
import UpdateUser from "@/perfil/components/UpdateUser";
import UploadAvatar from "@/perfil/components/UploadAvatar";
import { Button } from "@/core/components/ui/button";
import { useUser } from "@/core/contexts/UserContext";
import { User } from "@/core/types";
import { authClient } from "@/core/auth/auth-client";
import { redirect } from "next/navigation";
import { Separator } from "@/core/components/ui/separator";

export default function AccountSettings() {
  const { userData, refreshUserData } = useUser();

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          redirect("/login");
        },
      },
    });
  };

  return (
    <section className="mx-4 md:mx-8 xl:mx-12 px-2 py-8 h-auto">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h4 className="text-2xl font-bold text-primary-800">Ajustes</h4>
          <span className="text-sm text-gray-600">
            Modifica la información de tu cuenta.
          </span>
        </div>
        <Separator />
        <UploadAvatar
          userData={userData as User}
          refreshUserData={refreshUserData}
        />
        <UpdateUser
          userData={userData as User}
          refreshUserData={refreshUserData}
        />
        <Separator />
        <UpdatePassword
          userData={userData as User}
          refreshUserData={refreshUserData}
        />
        <Separator />

        <div className="py-5">
          <Button onClick={handleSignOut} variant="destructive">
            Cerrar Sesión
          </Button>
        </div>
      </div>
    </section>
  );
}
