"use client";
import { getTramiteByID } from "@/lib/libsql/data/tramites/getTramites";
import {
  createEmptySignerDB,
  EditTramiteFormData,
  createEmptyTramiteForm,
  ContractDB,
} from "@/lib/types";
import { Divider, Spinner } from "@heroui/react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  InputComponent,
  SelectComponent,
} from "../createTramite/InputComponent";
import {
  CARGOS,
  CLIENT_TYPES,
  DOCUMENT_TYPES,
  LIQUIDEZ_STATUS,
  STATUS_TYPES,
} from "@/lib/const";
import {
  EditInputComponent,
  EditSelectComponent,
} from "./EditFormInputComponent";
import { EditFormWrapper } from "./EditFormWrapper";
import ContractPreview from "../createTramite/ContractPreview";
import ButtonGroupComponent from "../createTramite/ButtonGroupComponent";
import { trackChanges } from "@/hooks/track-tramite-changes";
import { updateTramiteComplete } from "@/lib/libsql/data/updateData";
import Image from "next/image";
import { formatFileSize } from "@/lib/format";
import DocumentsForm from "../createTramite/DocumentsForm";
import NotesBoard from "./NotesBoard";
import CreateContractDrawer from "../createTramite/CreateContractDrawer";
import { addContract } from "@/lib/libsql/data/addData";
import { useTramites } from "@/contexts/TramitesContext";

interface Props {
  tramite_id: string;
  onCancel: () => void;
}

