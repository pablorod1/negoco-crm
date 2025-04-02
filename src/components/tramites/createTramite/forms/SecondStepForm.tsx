"use client";
import { CARGOS, DOCUMENT_TYPES } from "@/lib/core/const";
import {
  createEmptySecondFormError,
  SecondForm,
  SecondFormError,
  createEmptySignerFormError,
  SignerFormError,
} from "@/lib/validation/validation.types";
import {
  secondFormValidation,
  signerFormValidation,
} from "@/lib/validation/create-tramite/form-validation";

import { Divider } from "@heroui/divider";
import React, { useState } from "react";
import { ClientDB, SignerDB } from "@/lib/core/types";
import FormWrapper from "../FormWrapper";
import ButtonGroupComponent from "@/components/core/ButtonGroupComponent";
import { InputComponent, SelectComponent } from "../InputComponent";

interface Props {
  client: ClientDB;
  setClient: React.Dispatch<React.SetStateAction<ClientDB>>;
  setSigner: React.Dispatch<React.SetStateAction<SignerDB | null>>;
  onSecondSubmitSuccess: () => void;
  onBack: () => void;
  onCancel: () => void;
  signer: SignerDB | null;
}

export default function SecondStepForm({
  client,
  setClient,
  setSigner,
  onSecondSubmitSuccess,
  onBack,
  onCancel,
  signer,
}: Props) {
  const [errors, setErrors] = useState<SecondFormError>(
    createEmptySecondFormError
  );

  const [formData, setFormData] = useState<SecondForm>(client as SecondForm);

  const [signerErrors, setSignerErrors] = useState<SignerFormError>(
    createEmptySignerFormError
  );

  const handleFieldChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name.includes("signer") && signer) {
      setSigner((prevState) => {
        if (!prevState) return prevState;
        return {
          ...prevState,
          [name.split(".")[1]]: value,
        };
      });
      setSignerErrors((prevState) => ({
        ...prevState,
        [name.split(".")[1]]: "",
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
    }
  };

  const handleSecondSubmit = () => {
    if (signer) {
      const signerFormValidationResult = signerFormValidation({
        document_number: signer.document_number,
        name: signer.name,
        last_name: signer.last_name,
        email: signer.email,
        phone: signer.phone,
        cargo: signer.cargo || "",
      });
      const formValidationResult = secondFormValidation(formData);
      setErrors(formValidationResult.errors);
      // Update signer errors while preserving the rest of the state
      setSignerErrors(signerFormValidationResult.errors);
      if (
        signerFormValidationResult.succeeded &&
        formValidationResult.succeeded
      ) {
        setClient((prevState) => ({
          ...prevState,
          name: formData.name,
          last_name: formData.last_name || "",
          email: formData.email,
          phone: formData.phone,
          IBAN: formData.IBAN,
          address: formData.address,
          postal_code: formData.postal_code,
          province: formData.province,
          city: formData.city,
          document_type: formData.document_type,
          document_number: formData.document_number,
        }));
        onSecondSubmitSuccess();
      }
    }

    const formValidationResult = secondFormValidation(formData);

    setErrors(formValidationResult.errors);

    if (formValidationResult.succeeded) {
      setClient((prevState) => ({
        ...prevState,
        name: formData.name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone,
        IBAN: formData.IBAN,
        address: formData.address,
        document_type: formData.document_type,
        document_number: formData.document_number,
        postal_code: formData.postal_code,
        province: formData.province,
        city: formData.city,
      }));
      onSecondSubmitSuccess();
    }
  };

  return (
    <FormWrapper>
      <form className="w-full">
        <div className="flex flex-col gap-y-4 w-full">
          <h2 className="text-xl font-semibold text-primary-500">
            Datos {client.type === "Empresa" ? "de la empresa" : "del cliente"}
          </h2>
          <div className="flex items-stretch gap-4 w-full">
            <SelectComponent
              name="document_type"
              items={
                DOCUMENT_TYPES[client.type as keyof typeof DOCUMENT_TYPES]
                  .documentTypes
              }
              onChange={handleFieldChange}
              errors={errors.document_type}
              label="Tipo de documento"
              isRequired
              selectedKey={formData.document_type}
            />

            <InputComponent
              name="document_number"
              label="Número de documento"
              onChange={handleFieldChange}
              errors={errors.document_number}
              value={formData.document_number}
              type="text"
              isRequired
            />

            <InputComponent
              name="name"
              label="Nombre"
              onChange={handleFieldChange}
              type="text"
              errors={errors.name}
              value={formData.name}
              isRequired
            />

            {client.type !== "Empresa" &&
              client.type !== "Comunidad de Propietarios" && (
                <InputComponent
                  name="last_name"
                  label="Apellidos"
                  onChange={handleFieldChange}
                  type="text"
                  value={formData.last_name}
                />
              )}
          </div>
          <div className="flex items-stretch gap-4 w-full">
            <InputComponent
              name="email"
              label="Correo Electrónico"
              onChange={handleFieldChange}
              type="email"
              errors={errors.email}
              isRequired
              value={formData.email}
            />

            <InputComponent
              name="phone"
              label="Teléfono"
              onChange={handleFieldChange}
              type="number"
              errors={errors.phone}
              isRequired
              value={formData.phone}
            />
            <InputComponent
              name="IBAN"
              label="Número de cuenta"
              onChange={handleFieldChange}
              type="text"
              errors={errors.IBAN}
              isRequired
              value={formData.IBAN}
            />
          </div>
          <div className="flex items-stretch gap-4 w-full">
            <InputComponent
              name="address"
              label="Dirección Fiscal"
              onChange={handleFieldChange}
              type="text"
              errors={errors.address}
              isRequired
              value={formData.address}
            />
            <InputComponent
              name="postal_code"
              label="Código Postal"
              onChange={handleFieldChange}
              value={formData.postal_code}
              type="text"
            />
            <InputComponent
              name="province"
              label="Provincia"
              onChange={handleFieldChange}
              value={formData.province}
              type="text"
            />
            <InputComponent
              name="city"
              label="Ciudad"
              onChange={handleFieldChange}
              value={formData.city}
              type="text"
            />
          </div>
        </div>
        {signer && (
          <>
            <Divider className="my-4" />
            <div className="flex flex-col gap-y-4 w-full">
              <h2 className="text-xl font-semibold text-primary-500">
                Datos de la persona firmante
              </h2>

              <div className="flex items-stretch gap-4 w-full">
                <InputComponent
                  name="signer.document_number"
                  label="Número de documento"
                  onChange={handleFieldChange}
                  type="text"
                  errors={signerErrors.document_number}
                  isRequired
                  value={signer.document_number as string}
                />

                <InputComponent
                  name="signer.name"
                  label="Nombre"
                  onChange={handleFieldChange}
                  type="text"
                  errors={signerErrors.name}
                  isRequired
                  value={signer.name as string}
                />

                <InputComponent
                  name="signer.last_name"
                  label="Apellidos"
                  onChange={handleFieldChange}
                  type="text"
                  errors={signerErrors.last_name}
                  isRequired
                  value={signer.last_name}
                />
              </div>
              <div className="flex items-stretch gap-4 w-full">
                <InputComponent
                  name="signer.email"
                  label="Correo Electrónico"
                  onChange={handleFieldChange}
                  type="email"
                  errors={signerErrors.email}
                  isRequired
                  value={signer.email}
                />
                <InputComponent
                  name="signer.phone"
                  label="Teléfono"
                  onChange={handleFieldChange}
                  type="number"
                  errors={signerErrors.phone}
                  isRequired
                  value={signer.phone}
                />

                {client.type === "Comunidad de Propietarios" && (
                  <SelectComponent
                    name="signer.cargo"
                    items={CARGOS}
                    onChange={handleFieldChange}
                    label="Cargo"
                    selectedKey={signer.cargo || ""}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </form>
      <ButtonGroupComponent
        onCancel={onCancel}
        onBack={onBack}
        onSubmit={handleSecondSubmit}
      />
    </FormWrapper>
  );
}
