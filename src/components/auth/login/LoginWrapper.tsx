"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import LoginForm from "./LoginForm";

export default function LoginWrapper() {
  const [data, setData] = useState<{ host: string; image: string } | null>(
    null
  );

  useEffect(() => {
    const host = window.location.hostname;
    const image = host.includes("beenergy") ? "/beenergy.png" : "/logo.webp";
    setData({ host, image });
  }, []);

  return (
    <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-lg">
        <div className="lg:hidden mb-8">
          {data && (
            <Image
              src={data.image}
              alt="Negoco CRM"
              width={150}
              height={50}
              className="w-auto h-auto mx-auto"
            />
          )}
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
