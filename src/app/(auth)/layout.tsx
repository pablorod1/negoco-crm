"use client";
import { useState, useEffect } from "react";
import AnimatedBackground from "@/components/auth/login/AnimatedBackground";
import FeatureItem from "@/components/auth/login/FeatureItem";
import { BarChart, CheckCircle, ClipboardList } from "lucide-react";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [data, setData] = useState<{ host: string; image: string } | null>(
    null
  );

  useEffect(() => {
    const host = window.location.hostname;
    const image = host.includes("beenergy") ? "/beenergy.png" : "/logo.webp";
    setData({ host, image });
  }, []);

  if (!data) return null; // Evita renderizar hasta que el host esté definido

  return (
    <div className="min-h-screen w-full flex items-stretch">
      {/* Sección de marca (lado izquierdo) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-50 via-primary-400 to-primary-700 p-12 flex-col justify-between relative overflow-hidden">
        {/* Animated background */}
        <AnimatedBackground />

        {/* Content container */}
        <div className="relative z-10 flex flex-col justify-between h-full">
          {/* Logo con animación */}
          <div className="overflow-hidden">
            <div className="animate-slideInFromTop">
              <Image
                src={data.image}
                alt="Negoco CRM"
                width={180}
                height={60}
                className="w-auto h-auto"
                priority
              />
            </div>
          </div>

          {/* Contenido principal */}
          <div className="text-white space-y-6 max-w-lg">
            <div className="overflow-hidden">
              <h1 className="text-4xl font-bold animate-fadeIn">
                Bienvenido a Negoco Cloud
              </h1>
            </div>

            <div className="overflow-hidden">
              <p className="text-lg opacity-90 animate-fadeIn animation-delay-200">
                Gestiona clientes, contratos y análisis energéticos desde una
                única plataforma diseñada para optimizar tu negocio.
              </p>
            </div>

            <div className="pt-8">
              <FeatureItem
                icon={BarChart}
                text="Análisis detallado de rendimiento"
                delay={0.3}
              />
              <FeatureItem
                icon={ClipboardList}
                text="Historial completo de gestiones"
                delay={0.5}
              />
              <FeatureItem
                icon={CheckCircle}
                text="Optimización de tiempos y recursos"
                delay={0.7}
              />
            </div>
          </div>

          <div className="text-white/70 text-sm animate-fadeIn animation-delay-1000">
            © {new Date().getFullYear()} Negoco Cloud. Todos los derechos
            reservados.
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
