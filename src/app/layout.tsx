import type { Metadata } from "next";
import "./globals.css";
import { inter } from "@/fonts/fonts";

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
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
