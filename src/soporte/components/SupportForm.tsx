"use client";
import { useState } from "react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Textarea } from "@/core/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/components/ui/select";
import { showCustomToast } from "@/core/components/CustomToast";
import { User } from "@/core/types";
import {
  Send,
  AlertCircle,
  CheckCircle,
  Upload,
  X,
  FileText,
  AlertTriangle,
} from "lucide-react";

interface Props {
  userData: User;
}

interface SupportTicket {
  subject: string;
  category: string;
  priority: string;
  description: string;
  stepsToReproduce: string;
  environment: string;
  attachments: File[];
}

const CATEGORIES = [
  { value: "bug", label: "Error/Bug" },
  { value: "feature", label: "Solicitud de funcionalidad" },
  { value: "performance", label: "Problema de rendimiento" },
  { value: "security", label: "Problema de seguridad" },
  { value: "integration", label: "Problema de integración" },
  { value: "ui", label: "Problema de interfaz" },
  { value: "data", label: "Problema con datos" },
  { value: "other", label: "Otros" },
];

const PRIORITIES = [
  { value: "low", label: "Baja", color: "text-green-600", bg: "bg-green-50" },
  {
    value: "medium",
    label: "Media",
    color: "text-yellow-600",
    bg: "bg-yellow-50",
  },
  {
    value: "high",
    label: "Alta",
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
  {
    value: "critical",
    label: "Crítica",
    color: "text-red-600",
    bg: "bg-red-50",
  },
];

const ENVIRONMENTS = [
  { value: "production", label: "Producción" },
  { value: "staging", label: "Staging/Pruebas" },
  { value: "development", label: "Desarrollo" },
  { value: "local", label: "Local" },
];

export default function SupportForm({ userData }: Props) {
  const [ticket, setTicket] = useState<SupportTicket>({
    subject: "",
    category: "",
    priority: "",
    description: "",
    stepsToReproduce: "",
    environment: "",
    attachments: [],
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<SupportTicket>>({});

  const handleInputChange = (
    field: keyof SupportTicket,
    value: string | File[]
  ) => {
    setTicket((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
      "image/",
      "application/pdf",
      "text/",
      ".doc",
      ".docx",
    ];

    const validFiles = files.filter((file) => {
      if (file.size > maxSize) {
        showCustomToast({
          title: "Archivo demasiado grande",
          message: `${file.name} excede el límite de 10MB`,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: AlertCircle,
        });
        return false;
      }

      const isValidType = allowedTypes.some(
        (type) => file.type.startsWith(type) || file.name.includes(type)
      );

      if (!isValidType) {
        showCustomToast({
          title: "Tipo de archivo no permitido",
          message: `${file.name} no es un tipo de archivo válido`,
          iconColor: "var(--danger-color)",
          iconSize: 24,
          icon: AlertCircle,
        });
        return false;
      }

      return true;
    });

    setTicket((prev) => ({
      ...prev,
      attachments: [...prev.attachments, ...validFiles],
    }));
  };

  const removeAttachment = (index: number) => {
    setTicket((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<SupportTicket> = {};

    if (!ticket.subject.trim()) {
      newErrors.subject = "El asunto es obligatorio";
    }

    if (!ticket.category) {
      newErrors.category = "Selecciona una categoría";
    }

    if (!ticket.priority) {
      newErrors.priority = "Selecciona una prioridad";
    }

    if (!ticket.description.trim()) {
      newErrors.description = "La descripción es obligatoria";
    } else if (ticket.description.trim().length < 20) {
      newErrors.description =
        "La descripción debe tener al menos 20 caracteres";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      showCustomToast({
        title: "Formulario incompleto",
        message: "Por favor, completa todos los campos obligatorios",
        iconColor: "var(--warning-color)",
        iconSize: 24,
        icon: AlertTriangle,
      });
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("subject", ticket.subject);
      formData.append("category", ticket.category);
      formData.append("priority", ticket.priority);
      formData.append("description", ticket.description);
      formData.append("stepsToReproduce", ticket.stepsToReproduce);
      formData.append("environment", ticket.environment);
      formData.append("userEmail", userData.email);
      formData.append("userName", userData.name);
      formData.append("userOrganization", userData.organization?.name || "");

      // Add attachments
      ticket.attachments.forEach((file, index) => {
        formData.append(`attachment_${index}`, file);
      });

      const response = await fetch("/api/v2/support/send-email", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        showCustomToast({
          title: "Incidencia enviada",
          message:
            "Tu solicitud ha sido enviada correctamente. Recibirás una respuesta en breve.",
          iconColor: "var(--success-color)",
          iconSize: 24,
          icon: CheckCircle,
        });

        // Reset form
        setTicket({
          subject: "",
          category: "",
          priority: "",
          description: "",
          stepsToReproduce: "",
          environment: "",
          attachments: [],
        });
      } else {
        throw new Error(result.error || "Error al enviar la incidencia");
      }
    } catch (error) {
      console.error("Error enviando incidencia:", error);
      showCustomToast({
        title: "Error al enviar",
        message: "No se pudo enviar la incidencia. Inténtalo de nuevo.",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: AlertCircle,
      });
    } finally {
      setLoading(false);
    }
  };

  const isFormValid =
    ticket.subject &&
    ticket.category &&
    ticket.priority &&
    ticket.description.length >= 20;

  return (
    <div className="space-y-6">
      {/* Form Section */}
      <div className="space-y-5">
        {/* Subject */}
        <div className="space-y-2">
          <Label
            htmlFor="subject"
            className="text-sm font-medium text-gray-700"
          >
            Asunto de la incidencia *
          </Label>
          <Input
            id="subject"
            value={ticket.subject}
            onChange={(e) => handleInputChange("subject", e.target.value)}
            disabled={loading}
            className="rounded-xl border-gray-200 focus:border-gray-300 focus:ring-0 focus:ring-offset-0"
            placeholder="Describe brevemente el problema"
          />
          {errors.subject && (
            <p className="text-red-600 text-xs">{errors.subject}</p>
          )}
        </div>

        {/* Category and Priority */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Categoría *
            </Label>
            <Select
              value={ticket.category}
              onValueChange={(value) => handleInputChange("category", value)}
              disabled={loading}
            >
              <SelectTrigger className="rounded-xl border-gray-200 focus:border-gray-300 focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-red-600 text-xs">{errors.category}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Prioridad *
            </Label>
            <Select
              value={ticket.priority}
              onValueChange={(value) => handleInputChange("priority", value)}
              disabled={loading}
            >
              <SelectTrigger className="rounded-xl border-gray-200 focus:border-gray-300 focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Selecciona prioridad" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((priority) => (
                  <SelectItem key={priority.value} value={priority.value}>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${priority.bg.replace("bg-", "bg-")} ${priority.color.replace("text-", "bg-").replace("-600", "-400")}`}
                      ></div>
                      {priority.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.priority && (
              <p className="text-red-600 text-xs">{errors.priority}</p>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label
            htmlFor="description"
            className="text-sm font-medium text-gray-700"
          >
            Descripción detallada *
          </Label>
          <Textarea
            id="description"
            value={ticket.description}
            onChange={(e) => handleInputChange("description", e.target.value)}
            disabled={loading}
            className="rounded-xl border-gray-200 focus:border-gray-300 focus:ring-0 focus:ring-offset-0 min-h-[120px]"
            placeholder="Describe detalladamente el problema, incluyendo qué esperabas que ocurriera y qué ocurrió realmente..."
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>
              {ticket.description.length >= 20 ? "✓" : "○"} Mínimo 20 caracteres
            </span>
            <span>{ticket.description.length}/1000</span>
          </div>
          {errors.description && (
            <p className="text-red-600 text-xs">{errors.description}</p>
          )}
        </div>

        {/* Steps to Reproduce */}
        <div className="space-y-2">
          <Label htmlFor="steps" className="text-sm font-medium text-gray-700">
            Pasos para reproducir (opcional)
          </Label>
          <Textarea
            id="steps"
            value={ticket.stepsToReproduce}
            onChange={(e) =>
              handleInputChange("stepsToReproduce", e.target.value)
            }
            disabled={loading}
            className="rounded-xl border-gray-200 focus:border-gray-300 focus:ring-0 focus:ring-offset-0"
            placeholder="1. Ir a la página...&#10;2. Hacer clic en...&#10;3. Ver error..."
          />
        </div>

        {/* Environment */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">
            Entorno donde ocurre
          </Label>
          <Select
            value={ticket.environment}
            onValueChange={(value) => handleInputChange("environment", value)}
            disabled={loading}
          >
            <SelectTrigger className="rounded-xl border-gray-200 focus:border-gray-300 focus:ring-0 focus:ring-offset-0">
              <SelectValue placeholder="Selecciona el entorno" />
            </SelectTrigger>
            <SelectContent>
              {ENVIRONMENTS.map((env) => (
                <SelectItem key={env.value} value={env.value}>
                  {env.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* File Attachments */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">
            Archivos adjuntos
          </Label>
          <div className="space-y-3">
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-gray-300 transition-colors">
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                disabled={loading}
                className="hidden"
                id="file-upload"
                accept="image/*,.pdf,.doc,.docx,.txt"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="h-8 w-8 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">
                    Haz clic para subir archivos
                  </p>
                  <p className="text-xs text-gray-400">
                    Imágenes, PDF, DOC, TXT (máx. 10MB cada uno)
                  </p>
                </div>
              </label>
            </div>

            {/* Attachment List */}
            {ticket.attachments.length > 0 && (
              <div className="space-y-2">
                {ticket.attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-700 truncate">
                        {file.name}
                      </span>
                      <span className="text-xs text-gray-400">
                        ({(file.size / 1024 / 1024).toFixed(1)} MB)
                      </span>
                    </div>
                    <Button
                      onClick={() => removeAttachment(index)}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-red-50"
                      disabled={loading}
                    >
                      <X className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submit Section */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-100">
          {/* Form Status */}
          <div className="text-sm text-gray-500">
            {isFormValid ? (
              <span className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                Listo para enviar
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-gray-400" />
                Completa los campos obligatorios
              </span>
            )}
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || loading}
            className="rounded-xl bg-gray-900 hover:bg-gray-800 text-white px-6"
          >
            <Send className="h-4 w-4 mr-2" />
            {loading ? "Enviando..." : "Enviar incidencia"}
          </Button>
        </div>
      </div>
    </div>
  );
}
