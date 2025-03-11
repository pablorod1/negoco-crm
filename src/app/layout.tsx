import type { Metadata } from "next";
import "./globals.css";
import { inter } from "@/fonts/fonts";

export const metadata: Metadata = {
  title: "Negoco CRM",
  description: "Negoco CRM",
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
