// CustomToast.tsx
import React from "react";
import toast from "react-hot-toast";
import { LucideIcon } from "lucide-react";
import Image from "next/image";
import { Button } from "./ui/button";
import { Link } from "next-view-transitions";

// Definición de tipos para las props del componente
interface CustomToastProps {
  title?: string;
  message?: string;
  imageUrl?: string | null;
  icon?: LucideIcon;
  iconColor?: string;
  iconSize?: number;
  onClose: () => void;
  buttonText?: string;
  buttonLink?: string;
  buttonLinkText?: string;
}

// Definición de tipos para la función de mostrar toast
interface ShowCustomToastParams {
  title?: string;
  message?: string;
  imageUrl?: string | null;
  icon?: LucideIcon;
  iconColor?: string;
  iconSize?: number;
  duration?: number;
  buttonText?: string;
  buttonLink?: string;
  buttonLinkText?: string;
}

// Componente que define la estructura del toast
const CustomToast: React.FC<CustomToastProps> = ({
  title = "",
  message = "",
  imageUrl = "",
  icon: Icon = undefined,
  iconColor = "currentColor",
  iconSize = 24,
  onClose,
  buttonText = "Cerrar",
  buttonLink = undefined,
  buttonLinkText = undefined,
}) => {
  // Verificamos si se está usando un icono o una imagen
  const hasIcon = Icon !== undefined;
  const hasImage = imageUrl;

  return (
    <div className="w-full bg-white shadow-lg rounded-3xl pointer-events-auto flex border border-gray-200 ">
      <div className="flex-1 w-0 p-4">
        <div className="flex items-start">
          {/* Renderizamos o bien el icono o bien la imagen, pero no ambos */}
          {hasIcon && !hasImage && (
            <div className="flex-shrink-0 pt-0.5">
              <div className="flex items-center justify-center h-10 w-10 rounded-full">
                <Icon size={iconSize} color={iconColor} />
              </div>
            </div>
          )}
          {!hasIcon && hasImage && (
            <div className="flex-shrink-0 pt-0.5">
              <Image
                className="rounded-full"
                src={imageUrl}
                alt={title || "Avatar"}
                width={40}
                height={40}
              />
            </div>
          )}
          <div className={`${hasIcon || hasImage ? "ml-3" : ""} flex-1`}>
            {title && (
              <p className="text-sm font-medium text-gray-900">{title}</p>
            )}
            {message && <p className="mt-1 text-sm text-gray-500">{message}</p>}
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-center items-center gap-2 border-l border-gray-200 px-4">
        {buttonLink && buttonLinkText && (
          <Button variant="link" onClick={onClose}>
            <Link href={buttonLink}>{buttonLinkText}</Link>
          </Button>
        )}
        <Button variant="destructive" onClick={onClose}>
          {buttonText}
        </Button>
      </div>
    </div>
  );
};

// Función para mostrar el toast personalizado
export const showCustomToast = ({
  title = "",
  message = "",
  imageUrl = "",
  icon = undefined,
  iconColor = "currentColor",
  iconSize = 24,
  duration = 5000,
  buttonText = "Cerrar",
  buttonLink = undefined,
  buttonLinkText = undefined,
}: ShowCustomToastParams) => {
  // Validamos que no se pasen ambos (imagen e icono) al mismo tiempo
  if (imageUrl && icon) {
    console.warn(
      "CustomToast: No puedes usar imageUrl e icon al mismo tiempo. Se usará solo el icono."
    );
    imageUrl = "";
  }

  return toast.custom(
    (t) => (
      <div
        className={`max-w-md w-full transition-all duration-400 ${
          t.visible ? "animate-appearance-in" : "animate-appearance-out"
        }`}
      >
        <CustomToast
          title={title}
          message={message}
          imageUrl={imageUrl}
          icon={icon}
          iconColor={iconColor}
          iconSize={iconSize}
          buttonText={buttonText}
          onClose={() => toast.dismiss(t.id)}
          buttonLink={buttonLink}
          buttonLinkText={buttonLinkText}
        />
      </div>
    ),
    { duration }
  );
};

export default CustomToast;

// Funciones utilitarias para toasts básicos con animaciones iOS
export const showToast = {
  success: (message: string, duration = 3000) => {
    return toast.custom(
      (t) => (
        <div
          className={`max-w-md w-full transition-all duration-400 ${
            t.visible ? "animate-appearance-in" : "animate-appearance-out"
          }`}
        >
          <div className="bg-white shadow-lg rounded-3xl pointer-events-auto flex border border-gray-200">
            <div className="flex-1 w-0 p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-100">
                    <svg
                      className="h-5 w-5 text-green-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">{message}</p>
                </div>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="ml-4 flex-shrink-0 flex text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      ),
      { duration }
    );
  },

  error: (message: string, duration = 4000) => {
    return toast.custom(
      (t) => (
        <div
          className={`max-w-md w-full transition-all duration-400 ${
            t.visible ? "animate-appearance-in" : "animate-appearance-out"
          }`}
        >
          <div className="bg-white shadow-lg rounded-3xl pointer-events-auto flex border border-red-200">
            <div className="flex-1 w-0 p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-red-100">
                    <svg
                      className="h-5 w-5 text-red-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">{message}</p>
                </div>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="ml-4 flex-shrink-0 flex text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      ),
      { duration }
    );
  },

  info: (message: string, duration = 3000) => {
    return toast.custom(
      (t) => (
        <div
          className={`max-w-md w-full transition-all duration-400 ${
            t.visible ? "animate-appearance-in" : "animate-appearance-out"
          }`}
        >
          <div className="bg-white shadow-lg rounded-3xl pointer-events-auto flex border border-blue-200">
            <div className="flex-1 w-0 p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100">
                    <svg
                      className="h-5 w-5 text-blue-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">{message}</p>
                </div>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="ml-4 flex-shrink-0 flex text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      ),
      { duration }
    );
  },
};
