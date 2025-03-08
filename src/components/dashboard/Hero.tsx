import AvatarComponent from "../core/AvatarComponent";
import AddTramiteDialog from "../tramites/createTramite/AddTramiteDialog";
import { Bell, CheckCircle } from "lucide-react";
import { User } from "@/lib/core/types";
import AddComparativaDialog from "../comparativas/createComparativa/AddComparativaDialog";

export default function Hero({
  userData,
  loading,
}: {
  userData: User;
  loading: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 mb-6 bg-gradient-to-br from-[var(--primary-color-600)] to-[var(--primary-color-400)] p-4 rounded-full shadow-md overflow-hidden flex-nowrap animate-size  ${
        loading ? "w-32 h-32" : "w-auto"
      }`}
    >
      <div className="flex items-center gap-4 flex-nowrap">
        <AvatarComponent
          className={`size-24 !rounded-full shadow-md transition-transform duration-300
               ${loading ? "scale-80" : "scale-100"}`}
          userData={userData}
          textSize="text-2xl"
        />
        <div className="ml-4 flex flex-col flex-nowrap gap-2">
          <h1 className="text-3xl font-bold text-white text-nowrap">
            Bienvenido, {userData.name} 👋
          </h1>
          {userData.notifications ? (
            <p className="text-sm text-gray-50 flex items-center text-nowrap">
              <Bell className="w-5 h-5 mr-2" /> Tienes {userData.notifications}{" "}
              notificaciones pendientes
            </p>
          ) : (
            <p className="text-base text-gray-100 flex items-center text-nowrap">
              <CheckCircle className="w-5 h-5 mr-2" /> No tienes notificaciones
              pendientes
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 flex-nowrap mr-24">
        <AddTramiteDialog color="default" />
        <AddComparativaDialog color="default" />
      </div>
    </div>
  );
}
