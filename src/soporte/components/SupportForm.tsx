"use client";
import { useState } from "react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Textarea } from "@/core/components/ui/textarea";
import { showCustomToast } from "@/core/components/CustomToast";
import { User } from "@/core/types";
import { Send, AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";

interface Props {
  userData: User;
}

interface SupportTicket {
  subject: string;
  message: string;
}

export default function SupportForm({ userData }: Props) {
  const [ticket, setTicket] = useState<SupportTicket>({
    subject: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<SupportTicket>>({});

  const handleInputChange = (field: keyof SupportTicket, value: string) => {
    setTicket((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<SupportTicket> = {};

    if (!ticket.subject.trim()) {
      newErrors.subject = "El asunto es obligatorio";
    }

    if (!ticket.message.trim()) {
      newErrors.message = "El mensaje es obligatorio";
    } else if (ticket.message.trim().length < 10) {
      newErrors.message = "El mensaje debe tener al menos 10 caracteres";
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
      const response = await fetch("/api/v2/support/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: ticket.subject,
          message: ticket.message,
          userEmail: userData.email,
          userName: userData.name,
          userOrganization: userData.organization?.name || "",
        }),
      });

      const result = await response.json();

      if (result.success) {
        showCustomToast({
          title: "Mensaje enviado",
          message:
            "Tu consulta ha sido enviada correctamente. Recibirás una respuesta en breve.",
          iconColor: "var(--success-color)",
          iconSize: 24,
          icon: CheckCircle,
        });

        // Reset form
        setTicket({
          subject: "",
          message: "",
        });
      } else {
        throw new Error(result.error || "Error al enviar el mensaje");
      }
    } catch (error) {
      console.error("Error enviando mensaje:", error);
      showCustomToast({
        title: "Error al enviar",
        message: "No se pudo enviar el mensaje. Inténtalo de nuevo.",
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: AlertCircle,
      });
    } finally {
      setLoading(false);
    }
  };

  const isFormValid =
    ticket.subject.trim() && ticket.message.trim().length >= 10;

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
            Asunto *
          </Label>
          <Input
            id="subject"
            value={ticket.subject}
            onChange={(e) => handleInputChange("subject", e.target.value)}
            disabled={loading}
            className="rounded-xl border-gray-200 focus:border-gray-300 focus:ring-0 focus:ring-offset-0"
            placeholder="Describe brevemente tu consulta"
          />
          {errors.subject && (
            <p className="text-red-600 text-xs">{errors.subject}</p>
          )}
        </div>

        {/* Message */}
        <div className="space-y-2">
          <Label
            htmlFor="message"
            className="text-sm font-medium text-gray-700"
          >
            Mensaje *
          </Label>
          <Textarea
            id="message"
            value={ticket.message}
            onChange={(e) => handleInputChange("message", e.target.value)}
            disabled={loading}
            className="rounded-xl border-gray-200 focus:border-gray-300 focus:ring-0 focus:ring-offset-0 min-h-[120px]"
            placeholder="Escribe tu consulta o describe el problema que necesitas resolver..."
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>
              {ticket.message.length >= 10 ? "✓" : "○"} Mínimo 10 caracteres
            </span>
            <span>{ticket.message.length}/1000</span>
          </div>
          {errors.message && (
            <p className="text-red-600 text-xs">{errors.message}</p>
          )}
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
                Completa todos los campos
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
            {loading ? "Enviando..." : "Enviar mensaje"}
          </Button>
        </div>
      </div>
    </div>
  );
}
