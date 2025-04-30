import { Bell, CheckCircle, CircleX, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import React, { useCallback, useEffect, useState } from "react";
import { useUser } from "@/lib/contexts/UserContext";
import { formatDateTime } from "@/lib/core/format";
import Link from "next/link";
import { Notification } from "@/lib/core/types";
import {
  getColorPriority,
  getLinkContext,
} from "@/lib/core/notifications.helpers";
import { showCustomToast } from "./CustomToast";
import { Separator } from "../ui/separator";

export default function NotificationsMenu() {
  const { userData, refreshUserData } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const handleDeleteNotification = async (
    e: React.MouseEvent<HTMLButtonElement>,
    id: string
  ) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/notifications/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
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
    }
  };

  const handleDeleteAllNotifications = async (
    e: React.MouseEvent<HTMLButtonElement>,
    ids: string[]
  ) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/notifications/delete/all`, {
        method: "POST",
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
    }
  };

  const fetchNotifications = useCallback(async () => {
    if (userData) {
      try {
        const res = await fetch(`/api/notifications/get/notifications`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: userData.id }),
        });
        const data = await res.json();
        console.log("Notifications data", data);
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
    <Popover>
      <PopoverTrigger asChild>
        <div className="relative">
          {notifications.length > 0 && (
            <Badge
              variant="danger"
              className="cursor-pointer absolute -top-1 -right-0 rounded-full w-4 h-4 p-2"
            >
              {notifications.length}
            </Badge>
          )}
          <Button variant="ghost" size="icon">
            <Bell size={44} />
          </Button>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[600px] p-0" align="end">
        <Card className="border-0 shadow-none">
          <CardHeader>
            <div className=" flex justify-between items-center">
              <CardTitle className="flex items-center gap-2 text-xl font-medium text-primary-800">
                <Bell size={20} />
                Notificaciones
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteAllNotifications(
                    e,
                    notifications.map((n) => n.id)
                  );
                }}
                className="text-sm"
                disabled={notifications.length === 0}
              >
                Eliminar todas
              </Button>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="px-4 py-3">
            <div className="space-y-4">
              {notifications.length > 0 ? (
                notifications.map((notification, index) => (
                  <React.Fragment key={notification.id}>
                    <Link
                      href={getLinkContext(
                        notification.context,
                        notification.link
                      )}
                      className="group flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex-shrink-0">
                        <Badge
                          className="w-3 h-3 p-1 rounded-full"
                          variant={getColorPriority(notification.priority)}
                        >
                          <span />
                        </Badge>
                      </div>
                      <div className="flex-grow space-y-2">
                        <div>
                          <p className="text-base font-semibold text-primary-900">
                            {notification.title}
                          </p>
                          {notification.client && (
                            <p className="text-sm text-primary-500">
                              Cliente: {notification.client}
                            </p>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {notification.message}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-6">
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(notification.created_at)}
                        </p>
                        <Button
                          onClick={(e) =>
                            handleDeleteNotification(e, notification.id)
                          }
                          size="icon"
                          variant="ghost"
                          className="text-red-500 hover:bg-red-100"
                        >
                          <Trash size={14} />
                        </Button>
                      </div>
                    </Link>
                    <>
                      {index !== notifications.length - 1 && (
                        <Separator
                          className="my-2"
                          key={`separator-${index}`}
                        />
                      )}
                    </>
                  </React.Fragment>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 p-4">
                  <Bell size={48} className="text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No hay notificaciones
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
