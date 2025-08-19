import type React from "react";

interface StepperProps {
  steps: number;
  currentStep: number;
}

const stepsTexts = ["Producto", "Cliente", "Documentación", "Observaciones"];

export const CreateFotovoltaicaStepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
}) => {
  return (
    <div className="w-full relative">
      <div className="flex justify-between mb-2 ">
        {Array.from({ length: steps }, (_, i) => (
          <div key={i} className="flex flex-col items-center z-50">
            <div
              className={`w-8 h-8 flex items-center justify-center rounded-full border-2 ${
                i < currentStep
                  ? "bg-primary border-primary text-primary-foreground"
                  : i === currentStep
                    ? "border-primary text-primary bg-white"
                    : "border-gray-300 text-gray-300 bg-white"
              }`}
            >
              {i < currentStep ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <div className="text-xs mt-1">{stepsTexts[i]}</div>
          </div>
        ))}
      </div>
      <div className="w-[98%] ms-1 bg-gray-200 rounded-full h-2.5 absolute top-3 left-0 z-0">
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

