"use client";

import React from "react";
import {
  createEmptySignerForm,
  SecondForm,
  SecondFormError,
  SignerForm,
  SignerFormError,
} from "@/core/validation/validation.types";
import {
  InputComponent,
  SelectComponent,
} from "@/tramites/components/createTramite/InputComponent";
import { CARGOS, CLIENT_TYPES, DOCUMENT_TYPES } from "@/tramites/constants";
import { UserCheck } from "lucide-react";

interface StandaloneClientFormProps {
  formData: SecondForm;
  errors: SecondFormError;
  signerData: SignerForm | null;
  setFormData: React.Dispatch<React.SetStateAction<SecondForm>>;
  setErrors: React.Dispatch<React.SetStateAction<SecondFormError>>;
  setSignerData: React.Dispatch<React.SetStateAction<SignerForm | null>>;
  setSignerErrors: React.Dispatch<React.SetStateAction<SignerFormError>>;
  signerErrors: SignerFormError;
}

export default function StandaloneClientForm({
  formData,
  setFormData,
  setErrors,
  setSignerData,
  setSignerErrors,
  errors,
  signerData,
  signerErrors,
}: StandaloneClientFormProps) {
  // Handler for client type changes
  const handleClientTypeChange = (value: string) => {
    setFormData((prevState) => ({
      ...prevState,
      type: value,
    }));

    // Reset signer data based on client type
    const needsSigner =
      value === "Empresa" || value === "Comunidad de Propietarios";
    setSignerData(needsSigner ? createEmptySignerForm : null);
  };

  // Unified handler for all form field changes
  const handleChange = (
    name: string,
    value: string,
    isSignerField: boolean = false
  ) => {
    if (isSignerField) {
      const fieldName = name.split(".")[1];
      setSignerData((prevState) => {
        if (!prevState) return null;
        return {
          ...prevState,
          [fieldName]: value,
        };
      });
      setSignerErrors((prevState) => ({
        ...prevState,
        [fieldName]: "",
      }));
    } else {
      setFormData((prevState) => ({
        ...prevState,
        [name]: value,
      }));
      setErrors((prevState) => ({
        ...prevState,
        [name]: "",
      }));

      // Handle client type change which affects signer data
      if (name === "type") {
        const needsSigner =
          value === "Empresa" || value === "Comunidad de Propietarios";
        setSignerData(needsSigner ? createEmptySignerForm : null);
      }
    }
  };

  // Input field change handler (wrapper around handleChange)
  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const { name, value } = e.target;
    const isSignerField = name.includes("signer");
    handleChange(name, value, isSignerField);
  };

  // Select component change handler (wrapper around handleChange)
  const handleSelectChange = (name: string, value: string) => {
    const isSignerField = name.includes("signer");
    handleChange(name, value, isSignerField);
  };

  // Determine if we need to show signer data form
  const showSignerForm =
    (formData.type === "Empresa" ||
      formData.type === "Comunidad de Propietarios") &&
    signerData;

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Two-column layout for client and signer - responsive */}
      <div
        className={`grid gap-4 lg:gap-6 h-full ${showSignerForm ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"}`}
      >
        {/* Client Information Column */}
        <div className="space-y-3 lg:space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="h-4 w-4 text-primary-600" />
            <h3 className="text-sm font-semibold text-gray-900">
              Información del cliente
            </h3>
          </div>

          {/* Client Type and Document - Compact row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <SelectComponent
                name="type"
                items={[...CLIENT_TYPES]}
                onChange={handleClientTypeChange}
                label="Tipo"
                selectedKey={formData.type}
                isRequired
              />
            </div>
            <InputComponent
              name="name"
              label="Nombre/Razón Social"
              onChange={handleFieldChange}
              type="text"
              errors={errors.name}
              value={formData.name}
              isRequired
            />
            {/* Last Name (only for individuals) */}
            {formData.type !== "Empresa" &&
              formData.type !== "Comunidad de Propietarios" && (
                <InputComponent
                  name="last_name"
                  label="Apellidos"
                  onChange={handleFieldChange}
                  type="text"
                  value={formData.last_name}
                />
              )}
          </div>

          {/* Document Number and Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-3">
            <div className="space-y-1">
              <SelectComponent
                name="document_type"
                items={
                  formData.type &&
                  DOCUMENT_TYPES[formData.type as keyof typeof DOCUMENT_TYPES]
                    ? [
                        ...DOCUMENT_TYPES[
                          formData.type as keyof typeof DOCUMENT_TYPES
                        ].documentTypes,
                      ]
                    : []
                }
                onChange={(value: string) =>
                  handleSelectChange("document_type", value)
                }
                errors={errors.document_type}
                label="Documento"
                selectedKey={formData.document_type as string}
                isRequired
              />
            </div>
            <InputComponent
              name="document_number"
              label="Número"
              onChange={handleFieldChange}
              errors={errors.document_number}
              value={formData.document_number}
              type="text"
            />
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-3">
            <InputComponent
              name="email"
              label="Email"
              onChange={handleFieldChange}
              type="email"
              errors={errors.email}
              value={formData.email}
            />
            <InputComponent
              name="phone"
              label="Teléfono"
              onChange={handleFieldChange}
              type="text"
              errors={errors.phone}
              value={formData.phone}
            />
          </div>

          {/* IBAN */}
          <InputComponent
            name="IBAN"
            label="IBAN"
            onChange={handleFieldChange}
            type="text"
            errors={errors.IBAN}
            value={formData.IBAN}
          />

          {/* Address Information - Compact */}
          <div className="space-y-2 lg:space-y-3">
            <div className="text-xs font-medium text-gray-600 border-b pb-1">
              Dirección
            </div>

            <InputComponent
              name="address"
              label="Dirección"
              onChange={handleFieldChange}
              type="text"
              errors={errors.address}
              value={formData.address}
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <InputComponent
                name="postal_code"
                label="CP"
                onChange={handleFieldChange}
                type="text"
                value={formData.postal_code}
              />
              <InputComponent
                name="city"
                label="Ciudad"
                onChange={handleFieldChange}
                type="text"
                value={formData.city}
              />
              <div className="col-span-2 sm:col-span-1">
                <InputComponent
                  name="province"
                  label="Provincia"
                  onChange={handleFieldChange}
                  type="text"
                  value={formData.province}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Signer Information Column */}
        {showSignerForm && (
          <div className="space-y-3 lg:space-y-4 xl:border-l xl:pl-6">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="h-4 w-4 text-primary-600" />
              <h3 className="text-sm font-semibold text-gray-900">
                Firmante autorizado
              </h3>
            </div>

            {/* Signer Personal Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-3">
              <InputComponent
                name="signer.name"
                label="Nombre/Razón Social"
                onChange={handleFieldChange}
                type="text"
                errors={signerErrors.name}
                value={signerData?.name || ""}
              />
              <InputComponent
                name="signer.last_name"
                label="Apellidos"
                onChange={handleFieldChange}
                type="text"
                errors={signerErrors.last_name}
                value={signerData?.last_name || ""}
              />
            </div>

            {/* Signer Contact Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-3">
              <InputComponent
                name="signer.email"
                label="Email"
                onChange={handleFieldChange}
                type="email"
                errors={signerErrors.email}
                value={signerData?.email || ""}
              />
              <InputComponent
                name="signer.phone"
                label="Teléfono"
                onChange={handleFieldChange}
                type="text"
                errors={signerErrors.phone}
                value={signerData?.phone || ""}
              />
            </div>

            {/* Document and Position */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-3">
              <InputComponent
                name="signer.document_number"
                label="DNI"
                onChange={handleFieldChange}
                type="text"
                errors={signerErrors.document_number}
                value={signerData?.document_number || ""}
              />
              <SelectComponent
                name="signer.cargo"
                items={[...CARGOS]}
                onChange={(value: string) =>
                  handleSelectChange("signer.cargo", value)
                }
                label="Cargo"
                selectedKey={signerData?.cargo || ""}
              />
            </div>

            {/* Info note */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 lg:p-3 mt-auto">
              <p className="text-xs text-blue-700">
                <strong>Nota:</strong> Los datos del firmante son necesarios
                para{" "}
                {formData.type === "Empresa"
                  ? "empresas"
                  : "comunidades de propietarios"}
                .
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
