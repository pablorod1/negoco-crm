import { Bell, CheckCircle, CircleX, Trash } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/core/components/ui/sheet";
import { Badge } from "@/core/components/ui/badge";
import React, { useCallback, useEffect, useState } from "react";
import { useUser } from "@/core/contexts/UserContext";
import { formatDateTime } from "@/core/utils/format";
import { Notification } from "@/core/types";
import { getLinkContext } from "@/core/utils/notifications.helpers";
import { showCustomToast } from "./CustomToast";
import { useSidebarSlideNavigation } from "../view-transitions/useGenieEffect";
import { ScrollArea } from "./ui/scroll-area";

export default function NotificationsMenu() {
  const { userData, refreshUserData } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSidebarClick = useSidebarSlideNavigation();

  const handleDeleteNotification = async (
    e: React.MouseEvent<HTMLButtonElement>,
    id: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v2/notifications/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const { success, error } = await res.json();

      if (!success && error) {
        showCustomToast({
          title: "Error eliminando la notificación",
          message: error,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      showCustomToast({
        title: "Notificación eliminada",
        message: "La notificación ha sido eliminada correctamente",
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckCircle,
      });
      fetchNotifications();
      refreshUserData();
    } catch (error) {
      showCustomToast({
        title: "Error eliminando la notificación",
        message: "Inténtalo de nuevo más tarde",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
      console.error("Error deleting notification", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAllNotifications = async (
    e: React.MouseEvent<HTMLButtonElement>,
    ids: string[]
  ) => {
    e.preventDefault();
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v2/notifications`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids }),
      });
      const { success, error } = await res.json();

      if (!success && error) {
        showCustomToast({
          title: "Error eliminando las notificaciones",
          message: error,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: CircleX,
        });
        return;
      }

      showCustomToast({
        title: "Notificaciones eliminadas",
        message: "Todas las notificaciones han sido eliminadas correctamente",
        iconColor: "var(--success-color)",
        iconSize: 24,
        icon: CheckCircle,
      });
      fetchNotifications();
      refreshUserData();
    } catch (error) {
      showCustomToast({
        title: "Error eliminando las notificaciones",
        message: "Inténtalo de nuevo más tarde",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
      console.error("Error deleting notifications", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const fetchNotifications = useCallback(async () => {
    if (userData) {
      try {
        const res = await fetch(
          `/api/v2/notifications?user_id=${encodeURIComponent(userData.id)}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        const data = await res.json();
        if (data) {
          setNotifications(data.data || []);
        }

        if (userData.should_reset_password) {
          setNotifications((prev) => [
            ...prev,
            {
              id: "1",
              title: "Cambio de contraseña",
              message: "Se recomienda cambiar la contraseña",
              client: undefined,
              context: "Password",
              created_at: userData.created_at,
              priority: 1,
              link: "/perfil",
              user_id: userData.id,
            },
          ]);
        }
      } catch (error) {
        console.error("Error fetching notifications", error);
      }
    }
  }, [userData]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);
  return (
    <Sheet>
      <SheetTrigger asChild>
        <div className="relative">
          {notifications.length > 0 && (
            <Badge
              variant="danger"
              className="absolute -top-1 -right-0 rounded-full w-5 h-5 p-0 flex items-center justify-center text-xs font-medium"
            >
              {notifications.length > 9 ? "9+" : notifications.length}
            </Badge>
          )}
          <Button variant="ghost" size="icon" className="hover:bg-gray-100">
            <Bell size={20} className="text-gray-600" />
          </Button>
        </div>
      </SheetTrigger>
      <SheetContent className="w-full sm:w-[480px] bg-white" side="right">
        <SheetHeader className="pb-6">
          <div className="flex justify-between items-center">
            {/* NIVEL 1: Título principal - gray-900, font-bold */}
            <SheetTitle className="text-2xl font-bold text-gray-900">
              Notificaciones
            </SheetTitle>
            {/* NIVEL 2: Acción secundaria cuando hay contenido */}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteAllNotifications(
                    e,
                    notifications.map((n) => n.id)
                  );
                }}
                disabled={isDeleting}
                className="text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100"
              >
                {isDeleting ? "Eliminando..." : "Limpiar todo"}
              </Button>
            )}
          </div>
          {notifications.length > 0 && (
            <p className="text-sm text-gray-500 mt-2">
              {notifications.length}{" "}
              {notifications.length === 1 ? "notificación" : "notificaciones"}
            </p>
          )}
        </SheetHeader>
        <ScrollArea className=" max-h-[88dvh] pr-2 overflow-y-auto">
          <div className="space-y-4">
            {notifications.length > 0 ? (
              notifications.map((notification, index) => (
                <React.Fragment key={notification.id}>
                  <a
                    onClick={handleSidebarClick}
                    href={getLinkContext(
                      notification.context,
                      notification.link
                    )}
                    className="group block p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all duration-150 ease-out"
                  >
                    <div className="flex items-start gap-3">
                      {/* NIVEL 4: Priority indicator - minimal visual weight */}
                      <div className="flex-shrink-0 mt-1">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            notification.priority === 1
                              ? "bg-red-400"
                              : notification.priority === 2
                                ? "bg-orange-400"
                                : "bg-gray-300"
                          }`}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* NIVEL 2: Notification title - semibold, gray-800 */}
                        <h3 className="text-base font-semibold text-gray-800 leading-tight">
                          {notification.title}
                        </h3>

                        {/* NIVEL 4: Client context - minimal */}
                        {notification.client && (
                          <span className="text-xs text-gray-600 mt-1">
                            Cliente:{" "}
                            <span className="text-gray-400">
                              {notification.client}
                            </span>
                          </span>
                        )}

                        {/* NIVEL 3: Message content - gray-600 */}
                        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                          {notification.message}
                        </p>

                        {/* NIVEL 4: Timestamp - discrete */}
                        <p className="text-xs text-gray-400 mt-3">
                          {formatDateTime(notification.created_at)}
                        </p>
                      </div>

                      {/* Delete action - appears on hover */}
                      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        <Button
                          onClick={(e) =>
                            handleDeleteNotification(e, notification.id)
                          }
                          size="icon"
                          variant="ghost"
                          disabled={isDeleting}
                          className="w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                        >
                          <Trash size={12} />
                        </Button>
                      </div>
                    </div>
                  </a>
                  {index !== notifications.length - 1 && (
                    <div
                      className="h-px bg-gray-100"
                      key={`separator-${index}`}
                    />
                  )}
                </React.Fragment>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center gap-6 py-16 px-4">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                  <Bell size={24} className="text-gray-300" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-base font-medium text-gray-600">
                    Todo al día
                  </p>
                  <p className="text-sm text-gray-400 max-w-xs">
                    No tienes notificaciones pendientes en este momento
                  </p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
