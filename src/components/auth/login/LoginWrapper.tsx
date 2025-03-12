"use client";
import Image from "next/image";
import LoginForm from "./LoginForm";

export default function LoginWrapper() {
  return (
    <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-lg">
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

        <LoginForm />
      </div>
    </div>
  );
}
