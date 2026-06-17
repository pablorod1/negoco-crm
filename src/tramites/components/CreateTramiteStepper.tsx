import { User } from "@/core/types";
import type React from "react";
import { CheckCircle, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/core/utils";

interface StepperProps {
  steps: number;
  currentStep: number;
  selectedComercial: User;
  selectedClient: {
    id: string;
    name: string;
    last_name: string;
    type: string;
    document_type: string;
    document_number: string;
  };
  setActiveStep: React.Dispatch<React.SetStateAction<number>>;
  comparativa?: boolean;
}

const comparativaStepsTexts = [
  "Comparativa",
  "Comercial",
  "Cliente",
  "Contratos",
  "Documentos",
  "Resumen",
];
const stepsTexts = [
  "Comercial",
  "Cliente",
  "Contratos",
  "Documentos",
  "Resumen",
];

export const CreateTramiteStepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
  selectedComercial,
  selectedClient,
  setActiveStep,
  comparativa,
}) => {
  // Get appropriate text array based on comparativa flag
  const stepTexts = comparativa ? comparativaStepsTexts : stepsTexts;

  // Debug current step display - make sure we access the correct step texts
  const currentStepText = stepTexts[currentStep] || "Step Not Found";

  return (
    <div className="w-full relative py-2">
      {/* Top mobile indicator - fixed to show actual step number */}
      <div className="flex justify-between items-center mb-2 md:hidden">
        <div className="text-sm font-medium text-gray-600">
          Paso {currentStep + 1} de {steps}
        </div>
        <div className="text-primary font-semibold text-sm">
          {currentStepText}
        </div>
      </div>

      {/* New stepper design with cards */}
      <div className="hidden md:flex justify-between items-start w-full">
        {Array.from({ length: steps }).map((_, i) => {
          // Determine step state
          const isCompleted = i < currentStep;
          const isActive = i === currentStep;
          const isPending = i > currentStep;
          const isClickable = isCompleted || isActive;
          const stepLabel = stepTexts[i];

          // Determine if this is an even step (for alternating layout)
          const isEvenStep = i % 2 === 0;

          return (
            <div
              key={i}
              className={cn("flex flex-col gap-2 items-center relative")}
              style={{ width: `${100 / steps}%` }}
            >
              {/* Connector line - adjusted for even/odd layout */}
              <div className={cn("absolute w-full h-0.5 top-5")}>
                {/* Only render line for non-first steps */}
                {i > 0 && (
                  <div
                    className={cn(
                      "absolute left-0 right-1/2 h-full",
                      isCompleted || isActive ? "bg-primary" : "bg-gray-200"
                    )}
                  />
                )}
                {/* Only render line for non-last steps */}
                {i < steps - 1 && (
                  <div
                    className={cn(
                      "absolute right-0 left-1/2 h-full",
                      isCompleted ? "bg-primary" : "bg-gray-200"
                    )}
                  />
                )}
              </div>

              {/* Step indicator with number/icon */}
              <motion.div
                initial={{ scale: 1 }}
                animate={{
                  scale: isActive ? 1.1 : 1,
                  transition: { duration: 0.3 },
                }}
                className={cn(
                  "relative z-10 flex items-center justify-center rounded-full w-10 h-10 transition-all duration-300 ease-in-out cursor-pointer",
                  isCompleted
                    ? "bg-primary text-white shadow-md"
                    : isActive
                      ? "border-2 border-primary text-primary bg-white shadow-md"
                      : "border-2 border-gray-300 text-gray-400 bg-white"
                )}
                onClick={() => isClickable && setActiveStep(i)}
                role={isClickable ? "button" : undefined}
                tabIndex={isClickable ? 0 : -1}
              >
                {isCompleted ? (
                  <CheckCircle size={18} />
                ) : (
                  <span className="font-medium">{i + 1}</span>
                )}
              </motion.div>

              {/* Step label - adjusted for even/odd layout */}
              <div
                className={cn(
                  "text-sm font-medium text-center transition-all duration-300 ease-in-out mb-2",
                  isActive
                    ? "text-primary font-semibold"
                    : isCompleted
                      ? "text-gray-700"
                      : "text-gray-400"
                )}
              >
                {stepLabel}
              </div>

              {/* Step tooltip on hover - adjusted for even/odd layout */}
              {isPending && (
                <div
                  className={cn(
                    "absolute left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap",
                    isEvenStep ? "-bottom-8" : "-top-8"
                  )}
                >
                  {`Próximo paso: ${stepLabel}`}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile stepper design */}
      <div className="md:hidden flex flex-col space-y-3 mt-2">
        {Array.from({ length: steps }).map((_, i) => {
          const isCompleted = i < currentStep;
          const isActive = i === currentStep;
          const isPending = i > currentStep;
          const isClickable = isCompleted || isActive;
          const stepLabel = stepTexts[i];

          return (
            <div
              key={i}
              className={cn(
                "flex items-center w-full rounded-lg p-2 cursor-pointer transition-all duration-300 group",
                isActive
                  ? "bg-primary/10 border border-primary/30"
                  : isCompleted
                    ? "bg-gray-50 border border-gray-200"
                    : isPending
                      ? "bg-gray-50 border border-gray-200 opacity-60"
                      : "bg-gray-50 border border-gray-200"
              )}
              role="button"
              tabIndex={isClickable ? 0 : -1}
              onClick={() => isClickable && setActiveStep(i)}
              onKeyDown={(e) => {
                if (isClickable && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  setActiveStep(i);
                }
              }}
            >
              <div
                className={cn(
                  "flex items-center justify-center rounded-full min-w-8 h-8 mr-3",
                  isCompleted
                    ? "bg-primary text-white"
                    : isActive
                      ? "border-2 border-primary text-primary bg-white"
                      : "border-2 border-gray-300 text-gray-400 bg-white"
                )}
              >
                {isCompleted ? (
                  <CheckCircle size={16} />
                ) : (
                  <span className="font-medium text-sm">{i + 1}</span>
                )}
              </div>

              <div className="flex-1">
                <div
                  className={cn(
                    "text-sm font-medium",
                    isActive
                      ? "text-primary"
                      : isCompleted
                        ? "text-gray-700"
                        : "text-gray-400"
                  )}
                >
                  {stepLabel}
                </div>

                {(i === 0 || i === 1) && !comparativa && isCompleted && (
                  <div className="text-xs text-gray-500 mt-1">
                    {i === 0
                      ? selectedComercial.name
                      : `${selectedClient.name} ${selectedClient.last_name} (${selectedClient.document_number})`}
                  </div>
                )}
              </div>

              {isClickable && i !== currentStep && (
                <ChevronRight size={16} className="text-gray-400" />
              )}

              {isPending && !isClickable && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 ml-auto text-xs text-gray-500">
                  Bloqueado
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
