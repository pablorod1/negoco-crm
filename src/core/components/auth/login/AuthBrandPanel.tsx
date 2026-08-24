"use client";

import type { ResolvedBranding } from "@/core/branding/types";
import { BarChart, CheckCircle, ClipboardList } from "lucide-react";
import Image from "next/image";
import AnimatedBackground from "./AnimatedBackground";
import FeatureItem from "./FeatureItem";

export default function AuthBrandPanel({
  branding,
  currentYear,
}: {
  branding: ResolvedBranding;
  currentYear: number;
}) {
  return (
    <div className="hidden lg:flex lg:w-2/3 bg-gradient-to-br from-primary-50 via-primary-400 to-primary-700 p-12 flex-col justify-between relative overflow-hidden">
      <AnimatedBackground />

      <div className="relative z-10 flex flex-col justify-between h-full">
        <div className="overflow-hidden">
          <div className="animate-slideInFromTop flex h-20 w-32 items-center justify-start overflow-hidden">
            <Image
              src={branding.logo.defaultUrl}
              alt={branding.logo.alt}
              width={branding.logo.width}
              height={branding.logo.height}
              className="h-auto w-auto max-h-20 max-w-32 object-contain"
              priority
            />
          </div>
        </div>

        <div className="text-white space-y-6 max-w-lg">
          <div className="overflow-hidden">
            <h1 className="text-4xl font-bold animate-fadeIn">
              Bienvenido a {branding.displayName}
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
          © {currentYear} {branding.displayName}. Todos los derechos reservados.
        </div>
      </div>
    </div>
  );
}
