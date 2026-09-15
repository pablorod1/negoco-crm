import { headers } from "next/headers";
import Image from "next/image";
import ResetPassForm from "./ResetPassForm";
import EmptyToken from "./EmptyToken";
import { getBrandingForRequest } from "@/core/branding/server";

export default async function ResetPassWrapper({ token }: { token: string }) {
  const branding = await getBrandingForRequest(await headers());

  return (
    <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="lg:hidden mb-8">
          <Image
            src={branding.logo.defaultUrl}
            alt={branding.logo.alt}
            width={branding.logo.width}
            height={branding.logo.height}
            className="w-auto h-auto mx-auto"
            priority
          />
        </div>

        {token ? (
          <ResetPassForm token={token} />
        ) : (
          <EmptyToken logo={branding.logo} />
        )}
      </div>
    </div>
  );
}
