"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, PartyPopper, X, CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Objective } from "@/lib/core/types";
import confetti from "canvas-confetti";
import { showCustomToast } from "../core/CustomToast";

interface CelebrationAnimationProps {
  objective: Objective | null;
  onClose: () => void;
}

export const CelebrationAnimation = ({
  objective,
  onClose,
}: CelebrationAnimationProps) => {
  const [isVisible, setIsVisible] = useState(false);

  const markAsCompleted = async () => {
    try {
      const res = await fetch(`/api/objectives/update/mark-as-completed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: objective?.id }),
      });

      const { success, error } = await res.json();

      if (!success) {
        showCustomToast({
          title: "Error al marcar el objetivo como completado",
          message: error || "Ha ocurrido un error inesperado",
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
      }

      setIsVisible(false);
      showCustomToast({
        title: "Objetivo completado",
        message: "¡Felicidades por este logro!",
        icon: Trophy,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });
    } catch (error) {
      console.error("Error al marcar objetivo como completado", error);
      showCustomToast({
        title: "Error al marcar el objetivo como completado",
        message: "Ha ocurrido un error inesperado",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    }
  };
  useEffect(() => {
    if (objective) {
      setIsVisible(true);

      document.body.style.overflow = "hidden";

      // Trigger confetti effect
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = {
        startVelocity: 30,
        spread: 360,
        ticks: 60,
        zIndex: 9999,
      };

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval: NodeJS.Timeout = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);

        // Since particles fall down, start a bit higher than random
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [objective]);

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

  return (
    <AnimatePresence>
      {isVisible && objective && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed top-0 left-0 w-full h-full z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm !m-0"
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
          }}
        >
          <motion.div
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 20 }}
            transition={{ type: "spring", damping: 15, stiffness: 300 }}
            className="relative max-w-md w-full mx-4 p-6 bg-white rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2"
              onClick={() => {
                setIsVisible(false);
                setTimeout(onClose, 300);
              }}
            >
              <X className="h-4 w-4" />
            </Button>

            <div className="flex flex-col items-center text-center">
              <motion.div
                initial={{ rotate: -10, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{
                  type: "spring",
                  damping: 10,
                  stiffness: 200,
                  delay: 0.2,
                }}
                className="mb-4"
              >
                <div className="bg-yellow-100 p-4 rounded-full">
                  <Trophy className="h-16 w-16 text-yellow-500" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h2 className="text-2xl font-bold mb-2">
                  ¡Objetivo alcanzado!
                </h2>
                <div className="flex items-center justify-center gap-2 mb-4">
                  <PartyPopper className="h-5 w-5 text-primary-600" />
                  <p className="text-lg font-medium text-primary-800">
                    {getObjetivoLabel(objective.type)}
                  </p>
                  <PartyPopper className="h-5 w-5 text-primary-600" />
                </div>

                <p className="text-gray-600 mb-6">
                  Has alcanzado tu meta de{" "}
                  <span className="font-bold">
                    {objective.peak}
                    {objective.type === "comisiones"
                      ? "€"
                      : objective.type === "ratio"
                      ? "%"
                      : ""}
                  </span>
                  . ¡Felicidades por este logro!
                </p>

                <Button
                  className="bg-primary-600 hover:bg-primary-700"
                  onClick={markAsCompleted}
                >
                  Marcar como completado
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
