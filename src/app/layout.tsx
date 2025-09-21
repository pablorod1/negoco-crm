import type { Metadata } from "next";
import "./globals.css";
import { inter } from "@/fonts/fonts";
import { headers } from "next/headers";
import { ViewTransitions } from "next-view-transitions";

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const subdomain = host.split(".")[0];

  return {
    title: subdomain === "beenergy" ? "Beenergy" : "Negoco Cloud",
    icons: {
      icon: subdomain === "beenergy" ? "/beenergy/favicon.png" : "/favicon.ico",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const subdomain = host.split(".")[0];

  return (
    <ViewTransitions>
      <html lang="en">
        <body
          data-client={subdomain}
          className={`${inter.className} antialiased ${subdomain}`}
        >
          {children}
        </body>
      </html>
    </ViewTransitions>
  );
}
