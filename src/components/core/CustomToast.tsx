// CustomToast.tsx
import React from "react";
import toast from "react-hot-toast";
import { LucideIcon } from "lucide-react";
import Image from "next/image";

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
  buttonColor?: string;
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
  buttonColor?: string;
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
  buttonColor = "indigo",
}) => {
  // Verificamos si se está usando un icono o una imagen
  const hasIcon = Icon !== undefined;
  const hasImage = imageUrl;

  return (
    <div className=" w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5">
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
      <div className="flex border-l border-gray-200">
        <button
          onClick={onClose}
          className={`w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-${buttonColor}-600 hover:text-${buttonColor}-500 focus:outline-none focus:ring-2 focus:ring-${buttonColor}-500`}
        >
          {buttonText}
        </button>
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
  buttonColor = "indigo",
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
        className={`max-w-md w-full duration-400 ${
          t.visible ? "animate-appearance-in" : "animate-appereance-out"
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
          buttonColor={buttonColor}
          onClose={() => toast.dismiss(t.id)}
        />
      </div>
    ),
    { duration }
  );
};

export default CustomToast;