export default function EditTramiteForm({ tramite_id, onCancel }: Props) {
  const [formData, setFormData] = useState<EditTramiteFormData>(
    createEmptyTramiteForm()
  );
  const [originalData, setOriginalData] = useState<EditTramiteFormData>(
    createEmptyTramiteForm()
  );
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [newContract, setNewContract] = useState<ContractDB | null>(null);
  const [loading, setLoading] = useState(false);
  const { refreshTramites } = useTramites();
  const handleCreateContract = (contract: ContractDB) => {
    setNewContract(contract);
  };

  const fetchTramite = useCallback(async () => {
    setLoading(true);
    const { data, success } = await getTramiteByID(tramite_id);
    if (!success) {
      toast.error("Error al obtener el trámite");
      return;
    }

    if (data) {
      setFormData({
        ...data,
        signer: data.signer || createEmptySignerDB(),
      });
      setOriginalData({
        ...data,
        signer: data.signer || createEmptySignerDB(),
      });
    }

    setTimeout(() => {
      setLoading(false);
    }, 500);
  }, [tramite_id]);

  useEffect(() => {
    fetchTramite();
  }, [fetchTramite]);

  const comerciales = ["Juan", "Comercial 2", "Comercial 3"];

  const handleFieldChange = (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name.includes("tramite")) {
      setFormData((prev) => ({
        ...prev,
        tramite: {
          ...prev.tramite,
          [name.split(".")[1]]: value,
        },
      }));
    } else if (name.includes("client")) {
      setFormData((prev) => ({
        ...prev,
        client: {
          ...prev.client,
          [name.split(".")[1]]: value,
        },
      }));
    } else if (name.includes("signer")) {
      setFormData((prev) => ({
        ...prev,
        signer: {
          ...prev.signer,
          [name.split(".")[1]]: value,
        },
      }));
    }
  };

  const handleUpdateContract = (contract: ContractDB) => {
    setFormData((prev) => ({
      ...prev,
      contracts: prev.contracts.map((c) =>
        c.id === contract.id ? contract : c
      ),
    }));
  };

  const handleUpdateNewContract = (contract: ContractDB) => {
    setNewContract((prev) => ({
      ...prev,
      ...contract,
    }));
  };

  const handleUpdateNotes = (note: string) => {
    setFormData((prev) => ({
      ...prev,
      tramite: {
        ...prev.tramite,
        notes: [...prev.tramite.notes, note],
      },
    }));
  };

  const handleSubmit = async () => {
    const changes = trackChanges(originalData, formData);
    try {
      const { success, error } = await updateTramiteComplete(
        changes,
        tramite_id,
        formData.client.id,
        formData.signer.id,
        formData.contracts.map((c) => c.id),
        uploadedFiles
      );

      if (newContract) {
        const { success: newContractSuccess, error: newContractError } =
          await addContract(newContract, tramite_id);

        if (!newContractSuccess) {
          toast.error(`Error al añadir contrato: ${newContractError}`);
          return;
        }
      }
      if (!success) {
        toast.error(`Error al actualizar trámite: ${error}`);
        return;
      }

      toast.success("Trámite actualizado correctamente");
      await refreshTramites();
    } catch (error) {
      console.error("Error al actualizar trámite:", error);
      toast.error("Error desconocido al actualizar trámite");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Spinner size="lg" label="Cargando..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl text-[var(--primary-color-500)] font-bold ">
        {formData.tramite.id}
      </h1>
      <div className="flex items-stretch gap-4">
        <SelectComponent
          name="tramite.status"
          label="Estado"
          selectedKey={formData.tramite.status}
          isRequired
          items={STATUS_TYPES}
          onChange={handleFieldChange}
        />
        <SelectComponent
          name="tramite.sales_name"
          label="Comercial"
          selectedKey={formData.tramite.sales_name}
          isRequired
          items={comerciales}
          onChange={handleFieldChange}
        />
        <InputComponent
          name="tramite.comision"
          label="Comisión"
          value={formData.tramite.comision.toString()}
          onChange={handleFieldChange}
          type="number"
          endContent="€"
        />
      </div>
      <div className="flex items-stretch gap-4">
        <SelectComponent
          name="tramite.liquidez_status"
          label="Estado Liquidez"
          selectedKey={formData.tramite.liquidez_status as string}
          isRequired
          items={LIQUIDEZ_STATUS}
          onChange={handleFieldChange}
        />
        <InputComponent
          name="tramite.comision_sales_person"
          label="Comisión Comercial"
          value={formData.tramite.comision_sales_person.toString()}
          onChange={handleFieldChange}
          type="number"
          endContent="€"
        />
      </div>
      <Divider className="bg-[var(--primary-color-300)]" />
      <div className="grid grid-cols-2 gap-4">
        <EditFormWrapper title="Datos del cliente">
          <div className="flex flex-col gap-2">
            <EditInputComponent
              name="client.name"
              label="Nombre"
              value={formData.client.name}
              isRequired
              onChange={handleFieldChange}
              type="text"
            />
            <EditInputComponent
              name="client.last_name"
              label="Apellidos"
              value={formData.client.last_name}
              isRequired
              onChange={handleFieldChange}
              type="text"
            />
            <EditSelectComponent
              name="client.type"
              label="Tipo de cliente"
              selectedKey={formData.client.type}
              isRequired
              items={CLIENT_TYPES}
              onChange={handleFieldChange}
            />
            <EditSelectComponent
              name="client.document_type"
              label="Tipo de documento"
              selectedKey={formData.client.document_type}
              isRequired
              onChange={handleFieldChange}
              items={
                formData.client.type
                  ? DOCUMENT_TYPES[
                      formData.client.type as keyof typeof DOCUMENT_TYPES
                    ].documentTypes
                  : []
              }
            />
            <EditInputComponent
              name="client.document_number"
              label="Número de documento"
              value={formData.client.document_number}
              isRequired
              onChange={handleFieldChange}
              type="text"
            />
            <EditInputComponent
              name="client.phone"
              label="Teléfono"
              value={formData.client.phone}
              isRequired
              onChange={handleFieldChange}
              type="text"
            />
            <EditInputComponent
              name="client.email"
              label="Email"
              value={formData.client.email}
              isRequired
              onChange={handleFieldChange}
              type="email"
            />
            <EditInputComponent
              name="client.address"
              label="Dirección"
              value={formData.client.address}
              isRequired
              onChange={handleFieldChange}
              type="text"
            />
          </div>
        </EditFormWrapper>
        {(formData.client.type === "Empresa" ||
          formData.client.type === "Comunidad de Propietarios") && (
          <EditFormWrapper title="Datos del firmante">
            <div className="flex flex-col gap-2">
              <EditInputComponent
                name="signer.name"
                label="Nombre"
                value={formData.signer.name}
                isRequired
                onChange={handleFieldChange}
                type="text"
              />
              <EditInputComponent
                name="signer.last_name"
                label="Apellidos"
                value={formData.signer.last_name}
                isRequired
                onChange={handleFieldChange}
                type="text"
              />
              <EditInputComponent
                name="signer.phone"
                label="Teléfono"
                value={formData.signer.phone}
                isRequired
                onChange={handleFieldChange}
                type="text"
              />
              <EditInputComponent
                name="signer.email"
                label="Email"
                value={formData.signer.email}
                isRequired
                onChange={handleFieldChange}
                type="email"
              />
              <EditInputComponent
                name="signer.document_number"
                label="Número de documento"
                value={formData.signer.document_number}
                isRequired
                onChange={handleFieldChange}
                type="text"
              />
              {formData.client.type === "Comunidad de Propietarios" && (
                <EditSelectComponent
                  name="signer.cargo"
                  label="Cargo"
                  selectedKey={formData.signer.cargo || ""}
                  onChange={handleFieldChange}
                  items={CARGOS}
                />
              )}
            </div>
          </EditFormWrapper>
        )}
      </div>
      <Divider className="bg-[var(--primary-color-300)]" />

      <EditFormWrapper title="Contratos">
        <div className="flex items-start gap-4 w-full">
          <CreateContractDrawer
            tramite_id={tramite_id}
            onCreateContract={handleCreateContract}
          />
          {formData.contracts.map((contract, index) => (
            <ContractPreview
              key={index}
              contract={contract}
              onSavingContract={handleUpdateContract}
            />
          ))}
          {newContract && (
            <ContractPreview
              contract={newContract}
              onSavingContract={handleUpdateNewContract}
            />
          )}
        </div>
      </EditFormWrapper>
      <Divider className="bg-[var(--primary-color-300)]" />
      <EditFormWrapper title="Documentos">
        <div className="flex gap-4 w-full overflow-auto py-4">
          {formData.files &&
            formData.files.map((doc, index) => (
              <div
                key={index}
                className="flex flex-col bg-white rounded-lg shadow-md overflow-hidden max-w-56 w-full transition-all duration-300 ease-in-out hover:shadow-lg"
              >
                <div className="relative w-full h-16">
                  <Image
                    src={doc.preview_url || "/pdf.png"}
                    objectFit="contain"
                    objectPosition="center"
                    layout="fill"
                    alt={doc.filename}
                  />
                </div>
                <div className="p-4 flex flex-col gap-2">
                  <h3
                    className="font-semibold text-gray-800 truncate"
                    title={doc.filename}
                  >
                    {doc.filename}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {formatFileSize(doc.size)}
                  </p>
                  <a
                    href={doc.download_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 px-4 py-2 bg-blue-600 text-white text-center rounded-md hover:bg-blue-700 transition-colors duration-300 ease-in-out"
                  >
                    Ver archivo
                  </a>
                  {/* <Button color="primary" radius="sm">
                    Descargar
                  </Button> */}
                </div>
              </div>
            ))}
        </div>
        <DocumentsForm
          uploadedFiles={uploadedFiles}
          setUploadedFiles={setUploadedFiles}
        />
      </EditFormWrapper>

      <Divider className="bg-[var(--primary-color-300)]" />

      <NotesBoard
        notes={formData.tramite.notes as string[]}
        onCreateNote={handleUpdateNotes}
      />

      <Divider className="bg-[var(--primary-color-300)]" />

      <ButtonGroupComponent onSubmit={handleSubmit} onCancel={onCancel} />
    </div>
  );
}
