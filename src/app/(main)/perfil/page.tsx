"use client";
import UpdatePassword from "@/components/profile/UpdatePassword";
import UpdateUser from "@/components/profile/UpdateUser";
import UploadAvatar from "@/components/profile/UploadAvatar";
import { Button } from "@heroui/react";
import { useUser } from "@/contexts/UserContext";
import { User } from "@/lib/core/types";
import { Divider } from "@heroui/react";
import { authClient } from "@/lib/auth/auth-client";
import { redirect } from "next/navigation";

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
          <h4 className="text-2xl font-bold text-[var(--primary-color-800)]">
            Ajustes
          </h4>
          <span className="text-sm text-gray-600">
            Modifica la información de tu cuenta.
          </span>
        </div>
        <Divider />
        <UploadAvatar
          userData={userData as User}
          refreshUserData={refreshUserData}
        />
        <UpdateUser
          userData={userData as User}
          refreshUserData={refreshUserData}
        />
        <Divider />
        <UpdatePassword
          userData={userData as User}
          refreshUserData={refreshUserData}
        />
        <Divider />

        <div className="py-5">
          <Button
            radius="sm"
            className="shadow-md"
            onPress={handleSignOut}
            variant="solid"
            color="danger"
          >
            Log Out
          </Button>
        </div>
      </div>
    </section>
  );
}
