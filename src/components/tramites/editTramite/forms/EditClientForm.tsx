import {
  ClientDB,
  EditTramiteFormData,
  SignerDB,
  User,
} from "@/lib/core/types";
import {
  EditInputComponent,
  EditSelectComponent,
} from "../EditFormInputComponent";
import { CARGOS, CLIENT_TYPES, DOCUMENT_TYPES } from "@/lib/core/const";
import { EditFormWrapper } from "../EditFormWrapper";

interface Props {
  client: ClientDB;
  setFormData: React.Dispatch<React.SetStateAction<EditTramiteFormData>>;
  signer: SignerDB;
  userData: User;
}

export default function EditClientForm({
  client,
  setFormData,
  signer,
  userData,
}: Props) {
  const handleFieldChange = (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      if (name.includes("signer")) {
        return {
          ...prev,
          signer: {
            ...prev.signer,
            [name.split(".")[1]]: value,
          },
        };
      } else {
        return {
          ...prev,
          client: {
            ...prev.client,
            [name]: value,
          },
        };
      }
    });
  };
  return (
    <>
      <EditFormWrapper title="Datos del cliente">
        <div className="flex flex-col gap-2">
          <EditInputComponent
            name="name"
            label="Nombre"
            value={client.name}
            isRequired
            onChange={handleFieldChange}
            type="text"
            editable={userData.role !== "2"}
          />
          <EditInputComponent
            name="last_name"
            label="Apellidos"
            value={client.last_name}
            isRequired
            onChange={handleFieldChange}
            type="text"
            editable={userData.role !== "2"}
          />
          <EditSelectComponent
            name="type"
            label="Tipo de cliente"
            selectedKey={client.type}
            isRequired
            items={CLIENT_TYPES}
            onChange={handleFieldChange}
            editable={userData.role !== "2"}
          />
          <EditSelectComponent
            name="document_type"
            label="Tipo de documento"
            selectedKey={client.document_type}
            editable={userData.role !== "2"}
            isRequired
            onChange={handleFieldChange}
            items={
              client.type
                ? DOCUMENT_TYPES[client.type as keyof typeof DOCUMENT_TYPES]
                    .documentTypes
                : []
            }
          />
          <EditInputComponent
            name="document_number"
            label="Número de documento"
            value={client.document_number}
            isRequired
            editable={userData.role !== "2"}
            onChange={handleFieldChange}
            type="text"
          />
          <EditInputComponent
            name="phone"
            label="Teléfono"
            value={client.phone}
            isRequired
            onChange={handleFieldChange}
            editable={userData.role !== "2"}
            type="text"
          />
          <EditInputComponent
            name="email"
            label="Email"
            value={client.email}
            isRequired
            onChange={handleFieldChange}
            editable={userData.role !== "2"}
            type="email"
          />
          <EditInputComponent
            name="address"
            label="Dirección"
            value={client.address}
            isRequired
            onChange={handleFieldChange}
            editable={userData.role !== "2"}
            type="text"
          />
        </div>
      </EditFormWrapper>
      {(client.type === "Empresa" ||
        client.type === "Comunidad de Propietarios") && (
        <EditFormWrapper title="Datos del firmante">
          <div className="flex flex-col gap-2">
            <EditInputComponent
              name="signer.name"
              label="Nombre"
              value={signer.name}
              isRequired
              onChange={handleFieldChange}
              editable={userData.role !== "2"}
              type="text"
            />
            <EditInputComponent
              name="signer.last_name"
              label="Apellidos"
              value={signer.last_name}
              isRequired
              onChange={handleFieldChange}
              editable={userData.role !== "2"}
              type="text"
            />
            <EditInputComponent
              name="signer.phone"
              label="Teléfono"
              value={signer.phone}
              isRequired
              onChange={handleFieldChange}
              editable={userData.role !== "2"}
              type="text"
            />
            <EditInputComponent
              name="signer.email"
              label="Email"
              value={signer.email}
              isRequired
              onChange={handleFieldChange}
              editable={userData.role !== "2"}
              type="email"
            />
            <EditInputComponent
              name="signer.document_number"
              label="Número de documento"
              value={signer.document_number}
              editable={userData.role !== "2"}
              isRequired
              onChange={handleFieldChange}
              type="text"
            />
            {client.type === "Comunidad de Propietarios" && (
              <EditSelectComponent
                name="signer.cargo"
                label="Cargo"
                selectedKey={signer.cargo || ""}
                onChange={handleFieldChange}
                editable={userData.role !== "2"}
                items={CARGOS}
              />
            )}
          </div>
        </EditFormWrapper>
      )}
    </>
  );
}
