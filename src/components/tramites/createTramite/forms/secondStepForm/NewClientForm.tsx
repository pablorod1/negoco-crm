import {
  createEmptySignerForm,
  SecondForm,
  SecondFormError,
  SignerForm,
  SignerFormError,
} from "@/lib/validation/validation.types";
import { InputComponent, SelectComponent } from "../../InputComponent";
import { CARGOS, CLIENT_TYPES, DOCUMENT_TYPES } from "@/lib/core/const";
import { Separator } from "@/components/ui/separator";

interface Props {
  formData: SecondForm;
  errors: SecondFormError;
  signerData: SignerForm | null;
  setFormData: React.Dispatch<React.SetStateAction<SecondForm>>;
  setErrors: React.Dispatch<React.SetStateAction<SecondFormError>>;
  setSignerData: React.Dispatch<React.SetStateAction<SignerForm | null>>;
  setSignerErrors: React.Dispatch<React.SetStateAction<SignerFormError>>;
  signerErrors: SignerFormError;
}

export default function NewClientForm({
  formData,
  setFormData,
  setErrors,
  setSignerData,
  setSignerErrors,
  errors,
  signerData,
  signerErrors,
}: Props) {
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

  // Get display name for form title
  const clientTypeDisplayName =
    formData.type === "Empresa" ? "de la empresa" : "del cliente";

  return (
    <form className="w-full pt-6">
      <div className="flex flex-col gap-8 w-full">
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-primary-500 text-nowrap">
            Datos {clientTypeDisplayName}
          </h2>
          <SelectComponent
            name="type"
            items={CLIENT_TYPES}
            onChange={handleClientTypeChange}
            label="Tipo de cliente"
            selectedKey={formData.type}
            isRequired
          />
        </div>

        <div className="flex items-stretch gap-8 w-full">
          <SelectComponent
            name="document_type"
            items={
              formData.type &&
              DOCUMENT_TYPES[formData.type as keyof typeof DOCUMENT_TYPES]
                ? DOCUMENT_TYPES[formData.type as keyof typeof DOCUMENT_TYPES]
                    .documentTypes
                : []
            }
            onChange={(value) => handleSelectChange("document_type", value)}
            errors={errors.document_type}
            label="Tipo de documento"
            isRequired
            selectedKey={formData.document_type as string}
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

        <div className="flex items-stretch gap-8 w-full">
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

        <div className="flex items-stretch gap-8 w-full">
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

      {showSignerForm && (
        <>
          <Separator className="my-4" />
          <div className="flex flex-col gap-y-4 w-full">
            <h2 className="text-xl font-semibold text-primary-500">
              Datos de la persona firmante
            </h2>
            <div className="flex items-stretch gap-8 w-full">
              <InputComponent
                name="signer.document_number"
                label="Número de documento"
                value={signerData.document_number}
                onChange={handleFieldChange}
                type="text"
                errors={signerErrors.document_number}
                isRequired
              />

              <InputComponent
                name="signer.name"
                label="Nombre"
                value={signerData.name}
                onChange={handleFieldChange}
                type="text"
                errors={signerErrors.name}
                isRequired
              />

              <InputComponent
                name="signer.last_name"
                label="Apellidos"
                value={signerData.last_name}
                onChange={handleFieldChange}
                type="text"
                errors={signerErrors.last_name}
                isRequired
              />
            </div>

            <div className="flex items-stretch gap-8 w-full">
              <InputComponent
                name="signer.email"
                label="Correo Electrónico"
                value={signerData.email}
                onChange={handleFieldChange}
                type="email"
                errors={signerErrors.email}
                isRequired
              />

              <InputComponent
                name="signer.phone"
                label="Teléfono"
                value={signerData.phone}
                onChange={handleFieldChange}
                type="number"
                errors={signerErrors.phone}
                isRequired
              />

              {formData.type === "Comunidad de Propietarios" && (
                <SelectComponent
                  name="signer.cargo"
                  items={CARGOS}
                  onChange={(value) =>
                    handleSelectChange("signer.cargo", value)
                  }
                  label="Cargo"
                  selectedKey={signerData.cargo || ""}
                />
              )}
            </div>
          </div>
        </>
      )}
    </form>
  );
}
