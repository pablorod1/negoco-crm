import type React from "react";

interface StepperProps {
  steps: number;
  currentStep: number;
}

const stepsTexts = ["Información", "Documentos", "Finalización"];

export const CreateComparativaStepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
}) => {
  return (
    <div className="w-full relative mt-6">
      {/* Step indicators */}
      <div className="flex justify-between items-center mb-3">
        {Array.from({ length: steps }, (_, i) => (
          <div key={i} className="flex flex-col items-center z-10 relative">
            {/* Step circle */}
            <div
              className={`
                w-8 h-8 flex items-center justify-center rounded-full border transition-all duration-300
                ${
                  i < currentStep
                    ? "bg-gray-900 border-gray-900 text-white"
                    : i === currentStep
                      ? "border-gray-900 text-gray-900 bg-white ring-2 ring-gray-100"
                      : "border-gray-300 text-gray-400 bg-white"
                }
              `}
            >
              {i < currentStep ? (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <span className="text-xs font-medium">{i + 1}</span>
              )}
            </div>

            {/* Step label */}
            <div
              className={`
                text-xs mt-2 font-medium transition-colors duration-300 text-center
                ${i <= currentStep ? "text-gray-900" : "text-gray-400"}
              `}
            >
              {stepsTexts[i]}
            </div>
          </div>
        ))}
      </div>

      {/* Progress line */}
      <div className="absolute top-4 left-0 right-0 h-px bg-gray-200 rounded-full z-0">
        <div
          className="h-full bg-gray-900 rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${(currentStep / (steps - 1)) * 100}%`,
            transformOrigin: "left center",
          }}
        />
      </div>
    </div>
  );
};
