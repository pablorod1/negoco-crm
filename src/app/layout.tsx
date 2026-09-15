import type { Metadata } from "next";
import "./globals.css";
import { inter } from "@/fonts/fonts";
import { headers } from "next/headers";
import { ViewTransitions } from "next-view-transitions";
import { getBrandingCssVariables } from "@/core/branding/css";
import { getBrandingForRequest } from "@/core/branding/server";

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const branding = await getBrandingForRequest(headersList);

  return {
    title: branding.displayName,
    icons: {
      icon: branding.faviconUrl,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const headersList = await headers();
  const branding = await getBrandingForRequest(headersList);

  return (
    <ViewTransitions>
      <html lang="en">
        <body
          data-client={branding.tenant}
          style={getBrandingCssVariables(branding)}
          className={`${inter.className} antialiased ${branding.tenant}`}
        >
          {children}
        </body>
      </html>
    </ViewTransitions>
  );
}
