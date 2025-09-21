"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/core/components/ui/dialog";
import { Button } from "@/core/components/ui/button";
import { CircleX, User, UserCheck, X } from "lucide-react";
import { showCustomToast } from "@/core/components/CustomToast";
import { useUser } from "@/core/contexts/UserContext";
import LoadingStateModal from "@/core/components/LoadingStateModal";
import StandaloneClientForm from "./StandaloneClientForm";
import {
  createEmptySecondForm,
  SecondForm,
  SecondFormError,
  SignerForm,
  SignerFormError,
  createEmptySecondFormError,
  createEmptySignerFormError,
} from "@/core/validation/validation.types";
import { FormValidationResult } from "@/core/validation/validation.model";

// Custom minimal validation for client creation
// Only validates fields marked as isRequired in StandaloneClientForm
const minimumClientValidation = (
  formData: SecondForm
): FormValidationResult<SecondFormError> => {
  const errors = createEmptySecondFormError();
  let hasErrors = false;

  // Only validate required fields based on isRequired props in the form
  // Note: 'type' field doesn't have errors in SecondFormError (it's always valid)

  // name - required
  if (!formData.name || formData.name.trim() === "") {
    errors.name = "El nombre es requerido";
    hasErrors = true;
  }

  // document_type - required
  if (!formData.document_type || formData.document_type.trim() === "") {
    errors.document_type = "El tipo de documento es requerido";
    hasErrors = true;
  }

  // Basic validation for type (not in error object but still required)
  if (!formData.type || formData.type.trim() === "") {
    hasErrors = true;
  }

  return {
    succeeded: !hasErrors,
    errors: errors,
  };
};

// Custom minimal validation for signer
// Only validates essential signer fields
const minimumSignerValidation = (
  signerData: SignerForm
): FormValidationResult<SignerFormError> => {
  const errors = createEmptySignerFormError();
  let hasErrors = false;

  // For signers, we only require name as essential field
  if (!signerData.name || signerData.name.trim() === "") {
    errors.name = "El nombre del firmante es requerido";
    hasErrors = true;
  }

  return {
    succeeded: !hasErrors,
    errors: errors,
  };
};
import { ClientDB, SignerDB } from "@/tramites/types";
import {
  createEmptyClientDB,
  createEmptySignerDB,
} from "@/tramites/utils/tramite.factories";

interface CreateClientDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onClientCreated?: (client: ClientDB) => void;
}

export default function CreateClientDialog({
  isOpen,
  onClose,
  onClientCreated,
}: CreateClientDialogProps) {
  const { userData } = useUser();
  const [loading, setLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState<SecondForm>(createEmptySecondForm());
  const [errors, setErrors] = useState<SecondFormError>(
    createEmptySecondFormError
  );
  const [signerData, setSignerData] = useState<SignerForm | null>(null);
  const [signerErrors, setSignerErrors] = useState<SignerFormError>(
    createEmptySignerFormError
  );

  // Reset form when dialog closes
  const handleClose = () => {
    setFormData(createEmptySecondForm());
    setErrors(createEmptySecondFormError);
    setSignerData(null);
    setSignerErrors(createEmptySignerFormError);
    onClose();
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!userData) {
      showCustomToast({
        title: "Error",
        message: "No se pudo obtener la información del usuario",
        icon: CircleX,
        iconColor: "var(--danger-color)",
      });
      return;
    }

    // Validate main form using minimal validation
    const formValidationResult = minimumClientValidation(formData);
    setErrors(formValidationResult.errors);

    let signerIsValid = true;
    // Validate signer if required using minimal validation
    if (signerData) {
      const signerValidationResult = minimumSignerValidation(signerData);
      setSignerErrors(signerValidationResult.errors);
      signerIsValid = signerValidationResult.succeeded;
    }

    if (!formValidationResult.succeeded || !signerIsValid) {
      showCustomToast({
        title: "Errores en el formulario",
        message: "Por favor revisa los campos marcados en rojo",
        icon: CircleX,
        iconColor: "var(--danger-color)",
      });
      return;
    }

    setLoading(true);

    try {
      // Create client object
      const newClient: ClientDB = {
        ...createEmptyClientDB(),
        name: formData.name,
        last_name: formData.last_name || "",
        email: formData.email || "",
        phone: formData.phone || "",
        address: formData.address || "",
        postal_code: formData.postal_code || "",
        province: formData.province || "",
        city: formData.city || "",
        document_type: formData.document_type,
        document_number: formData.document_number || "",
        IBAN: formData.IBAN || "",
        type: formData.type,
      };

      // Create signer object if needed
      let newSigner: SignerDB | null = null;
      if (signerData) {
        newSigner = {
          ...createEmptySignerDB(),
          name: signerData.name || "",
          last_name: signerData.last_name || "",
          email: signerData.email || "",
          phone: signerData.phone || "",
          document_number: signerData.document_number || "",
          cargo: signerData.cargo || null,
          client_id: newClient.id,
        };
      }

      // Call API to create client
      const response = await fetch("/api/v2/clients", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client: newClient,
          signer: newSigner,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Error al crear el cliente");
      }

      showCustomToast({
        title: "Cliente creado",
        message: `El cliente ${newClient.name} ha sido creado exitosamente`,
        icon: UserCheck,
        iconColor: "var(--success-color)",
      });

      // Call callback if provided
      if (onClientCreated) {
        onClientCreated(newClient);
      }

      handleClose();
    } catch (error) {
      console.error("Error creating client:", error);
      showCustomToast({
        title: "Error",
        message:
          error instanceof Error ? error.message : "Error al crear el cliente",
        icon: CircleX,
        iconColor: "var(--danger-color)",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {loading && (
        <LoadingStateModal
          title="Creando cliente..."
          description="Espere unos momentos mientras creamos el cliente"
        />
      )}

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-7xl w-full max-h-[90vh] p-0 flex flex-col">
          <DialogHeader className="px-6 py-3 border-b border-gray-200 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                  <User className="h-4 w-4 text-primary-600" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold text-gray-900">
                    Crear nuevo cliente
                  </DialogTitle>
                  <p className="text-xs text-gray-600">
                    Registra un nuevo cliente en el sistema
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 px-6 py-4 overflow-hidden">
            <StandaloneClientForm
              formData={formData}
              setFormData={setFormData}
              errors={errors}
              setErrors={setErrors}
              signerData={signerData}
              setSignerData={setSignerData}
              signerErrors={signerErrors}
              setSignerErrors={setSignerErrors}
            />
          </div>

          <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-end gap-3 shrink-0">
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <User className="h-4 w-4" />
              Crear cliente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
