"use client";
import Image from "next/image";
import ResetPassForm from "./ResetPassForm";

export default function ResetPassWrapper({ token }: { token: string }) {
  return (
    <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="lg:hidden mb-8">
          <Image
            src="/logo.webp"
            alt="Negoco CRM"
            width={150}
            height={50}
            className="w-auto h-auto mx-auto"
            priority
          />
        </div>

        <ResetPassForm token={token} />
      </div>
    </div>
  );
}
