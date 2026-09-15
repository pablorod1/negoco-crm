import { headers } from "next/headers";
import Image from "next/image";
import LoginForm from "./LoginForm";
import { getBrandingForRequest } from "@/core/branding/server";

export default async function LoginWrapper() {
  const branding = await getBrandingForRequest(await headers());

  return (
    <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-lg">
        <div className="lg:hidden mb-8">
          <Image
            src={branding.logo.defaultUrl}
            alt={branding.logo.alt}
            width={branding.logo.width}
            height={branding.logo.height}
            className="w-auto h-auto mx-auto"
          />
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
