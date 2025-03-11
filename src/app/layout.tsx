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
      {/* <head>
        <Script
          crossOrigin="anonymous"
          src="//unpkg.com/react-scan/dist/auto.global.js"
        />
      </head> */}
      {children}
    </html>
  );
}
