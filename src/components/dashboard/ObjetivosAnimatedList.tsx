"use client";

import { cn } from "@/lib/core/utils";
import { AnimatedList } from "../magicui/animated-list";
import { Calendar, Coins, Edit, Target } from "lucide-react";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { useEffect } from "react";
import { Objective } from "@/lib/core/types";
import Image from "next/image";

const getObjetivoIcon = (tipo: string) => {
  switch (tipo) {
    case "tramites":
      return (
        <Image
          src="/icons/tramite.webp"
          width={20}
          height={20}
          alt="Comparativas Icon"
        />
      );
    case "ratio":
      return (
        <Image
          src="/icons/comparativas2.webp"
          width={20}
          height={20}
          alt="Comparativas Icon"
        />
      );
    case "comisiones":
      return <Coins className="h-5 w-5" />;
    default:
      return <Target className="h-5 w-5" />;
  }
};

const getObjetivoLabel = (tipo: string) => {
  switch (tipo) {
    case "tramites":
      return "Trámites Activos";
    case "comisiones":
      return "Comisiones Generadas";
    case "ratio":
      return "Conversión de Comparativas";
    default:
      return "Objetivo";
  }
};

const getProgressColor = (porcentaje: number) => {
  if (porcentaje < 30) return "bg-red-500";
  if (porcentaje < 70) return "bg-yellow-500";
  return "bg-green-500";
};

interface ObjetivoProps {
  objetivo: Objective;
  handleEditObjetivo: (objetivo: Objective) => void;
}

const Objetivo = ({ objetivo, handleEditObjetivo }: ObjetivoProps) => {
  const porcentaje = Math.min(
    Math.round((objetivo.current / objetivo.peak) * 100),
    100
  );
  return (
    <div key={objetivo.id} className="border rounded-lg p-4 relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2"
        onClick={() => handleEditObjetivo(objetivo)}
      >
        <Edit className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-2 mb-2 ">
        <div className={`p-2 rounded-full bg-primary-50`}>
          {getObjetivoIcon(objetivo.type)}
        </div>
        <div>
          <h3 className="font-medium">{getObjetivoLabel(objetivo.type)}</h3>
          <div className="flex items-center text-sm text-gray-500">
            <Calendar className="h-3 w-3 mr-1" />
            <span className="capitalize">{objetivo.period}</span>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium">Progreso: {porcentaje}%</span>
          <span className="text-sm font-medium">
            {objetivo.current} / {objetivo.peak}{" "}
          </span>
        </div>
        <Progress
          value={porcentaje}
          className="h-2"
          indicatorClassName={cn(getProgressColor(porcentaje))}
        />
      </div>
    </div>
  );
};

export function ObjetivosAnimatedList({
  className,
  items,
  handleEditObjetivo,
}: {
  className?: string;
  items: Objective[];
  handleEditObjetivo: (objetivo: Objective) => void;
}) {
  useEffect(() => {
    const container = document.getElementById("ObjetivosAnimatedList");
    if (!container) return;

    const handleMouseEnter = () => {
      document.body.style.overflow = "hidden";
    };

    const handleMouseLeave = () => {
      document.body.style.overflow = "";
    };

    container.addEventListener("mouseenter", handleMouseEnter);
    container.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      container.removeEventListener("mouseenter", handleMouseEnter);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);
  return (
    <div
      id="ObjetivosAnimatedList"
      className={cn(
        "relative flex max-h-[340px] h-full w-full flex-col overflow-y-auto p-2",
        className
      )}
    >
      {items.length > 0 ? (
        <AnimatedList>
          {items.map((item, idx) => (
            <Objetivo
              handleEditObjetivo={handleEditObjetivo}
              objetivo={item}
              key={idx}
            />
          ))}
        </AnimatedList>
      ) : (
        <Objetivo objetivo={items[0]} handleEditObjetivo={handleEditObjetivo} />
      )}
    </div>
  );
}
