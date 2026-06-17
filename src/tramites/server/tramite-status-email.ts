import * as React from "react";
import { NextRequest } from "next/server";
import nodemailer from "nodemailer";
import { render } from "@react-email/components";
import TramiteStatusUpdateEmail from "@/tramites/hooks/update-tramite-status-notification-email";

interface StatusEmailParams {
  user_to: { name: string; email: string; org_logo: string | undefined };
  tramite_id: string;
  status: { old: string; new: string };
  link: string;
  client: { name: string; last_name?: string | undefined };
}

export async function sendTramiteStatusUpdatedNotification({
  req,
  ...params
}: StatusEmailParams & { req: NextRequest }) {
  const host = req.headers.get("host");
  if (!host) {
    throw new Error("No host found in request headers");
  }

  return sendTramiteStatusUpdatedNotificationForHost({
    ...params,
    host,
  });
}

export async function sendTramiteStatusUpdatedNotificationForHost({
  user_to,
  tramite_id,
  status,
  link,
  host,
  client,
}: StatusEmailParams & { host: string }) {
  const subdomain = host.split(".")[0];
  const email =
    subdomain === "beenergy"
      ? process.env.EMAIL_BEENERGY
      : process.env.EMAIL_NOREPLY;
  const password =
    subdomain === "beenergy"
      ? process.env.EMAIL_PASS_BEENERGY
      : process.env.EMAIL_PASS_NOREPLY;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: 465,
    secure: true,
    auth: {
      user: email,
      pass: password,
    },
  });

  const tramiteLink = `${link}/tramites/${tramite_id}`;

  const emailHtml = await render(
    React.createElement(TramiteStatusUpdateEmail, {
      name: user_to.name,
      tramiteLink,
      status,
      org_logo: user_to.org_logo,
      subdomain,
      client,
    }),
  );

  const mailOptions = {
    from: {
      address: email as string,
      name: subdomain === "beenergy" ? "BEENERGY" : "Negoco Cloud",
    },
    to: user_to.email,
    subject: `Actualización de Trámite - ${client.name} ${client.last_name}`,
    html: emailHtml,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error("Error al enviar el email:", error);
    throw new Error("No se pudo enviar el correo");
  }
}
