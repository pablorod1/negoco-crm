import { useEffect, useState } from "react";
import { Progress } from "@heroui/progress";
import { CheckCircle, AlertCircle, Clock, ArrowUpCircle } from "lucide-react";

interface UploadProgressBarProps {
  progress: number;
  currentStep: string;
  filesTotal: number;
  filesUploaded: number;
  status: "idle" | "uploading" | "processing" | "success" | "error";
  error?: string;
}

export default function UploadProgressBar({
  progress,
  currentStep,
  filesTotal,
  filesUploaded,
  status,
  error,
}: UploadProgressBarProps) {
  const [statusColor, setStatusColor] = useState("bg-blue-500");
  const [statusIcon, setStatusIcon] = useState(
    <ArrowUpCircle className="text-blue-500" size={24} />
  );

  useEffect(() => {
    switch (status) {
      case "idle":
        setStatusColor("bg-gray-300");
        setStatusIcon(<Clock className="text-gray-500" size={24} />);
        break;
      case "uploading":
        setStatusColor("bg-blue-500");
        setStatusIcon(<ArrowUpCircle className="text-blue-500" size={24} />);
        break;
      case "processing":
        setStatusColor("bg-amber-500");
        setStatusIcon(<Clock className="text-amber-500" size={24} />);
        break;
      case "success":
        setStatusColor("bg-green-500");
        setStatusIcon(<CheckCircle className="text-green-500" size={24} />);
        break;
      case "error":
        setStatusColor("bg-red-500");
        setStatusIcon(<AlertCircle className="text-red-500" size={24} />);
        break;
    }
  }, [status]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center gap-3 mb-4">
          {statusIcon}
          <h3 className="text-lg font-semibold">
            {status === "idle" && "Preparando..."}
            {status === "uploading" && "Subiendo archivos"}
            {status === "processing" && "Procesando trámite"}
            {status === "success" && "¡Trámite completado!"}
            {status === "error" && "Error"}
          </h3>
        </div>

        <Progress
          value={progress}
          color="primary"
          className="h-2 mb-3"
          classNames={{
            indicator: statusColor,
          }}
        />

        <div className="text-sm text-gray-600 mb-2">{currentStep}</div>

        {status === "uploading" && (
          <div className="text-xs text-gray-500">
            Subiendo archivo {filesUploaded} de {filesTotal}
          </div>
        )}

        {status === "error" && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            {error || "Se ha producido un error durante el proceso"}
          </div>
        )}
      </div>
    </div>
  );
}
