import React, { useState, useEffect } from "react";
import { Button } from "@/core/components/ui/button";
import { Textarea } from "@/core/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/components/ui/select";
import { showCustomToast } from "@/core/components/CustomToast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/core/components/ui/dialog";
import { TicketType, TICKET_PRIORITIES } from "@/tickets/types/ticket.types";
import { User } from "@/core/types";
import { CircleCheck, CircleX, Plus } from "lucide-react";
import { formatTicketType } from "../utils/format";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Checkbox } from "@/core/components/ui/checkbox";

interface CreateTicketDialogProps {
  context: "tramite" | "cliente" | "fotovoltaica" | "comparativa";
  refId: string;
  assignedTo: string;
  userData: User;
  defaultType?: "note" | "incidencia";
  onTicketCreated: () => void;
}

const CreateTicketDialog: React.FC<CreateTicketDialogProps> = ({
  context,
  refId,
  userData,
  assignedTo,
  defaultType,
  onTicketCreated,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [formData, setFormData] = useState({
    subject: "",
    message: "",
    type_id: "",
    priority: "medium" as keyof typeof TICKET_PRIORITIES,
    is_internal: false,
  });

  // Get the selected ticket type to determine if it's a note
  const selectedTicketType = ticketTypes.find(
    (type) => type.id.toString() === formData.type_id
  );
  const isNoteType = selectedTicketType?.name === "note";

  useEffect(() => {
    if (isOpen) {
      fetchTicketTypes();
    }
  }, [isOpen]);

  // Set default ticket type when types are loaded
  useEffect(() => {
    if (ticketTypes.length > 0 && defaultType) {
      const defaultTicketType = ticketTypes.find(
        (type) => type.name === defaultType
      );
      if (defaultTicketType) {
        setFormData((prev) => ({
          ...prev,
          type_id: defaultTicketType.id.toString(),
        }));
      }
    }
  }, [ticketTypes, defaultType]);

  const fetchTicketTypes = async () => {
    try {
      const response = await fetch("/api/v2/tickets/types");
      if (response.ok) {
        const data = await response.json();
        setTicketTypes(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching ticket types:", error);
    }
  };

  const handleSubmit = async () => {
    // For note types, subject is not required
    const isSubjectRequired = !isNoteType;

    if (
      (isSubjectRequired && !formData.subject.trim()) ||
      !formData.message.trim() ||
      !formData.type_id
    ) {
      showCustomToast({
        title: "Error",
        message: "Por favor completa todos los campos requeridos",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/v2/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: isNoteType ? "Nota Rápida" : formData.subject,
          message: formData.message,
          priority: isNoteType ? "medium" : formData.priority,
          is_internal: formData.is_internal,
          context,
          ref_id: refId,
          type_id: parseInt(formData.type_id),
          assigned_to: assignedTo,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Error creating ticket");
      }

      showCustomToast({
        title: "Ticket creado",
        message: "El ticket se ha creado correctamente",
        icon: CircleCheck,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });

      setFormData({
        subject: "",
        message: "",
        type_id: "",
        priority: "medium",
        is_internal: false,
      });
      setIsOpen(false);
      onTicketCreated();
    } catch (error) {
      console.error("Error creating ticket:", error);
      showCustomToast({
        title: "Error",
        message:
          error instanceof Error ? error.message : "Error al crear el ticket",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isComercial = userData.role === "2";

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">
          <Plus size={16} />
          Crear
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isNoteType ? "Crear Nota Rápida" : "Crear Nuevo Ticket"}
          </DialogTitle>
          <DialogDescription>
            {isNoteType
              ? "Crea una nota informativa rápida para registrar información importante"
              : "Crea un nuevo ticket para gestionar consultas, incidencias o solicitudes"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="block text-sm font-medium">Tipo *</Label>
            <Select
              value={formData.type_id}
              onValueChange={(value) =>
                setFormData({ ...formData, type_id: value })
              }
            >
              <SelectTrigger>
                <SelectValue
                  className="capitalize"
                  placeholder="Seleccionar tipo"
                />
              </SelectTrigger>
              <SelectContent>
                {ticketTypes.map((type) => (
                  <SelectItem
                    className="capitalize"
                    key={type.id}
                    value={type.id.toString()}
                  >
                    <span className="capitalize">
                      {formatTicketType(type.name)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isNoteType && (
            <div className="space-y-1">
              <Label className="block text-sm font-medium">Asunto *</Label>
              <Input
                type="text"
                placeholder="Asunto del ticket"
                value={formData.subject}
                onChange={(e) =>
                  setFormData({ ...formData, subject: e.target.value })
                }
              />
            </div>
          )}

          {!isNoteType && (
            <div className="space-y-1">
              <Label className="block text-sm font-medium">Prioridad</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: keyof typeof TICKET_PRIORITIES) =>
                  setFormData({ ...formData, priority: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TICKET_PRIORITIES).map(([key, priority]) => (
                    <SelectItem key={key} value={key}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!isComercial && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="internal"
                checked={formData.is_internal}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_internal: checked as boolean })
                }
              />
              <Label htmlFor="internal" className="text-sm font-medium">
                {isNoteType
                  ? "Nota interna (solo visible para personal autorizado)"
                  : "Ticket interno (solo visible para personal autorizado)"}
              </Label>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium">
              {isNoteType ? "Mensaje *" : "Mensaje *"}
            </Label>
            <Textarea
              rows={4}
              placeholder={
                isNoteType
                  ? "Escribe tu nota informativa..."
                  : "Describe el problema, consulta o solicitud..."
              }
              value={formData.message}
              onChange={(e) =>
                setFormData({ ...formData, message: e.target.value })
              }
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading
              ? isNoteType
                ? "Creando..."
                : "Creando..."
              : isNoteType
                ? "Crear Nota"
                : "Crear Ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTicketDialog;
