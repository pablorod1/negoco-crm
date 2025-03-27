import type { Metadata } from "next";
import "./globals.css";
import { inter } from "@/fonts/fonts";
import { headers } from "next/headers";

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const subdomain = host.split(".")[0];

  return {
    title: subdomain === "beenergy" ? "Beenergy" : "Negoco Cloud",
    icons: {
      icon: subdomain === "beenergy" ? "/beenergy/favicon.png" : "/favicon.png",
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
    <html lang="en">
      <body
        data-client={subdomain}
        className={`${inter.className} antialiased ${subdomain}`}
      >
        {children}
      </body>
    </html>
  );
}
