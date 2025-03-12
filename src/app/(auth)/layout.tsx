"use client";
import AnimatedBackground from "@/components/auth/login/AnimatedBackground";
import FeatureItem from "@/components/auth/login/FeatureItem";
import { Bell, PieChart, Zap } from "lucide-react";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full flex items-stretch">
      {/* Sección de marca (lado izquierdo) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[var(--primary-color-50)] via-[var(--primary-color-400)] to-[var(--primary-color-700)] p-12 flex-col justify-between relative overflow-hidden">
        {/* Animated background */}
        <AnimatedBackground />

        {/* Content container with z-index to appear above the canvas */}
        <div className="relative z-10 flex flex-col justify-between h-full">
          {/* Logo with animation */}
          <div className="overflow-hidden">
            <div className="animate-slideInFromTop">
              <Image
                src="/logo.webp"
                alt="Negoco CRM"
                width={180}
                height={60}
                className="w-auto h-auto"
                priority
              />
            </div>
          </div>

          {/* Main content with animations */}
          <div className="text-white space-y-6 max-w-lg">
            <div className="overflow-hidden">
              <h1 className="text-4xl font-bold animate-fadeIn">
                Bienvenido a Negoco Cloud
              </h1>
            </div>

            <div className="overflow-hidden">
              <p className="text-lg opacity-90 animate-fadeIn animation-delay-200">
                Gestiona tus proyectos, clientes y análisis energéticos en una
                única plataforma integrada.
              </p>
            </div>

            <div className="pt-8">
              <FeatureItem
                icon={Zap}
                text="Análisis de consumo eficiente"
                delay={0.3}
              />
              <FeatureItem
                icon={PieChart}
                text="Informes personalizados"
                delay={0.5}
              />
              <FeatureItem
                icon={Bell}
                text="Alertas de ahorro energético"
                delay={0.7}
              />
            </div>
          </div>

          <div className="text-white/70 text-sm animate-fadeIn animation-delay-1000">
            © {new Date().getFullYear()} Negoco CRM. Todos los derechos
            reservados.
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
