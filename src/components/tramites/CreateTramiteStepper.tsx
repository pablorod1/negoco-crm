import { User } from "@/lib/core/types";
import type React from "react";
import AvatarComponent from "../core/AvatarComponent";
import { Badge } from "../ui/badge";
import { CheckCircle } from "lucide-react";

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
  return (
    <div className="w-full relative">
      <div className="flex items-center justify-between mb-2 ">
        {Array.from({ length: steps }, (_, i) => (
          <div key={i} className="flex flex-col items-center z-50">
            <div
              className={`w-8 h-8 flex items-center justify-center rounded-full border-2 animate-size transition-all duration-500 ease-in-out ${
                i < currentStep
                  ? "bg-primary border-primary w-auto h-auto py-2 px-4 rounded-md shadow text-white"
                  : i === currentStep
                    ? "border-primary text-primary bg-white"
                    : "border-gray-300 text-gray-300 bg-white"
              }`}
            >
              {i < currentStep ? (
                <>
                  {i === 0 && !comparativa ? (
                    <div
                      className="cursor-pointer flex items-center justify-center w-full h-full gap-4 flex-nowrap overflow-hidden"
                      onClick={() => setActiveStep(0)}
                    >
                      <AvatarComponent
                        userData={selectedComercial}
                        className="!rounded-full size-8"
                        textSize="text-black text-sm"
                      />
                      <span className="text-sm font-semibold text-nowrap">
                        {selectedComercial.name}
                      </span>
                    </div>
                  ) : i === 1 && !comparativa ? (
                    <div
                      className="cursor-pointer flex flex-col items-start w-full flex-nowrap overflow-hidden"
                      onClick={() => setActiveStep(1)}
                    >
                      <div className="flex justify-between items-center gap-12 w-full">
                        <span className="text-sm font-semibold text-nowrap">
                          {selectedClient.name} {selectedClient.last_name}
                        </span>
                        <Badge variant="info">{selectedClient.type}</Badge>
                      </div>
                      <span className="text-xs text-white text-nowrap">
                        {selectedClient.document_type} -{" "}
                        {selectedClient.document_number}
                      </span>
                    </div>
                  ) : (
                    <div
                      className="cursor-pointer"
                      onClick={() => setActiveStep(i)}
                    >
                      <CheckCircle className="text-white" size={20} />
                    </div>
                  )}
                </>
              ) : i === 5 && i === currentStep ? (
                <div
                  className="cursor-pointer"
                  onClick={() => setActiveStep(i)}
                >
                  <CheckCircle className="text-white" size={20} />
                </div>
              ) : (
                i + 1
              )}
            </div>
            <div className="text-sm font-medium mt-2">
              {comparativa ? comparativaStepsTexts[i] : stepsTexts[i]}
            </div>
          </div>
        ))}
      </div>
      <div
        className={`w-full ms-1 bg-gray-200 rounded-full h-2.5 absolute left-0 z-0 ${currentStep > 0 && !comparativa ? "top-6" : currentStep > 0 && comparativa ? "top-4" : "top-3"}`}
      >
        <div
          className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-in-out"
          style={{ width: `${(currentStep / (steps - 1)) * 100}%` }}
          role="progressbar"
          aria-valuenow={(currentStep / (steps - 1)) * 100}
          aria-valuemin={0}
          aria-valuemax={100}
        ></div>
      </div>
    </div>
  );
};
