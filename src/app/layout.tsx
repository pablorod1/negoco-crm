import type { Metadata } from "next";
import "./globals.css";
import { inter } from "@/fonts/fonts";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Negoco Cloud",
  description: "Negoco Cloud",
  openGraph: {
    images: "/opengraph-image.png",
  },
  metadataBase: new URL("https://negococloud.es"),
  alternates: {
    canonical: "/",
    languages: {
      "es-ES": "/es-ES",
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = headers();
  const host = (await headersList).get("host") || "";
  const subdomain = host.split(".")[0]; // Extrae el subdominio
  console.log(subdomain);
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
