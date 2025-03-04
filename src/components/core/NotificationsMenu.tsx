import { Bell, CheckCircle, CircleX, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@heroui/react";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { formatDateTime } from "@/lib/core/format";
import Link from "next/link";
import { Notification } from "@/lib/core/types";
import {
  getColorPriority,
  getLinkContext,
} from "@/lib/core/notifications.helpers";
import { showCustomToast } from "./CustomToast";

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
        <Button variant="ghost" size="icon" className="relative px-2">
          <Badge
            content={notifications.length}
            color="danger"
            isInvisible={notifications.length === 0}
            isDot
            variant="solid"
            className="absolute -top-1 -right-0"
          >
            <Bell size={24} />
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0">
        <Card className="border-0 shadow-none">
          <CardHeader className="border-b px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-xl font-medium text-[var(--primary-color-800)]">
              <Bell size={20} />
              Notificaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="ps-0 pe-4 py-2">
            <div className="space-y-1">
              {notifications.length > 0 ? (
                notifications.map((notification, index) => (
                  <Link
                    href={getLinkContext(
                      notification.context,
                      notification.link
                    )}
                    key={index}
                    className="group flex flex-col gap-3 border-b border-b-gray-200  py-4 hover:bg-muted/50 cursor-pointer overflow-hidden"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start ">
                        <div className="flex flex-col justify-center items-center gap-6">
                          <Badge
                            className="mt-3"
                            content=""
                            size="sm"
                            isDot
                            color={getColorPriority(notification.priority)}
                          >
                            <span />
                          </Badge>
                          <div
                            className={` -translate-x-10  group-hover:translate-x-0 transition-transform`}
                          >
                            <Button
                              onClick={(e) =>
                                handleDeleteNotification(e, notification.id)
                              }
                              size="icon"
                              variant="ghost"
                            >
                              <Trash size={16} stroke="red" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <p className="text-base font-medium">
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-500">
                            {notification.message}
                          </p>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(notification.created_at)}
                      </p>
                    </div>
                  </Link>
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
