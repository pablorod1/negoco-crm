import React from "react";
import { Card } from "@/components/ui/card";
import { NumberTicker } from "../ui/number-ticker";

interface Props {
  title: string;
  value?: number;
  icon?: React.ReactNode;
  description?: string;
  color?: "pending" | "warning" | "success" | "danger" | "primary";
  loading?: boolean;
}

const DashboardCard = ({
  title,
  value,
  icon,
  description,
  color = "primary",
  loading,
}: Props) => {
  const getBackgroundColor = (color: string) => {
    switch (color) {
      case "pending":
        return "bg-[var(--bg-pending)]";
      case "warning":
        return "bg-[var(--bg-warning)]";
      case "success":
        return "bg-[var(--bg-success)]";
      case "danger":
        return "bg-[var(--danger-color)]";
      case "primary":
      default:
        return "bg-[var(--primary-color-50)]";
    }
  };

  return (
    <Card
      className={`relative h-auto backdrop-blur-lg border-0 shadow-[0_2px_6px_rgba(0,0,0,0.1)] group transition-colors duration-300 ${
        loading ? "bg-gray-200" : "bg-white"
      } `}
    >
      {/* Skeleton con transición de opacidad */}
      <div
        className={`absolute inset-0 flex items-center justify-center rounded-lg transition-opacity duration-300 ${
          loading ? "opacity-100" : "opacity-0 pointer-events-none -z-50"
        }`}
      >
        <div className="animate-pulse h-full w-full bg-gray-200 rounded-lg"></div>
      </div>

      {/* Contenido principal con opacidad transicionada */}
      <div
        className={`relative h-full p-6 flex flex-col transition-opacity duration-300 ${
          loading ? "opacity-0" : "opacity-100 "
        }`}
      >
        {/* Elementos decorativos de fondo */}
        <div
          className={`absolute inset-0 opacity-10 ${getBackgroundColor(color)}`}
        />
        <div
          className={`absolute -left-8 -bottom-8 w-40 h-40 rounded-full blur-2xl opacity-20 ${getBackgroundColor(
            color
          )}`}
        />
        <div
          className={`absolute -right-8 -top-8 w-40 h-40 rounded-full blur-2xl opacity-20 ${getBackgroundColor(
            color
          )}`}
        />

        {/* Encabezado */}
        <div className="flex justify-between items-start">
          <h3
            className={`text-xl font-medium text-[var(--primary-color-800)] transform group-hover:scale-105 transition-transform duration-300`}
          >
            {title}
          </h3>
          <div
            className={`p-2 rounded-lg backdrop-blur-md bg-white/90 shadow-md 
            transform group-hover:-translate-y-1 group-hover:rotate-3 transition-all duration-300
            ${getBackgroundColor(color)} bg-opacity-10`}
          >
            {icon}
          </div>
        </div>

        {/* Valor principal */}
        <div className="flex-1 flex items-center z-50">
          <div>
            {value ? (
              <NumberTicker
                value={value}
                className={`text-5xl font-bold text-[var(--primary-color-800)] tracking-tight `}
              />
            ) : (
              <span
                className={`text-5xl font-bold text-[var(--primary-color-800)] tracking-tight `}
              >
                0
              </span>
            )}
          </div>
        </div>

        {/* Descripción */}
        {description && (
          <div className="transform group-hover:translate-y-1 transition-transform duration-300">
            <div
              className={`w-8 h-0.5 ${getBackgroundColor(
                color
              )} opacity-100 mb-2`}
            />
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default DashboardCard;
