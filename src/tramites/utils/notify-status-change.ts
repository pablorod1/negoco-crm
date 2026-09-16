import type { Notification, User } from "@/core/types";
import type { ClientDB, Status, TramiteVM } from "@/tramites/types";
import { generateTramiteUpdatedNotification } from "@/core/utils/notifications.helpers";

interface NotifyStatusChangeParams {
  tramite: TramiteVM;
  client: Pick<ClientDB, "name" | "last_name">;
  userData: User;
  oldStatus: Status;
  newStatus: Status;
}

export interface NotifyStatusChangeResult {
  success: boolean;
  error?: string;
  step?: "notification" | "email";
}

// Notificación in-app al comercial asignado y, si el estado cambió, email.
// Se usa tanto desde el modal de estado como desde el envío a Imagina.
export const notifyTramiteStatusChange = async ({
  tramite,
  client,
  userData,
  oldStatus,
  newStatus,
}: NotifyStatusChangeParams): Promise<NotifyStatusChangeResult> => {
  const notification: Notification = generateTramiteUpdatedNotification({
    changes: { tramite: { status: newStatus } },
    client: `${client.name} ${client.last_name}`,
    tramite_id: tramite.id,
    user_id: tramite.user_id,
  });

  const notificationRes = await fetch("/api/v2/notifications", {
    method: "POST",
    body: JSON.stringify({ notification }),
    headers: { "Content-Type": "application/json" },
  });
  const { success: notificationSuccess, error: notificationError } =
    await notificationRes.json();

  if (!notificationSuccess) {
    return {
      success: false,
      step: "notification",
      error: notificationError as string,
    };
  }

  if (oldStatus === newStatus) return { success: true };

  const emailRes = await fetch("/api/v2/communications/emails/status-updates", {
    method: "POST",
    body: JSON.stringify({
      type: "tramite",
      user_to: {
        email: tramite.user.email,
        name: tramite.user.name,
        org_logo: userData.organization.logo,
      },
      tramite_id: tramite.id,
      status: { old: oldStatus, new: newStatus },
      client: { name: client.name, last_name: client.last_name },
    }),
    headers: { "Content-Type": "application/json" },
  });
  const { success: emailSuccess, error: emailError } = await emailRes.json();

  if (!emailSuccess) {
    return { success: false, step: "email", error: emailError as string };
  }

  return { success: true };
};
