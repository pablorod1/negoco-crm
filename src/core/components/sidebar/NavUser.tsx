"use client";

import { ChevronsUpDown, LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/core/components/ui/dropdown-menu";

import { authClient } from "@/core/auth/auth-client";
import { redirect } from "next/navigation";
import { useUser } from "@/core/contexts/UserContext";
import { useTransitionRouter } from "next-view-transitions";
import AvatarComponent from "../AvatarComponent";
import { Skeleton } from "../ui/skeleton";

export default function NavUser() {
  const { userData, loading } = useUser();
  const router = useTransitionRouter();

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
    return (
      <div className="flex items-center gap-3 w-full p-2">
        <Skeleton className="w-8 h-8 rounded-full" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2 w-32" />
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-200">
          <AvatarComponent userData={userData} className="w-8 h-8" />
          <div className="flex-1 text-left min-w-0">
            <div className="font-medium text-gray-900 text-sm truncate">
              {userData.name}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {userData.email}
            </div>
          </div>
          <ChevronsUpDown className="w-4 h-4 text-gray-400 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-64 rounded-xl border border-gray-200 shadow-lg"
        align="start"
        sideOffset={8}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-3 px-3 py-3">
            <AvatarComponent userData={userData} className="w-10 h-10" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 text-sm truncate">
                {userData.name}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {userData.email}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {userData.organization?.name}
              </div>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-gray-100" />
        <DropdownMenuGroup className="p-1">
          <DropdownMenuItem
            className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-50 focus:bg-gray-50"
            onClick={() => router.push("/perfil")}
          >
            <User className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Perfil</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-gray-100" />
        <div className="p-1">
          <DropdownMenuItem
            className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-red-600 hover:bg-red-50 focus:bg-red-50"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Cerrar Sesión</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
