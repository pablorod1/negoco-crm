import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
