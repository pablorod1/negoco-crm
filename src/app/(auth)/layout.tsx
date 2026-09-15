import { headers } from "next/headers";
import { getBrandingForRequest } from "@/core/branding/server";
import AuthBrandPanel from "@/core/components/auth/login/AuthBrandPanel";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const branding = await getBrandingForRequest(await headers());
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen w-full flex items-stretch">
      <AuthBrandPanel branding={branding} currentYear={currentYear} />

      {children}
    </div>
  );
}
