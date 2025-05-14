"use client";
import Image from "next/image";
import ResetPassForm from "./ResetPassForm";
import EmptyToken from "./EmptyToken";

export default function ResetPassWrapper({ token }: { token: string }) {
  return (
    <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="lg:hidden mb-8">
          <Image
            src="/logo_inline.png"
            alt="Negoco CRM"
            width={150}
            height={50}
            className="w-auto h-auto mx-auto"
            priority
          />
        </div>

        {token ? <ResetPassForm token={token} /> : <EmptyToken />}
      </div>
    </div>
  );
}
