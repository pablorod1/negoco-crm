import { Metadata } from "next";
import LoginForm from "@/components/login/LoginForm";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Negoco CRM | Acceso",
  description: "Accede a tu panel de consultoría energética Negoco CRM",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex items-stretch">
      {/* Sección de marca (lado izquierdo) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[var(--primary-color-50)] to-[var(--primary-color-700)] p-12 flex-col justify-between">
        <div>
          <Image
            src="/logo.webp"
            alt="Negoco CRM"
            width={180}
            height={60}
            className="w-auto h-auto"
            priority
          />
        </div>

        <div className="text-white space-y-6">
          <h1 className="text-4xl font-bold">Bienvenido a Negoco Cloud</h1>
          <p className="text-lg opacity-90">
            Gestiona tus proyectos, clientes y análisis energéticos en una única
            plataforma integrada.
          </p>

          <div className="pt-8">
            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-white/20 p-2 rounded-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white"
                >
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <span className="text-lg">Análisis de consumo eficiente</span>
            </div>

            <div className="flex items-center space-x-4 mb-4">
              <div className="bg-white/20 p-2 rounded-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white"
                >
                  <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                  <path d="M22 12A10 10 0 0 0 12 2v10z" />
                </svg>
              </div>
              <span className="text-lg">Informes personalizados</span>
            </div>

            <div className="flex items-center space-x-4">
              <div className="bg-white/20 p-2 rounded-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <span className="text-lg">Alertas de ahorro energético</span>
            </div>
          </div>
        </div>

        <div className="text-white/70 text-sm">
          © {new Date().getFullYear()} Negoco CRM. Todos los derechos
          reservados.
        </div>
      </div>

      {/* Sección del formulario (lado derecho) */}
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

          <LoginForm />
        </div>
      </div>
    </div>
  );
}
