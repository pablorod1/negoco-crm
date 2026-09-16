"use client";
import { useMemo, useState } from "react";
import { AlertCircleIcon, CircleX, Save } from "lucide-react";
import AddressFields from "@/core/components/AddressFields";
import { Button } from "@/core/components/ui/button";
import { showCustomToast } from "@/core/components/CustomToast";
import type { User } from "@/core/types";
import type { ClientDB, ContractDB, SignerDB } from "@/tramites/types";
import { DOCUMENT_TYPES, POTS } from "@/tramites/constants";
import {
  InputComponent,
  SelectComponent,
} from "@/tramites/components/createTramite/InputComponent";
import ImaginaRateSelector from "@/tramites/components/createTramite/forms/ImaginaRateSelector";
import ImaginaMunicipioCombobox from "./ImaginaMunicipioCombobox";
import { useImaginaRates } from "@/comercializadoras/hooks/useImaginaRates";
import {
  IMAGINA_PROVINCES,
  IMAGINA_ROAD_TYPES,
} from "@/core/integrations/imagina-energia/catalogs";
import type { ImaginaMissingField } from "@/tramites/utils/imagina-missing-fields";

interface Props {
  missing: ImaginaMissingField[];
  tramiteId: string;
  client: ClientDB;
  contract: ContractDB;
  signer?: SignerDB | null;
  userData: User;
  // Tras guardar: el padre refresca el trámite y vuelve a validar.
  onSaved: () => void | Promise<void>;
  disabled?: boolean;
}

interface SignerDraft {
  name: string;
  last_name: string;
  email: string;
  phone: string;
  document_type: string;
  document_number: string;
}

const SIGNATURE_CHANNELS = [
  { label: "SMS", value: "sms" },
  { label: "Email", value: "email" },
  { label: "Email OTP", value: "email_otp" },
];

const SIGNER_DOCUMENT_TYPES = ["DNI", "NIE", "Otro"];

// Calle y número se editan con el buscador de direcciones; provincia y tipo
// de vía son enums de Imagina y van en desplegable.
const CLIENT_STREET_FIELDS = ["calle_titular", "numero_finca_titular"];
const CONTRACT_STREET_FIELDS = ["calle", "numero_finca"];
const PROVINCES = [...IMAGINA_PROVINCES];
const ROAD_TYPES = [...IMAGINA_ROAD_TYPES];
const SIGNER_FIELDS = [
  "firmante",
  "nombre_firmante",
  "primer_apellido_firmante",
  "tipo_documento_firmante",
  "numero_documento_firmante",
];

// Claves del cliente que acepta PATCH /clients/[id]/signature.
const CLIENT_PATCH_KEYS: Array<keyof ClientDB> = [
  "name",
  "last_name",
  "type",
  "email",
  "phone",
  "IBAN",
  "document_type",
  "document_number",
  "address",
  "postal_code",
  "province",
  "city",
  "tipo_via_cnmc",
  "calle",
  "numero_finca",
  "aclarador_finca",
  "phone_prefix",
  "cnae",
];

const isBusinessClient = (client: ClientDB) =>
  client.type === "Empresa" || client.type === "Comunidad de Propietarios";

const parseResponse = async (response: Response, fallback: string) => {
  const result = (await response.json()) as { success?: boolean; error?: string };
  if (!result.success) throw new Error(result.error || fallback);
};

export default function ImaginaMissingFieldsForm({
  missing,
  tramiteId,
  client,
  contract,
  signer,
  userData,
  onSaved,
  disabled,
}: Props) {
  // Solo se guarda lo editado; el resto se lee de los props, que se
  // refrescan al recargar el trámite.
  const [clientEdits, setClientEdits] = useState<Partial<ClientDB>>({});
  const [contractEdits, setContractEdits] = useState<Partial<ContractDB>>({});
  const [signerEdits, setSignerEdits] = useState<Partial<SignerDraft>>({});
  const [saving, setSaving] = useState(false);

  const existingSigner = signer?.id ? signer : null;
  const clientView: ClientDB = { ...client, ...clientEdits };
  const contractView: ContractDB = { ...contract, ...contractEdits };
  // El firmante hereda teléfono y email del cliente si no tiene los suyos,
  // igual que hace el envío a Imagina.
  const signerView: SignerDraft = {
    name: existingSigner?.name || "",
    last_name: existingSigner?.last_name || "",
    email: existingSigner?.email || client.email || "",
    phone: existingSigner?.phone || client.phone || "",
    document_type: existingSigner?.document_type || "DNI",
    document_number: existingSigner?.document_number || "",
    ...signerEdits,
  };

  const fields = useMemo(
    () => new Set(missing.map((item) => item.field).filter(Boolean)),
    [missing],
  );
  const has = (...names: string[]) => names.some((name) => fields.has(name));
  const messageFor = (...names: string[]) =>
    missing.find((item) => item.field && names.includes(item.field))?.message;

  const show = {
    clientStreet: has(...CLIENT_STREET_FIELDS),
    clientRoadType: has("tipo_via_titular_cnmc"),
    clientProvince: has("provincia_titular"),
    clientCity: has("municipio_titular"),
    clientPostalCode: has("cod_postal_titular"),
    clientName: has("nombre_titular", "razon_social_titular"),
    clientLastName: has("primer_apellido_titular"),
    clientDocType: has("tipo_documento_titular"),
    clientDocNumber: has("numero_documento_titular"),
    clientIban: has("iban"),
    clientPhone: has("telefono_titular"),
    clientEmail: has("email_titular"),
    clientCnae: has("id_cnae"),
    signer: has(...SIGNER_FIELDS),
    contractStreet: has(...CONTRACT_STREET_FIELDS),
    contractRoadType: has("tipo_via_cnmc"),
    contractProvince: has("provincia"),
    contractCity: has("municipio"),
    contractPostalCode: has("cod_postal"),
    contractCups: has("cups"),
    contractPowers: has("potencia_contratada"),
    contractChannel: has("canal_envio"),
    rate: has("id_tarifa"),
  };
  const showClient =
    show.clientStreet ||
    show.clientRoadType ||
    show.clientProvince ||
    show.clientCity ||
    show.clientPostalCode ||
    show.clientName ||
    show.clientLastName ||
    show.clientDocType ||
    show.clientDocNumber ||
    show.clientIban ||
    show.clientPhone ||
    show.clientEmail ||
    show.clientCnae;
  const showContract =
    show.contractStreet ||
    show.contractRoadType ||
    show.contractProvince ||
    show.contractCity ||
    show.contractPostalCode ||
    show.contractCups ||
    show.contractPowers ||
    show.contractChannel ||
    show.rate;

  const imaginaRates = useImaginaRates({ enabled: show.rate });

  const clientDocumentTypes =
    DOCUMENT_TYPES[client.type as keyof typeof DOCUMENT_TYPES]?.documentTypes ??
    ["DNI", "NIE", "CIF", "Otro"];

  const updateClient = (name: keyof ClientDB, value: string) =>
    setClientEdits((prev) => ({ ...prev, [name]: value }));
  const updateContract = (
    name: keyof ContractDB,
    value: string | number | null,
  ) => setContractEdits((prev) => ({ ...prev, [name]: value }));
  const updateSigner = (name: keyof SignerDraft, value: string) =>
    setSignerEdits((prev) => ({ ...prev, [name]: value }));

  const hasChanges =
    Object.keys(clientEdits).length > 0 ||
    Object.keys(contractEdits).length > 0 ||
    Object.keys(signerEdits).length > 0 ||
    // Un firmante inexistente se crea aunque no se haya tocado nada.
    (show.signer && !existingSigner);

  const handleSave = async () => {
    setSaving(true);
    try {
      const clientChanges = Object.fromEntries(
        CLIENT_PATCH_KEYS.filter((key) => key in clientEdits).map((key) => [
          key,
          clientEdits[key],
        ]),
      );
      const signerPayload = show.signer
        ? {
            ...(existingSigner ? { id: existingSigner.id } : {}),
            ...signerView,
            phone_prefix: existingSigner?.phone_prefix || client.phone_prefix || "34",
            cargo: existingSigner?.cargo ?? null,
          }
        : undefined;

      if (Object.keys(clientChanges).length > 0 || signerPayload) {
        const response = await fetch(`/api/v2/clients/${client.id}/signature`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(Object.keys(clientChanges).length > 0
              ? { client: clientChanges }
              : {}),
            ...(signerPayload ? { signer: signerPayload } : {}),
          }),
        });
        await parseResponse(response, "No se han podido guardar los datos del cliente");
      }

      if (Object.keys(contractEdits).length > 0) {
        const response = await fetch(`/api/v2/contracts/${tramiteId}/contract`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contract: contractView, user_id: userData.id }),
        });
        await parseResponse(response, "No se han podido guardar los datos del contrato");
      }

      setClientEdits({});
      setContractEdits({});
      setSignerEdits({});
      await onSaved();
    } catch (error) {
      showCustomToast({
        title: "Error al guardar los datos",
        message: error instanceof Error ? error.message : String(error),
        iconColor: "var(--danger-color)",
        iconSize: 24,
        icon: CircleX,
      });
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || Boolean(disabled);

  return (
    <div className="space-y-4 rounded-md border border-danger-400 bg-danger-50 p-3">
      <div className="flex items-start gap-2">
        <AlertCircleIcon className="mt-0.5 size-5 flex-shrink-0 text-danger" />
        <div>
          <p className="text-sm font-medium text-danger">
            Faltan datos para enviar a Imagina Energía
          </p>
          <p className="text-xs text-danger/80">
            Completa los campos y pulsa &quot;Guardar y validar&quot;. El estado
            del trámite no cambia hasta que pulses Actualizar.
          </p>
        </div>
      </div>

      {showClient ? (
        <section className="space-y-3 rounded-md border border-danger-400/40 bg-white p-3">
          <p className="text-sm font-semibold text-gray-800">Cliente</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {show.clientName ? (
              <InputComponent
                name="name"
                label={isBusinessClient(client) ? "Razón social" : "Nombre"}
                type="text"
                value={clientView.name || ""}
                onChange={(event) => updateClient("name", event.target.value)}
                errors={messageFor("nombre_titular", "razon_social_titular")}
                isRequired
              />
            ) : null}
            {show.clientLastName ? (
              <InputComponent
                name="last_name"
                label="Apellidos"
                type="text"
                value={clientView.last_name || ""}
                onChange={(event) => updateClient("last_name", event.target.value)}
                errors={messageFor("primer_apellido_titular")}
                isRequired
              />
            ) : null}
            {show.clientDocType ? (
              <SelectComponent
                name="document_type"
                label="Tipo de documento"
                items={[...clientDocumentTypes]}
                selectedKey={clientView.document_type || ""}
                onChange={(value) => updateClient("document_type", value)}
                errors={messageFor("tipo_documento_titular")}
                isRequired
              />
            ) : null}
            {show.clientDocNumber ? (
              <InputComponent
                name="document_number"
                label="Número de documento"
                type="text"
                value={clientView.document_number || ""}
                onChange={(event) =>
                  updateClient("document_number", event.target.value)
                }
                errors={messageFor("numero_documento_titular")}
                isRequired
              />
            ) : null}
            {show.clientIban ? (
              <InputComponent
                name="IBAN"
                label="IBAN"
                type="text"
                value={clientView.IBAN || ""}
                onChange={(event) => updateClient("IBAN", event.target.value)}
                errors={messageFor("iban")}
                isRequired
              />
            ) : null}
            {show.clientPhone ? (
              <InputComponent
                name="phone"
                label="Teléfono"
                type="tel"
                value={clientView.phone || ""}
                onChange={(event) => updateClient("phone", event.target.value)}
                errors={messageFor("telefono_titular")}
                isRequired
              />
            ) : null}
            {show.clientEmail ? (
              <InputComponent
                name="email"
                label="Email"
                type="email"
                value={clientView.email || ""}
                onChange={(event) => updateClient("email", event.target.value)}
                errors={messageFor("email_titular")}
                isRequired
              />
            ) : null}
            {show.clientCnae ? (
              <InputComponent
                name="cnae"
                label="CNAE"
                type="text"
                value={clientView.cnae || ""}
                onChange={(event) => updateClient("cnae", event.target.value)}
                errors={messageFor("id_cnae")}
                isRequired
              />
            ) : null}
          </div>
          {show.clientStreet ? (
            <AddressFields
              label="Dirección del titular"
              formData={clientView}
              error={messageFor(...CLIENT_STREET_FIELDS)}
              onChange={(changes) =>
                setClientEdits((prev) => ({ ...prev, ...changes }))
              }
            />
          ) : null}
          {show.clientRoadType ||
          show.clientProvince ||
          show.clientCity ||
          show.clientPostalCode ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {show.clientRoadType ? (
                <SelectComponent
                  name="client_tipo_via_cnmc"
                  label="Tipo de vía del titular"
                  items={ROAD_TYPES}
                  selectedKey={clientView.tipo_via_cnmc || ""}
                  onChange={(value) => updateClient("tipo_via_cnmc", value)}
                  errors={messageFor("tipo_via_titular_cnmc")}
                  isRequired
                />
              ) : null}
              {show.clientProvince ? (
                <SelectComponent
                  name="client_province"
                  label="Provincia del titular"
                  items={PROVINCES}
                  selectedKey={clientView.province || ""}
                  onChange={(value) => updateClient("province", value)}
                  errors={messageFor("provincia_titular")}
                  isRequired
                />
              ) : null}
              {show.clientCity ? (
                <ImaginaMunicipioCombobox
                  name="client_city"
                  label="Municipio del titular"
                  value={clientView.city || ""}
                  onChange={(value) => updateClient("city", value)}
                  error={messageFor("municipio_titular")}
                />
              ) : null}
              {show.clientPostalCode ? (
                <InputComponent
                  name="client_postal_code"
                  label="Código postal del titular"
                  type="text"
                  value={clientView.postal_code || ""}
                  onChange={(event) =>
                    updateClient("postal_code", event.target.value)
                  }
                  errors={messageFor("cod_postal_titular")}
                  isRequired
                />
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {show.signer ? (
        <section className="space-y-3 rounded-md border border-danger-400/40 bg-white p-3">
          <p className="text-sm font-semibold text-gray-800">
            Firmante {existingSigner ? "" : "(se creará al guardar)"}
          </p>
          {messageFor("firmante") ? (
            <p className="text-xs text-gray-500">{messageFor("firmante")}</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <InputComponent
              name="signer_name"
              label="Nombre"
              type="text"
              value={signerView.name}
              onChange={(event) => updateSigner("name", event.target.value)}
              errors={messageFor("nombre_firmante")}
              isRequired
            />
            <InputComponent
              name="signer_last_name"
              label="Apellidos"
              type="text"
              value={signerView.last_name}
              onChange={(event) => updateSigner("last_name", event.target.value)}
              errors={messageFor("primer_apellido_firmante")}
              isRequired
            />
            <SelectComponent
              name="signer_document_type"
              label="Tipo de documento"
              items={SIGNER_DOCUMENT_TYPES}
              selectedKey={signerView.document_type}
              onChange={(value) => updateSigner("document_type", value)}
              errors={messageFor("tipo_documento_firmante")}
              isRequired
            />
            <InputComponent
              name="signer_document_number"
              label="Número de documento"
              type="text"
              value={signerView.document_number}
              onChange={(event) =>
                updateSigner("document_number", event.target.value)
              }
              errors={messageFor("numero_documento_firmante")}
              isRequired
            />
            <InputComponent
              name="signer_phone"
              label="Teléfono"
              type="tel"
              value={signerView.phone}
              onChange={(event) => updateSigner("phone", event.target.value)}
              isRequired
            />
            <InputComponent
              name="signer_email"
              label="Email"
              type="email"
              value={signerView.email}
              onChange={(event) => updateSigner("email", event.target.value)}
              isRequired
            />
          </div>
        </section>
      ) : null}

      {showContract ? (
        <section className="space-y-3 rounded-md border border-danger-400/40 bg-white p-3">
          <p className="text-sm font-semibold text-gray-800">Contrato</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {show.contractCups ? (
              <InputComponent
                name="CUPS"
                label="CUPS"
                type="text"
                value={contractView.CUPS || ""}
                onChange={(event) =>
                  updateContract("CUPS", event.target.value.toUpperCase())
                }
                errors={messageFor("cups")}
                isRequired
              />
            ) : null}
            {show.contractChannel ? (
              <SelectComponent
                name="signature_channel"
                label="Canal de firma"
                items={SIGNATURE_CHANNELS}
                selectedKey={contractView.signature_channel || "sms"}
                textValue={
                  SIGNATURE_CHANNELS.find(
                    (option) =>
                      option.value === (contractView.signature_channel || "sms"),
                  )?.label
                }
                onChange={(value) => updateContract("signature_channel", value)}
                errors={messageFor("canal_envio")}
                isRequired
              />
            ) : null}
            {show.rate ? (
              <div className="sm:col-span-2">
                {imaginaRates.integration?.configured ? (
                  <ImaginaRateSelector
                    rates={imaginaRates.rates}
                    selectedRateId={contractView.rate_id}
                    unavailableSelectedRate={imaginaRates.unavailableSelectedRate}
                    onChange={(rateId) => updateContract("rate_id", rateId)}
                    error={messageFor("id_tarifa")}
                  />
                ) : (
                  <p
                    role={imaginaRates.error ? "alert" : "status"}
                    className="text-xs text-gray-500"
                  >
                    {imaginaRates.error
                      ? `No se han podido cargar las tarifas de Imagina. ${imaginaRates.error}`
                      : "Cargando tarifas de Imagina…"}
                  </p>
                )}
              </div>
            ) : null}
          </div>
          {show.contractPowers ? (
            <div className="space-y-1">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {POTS.map((label, index) => {
                  const key = `pot${index + 1}` as keyof ContractDB;
                  return (
                    <InputComponent
                      key={key}
                      name={key}
                      label={label}
                      type="number"
                      value={Number(contractView[key] ?? 0)}
                      onChange={(event) =>
                        updateContract(key, Number(event.target.value) || 0)
                      }
                    />
                  );
                })}
              </div>
              {messageFor("potencia_contratada") ? (
                <p className="text-red-600 text-sm ms-1">
                  {messageFor("potencia_contratada")}
                </p>
              ) : null}
            </div>
          ) : null}
          {show.contractStreet ? (
            <AddressFields
              label="Dirección del suministro"
              formData={contractView}
              error={messageFor(...CONTRACT_STREET_FIELDS)}
              onChange={(changes) =>
                setContractEdits((prev) => ({ ...prev, ...changes }))
              }
            />
          ) : null}
          {show.contractRoadType ||
          show.contractProvince ||
          show.contractCity ||
          show.contractPostalCode ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {show.contractRoadType ? (
                <SelectComponent
                  name="contract_tipo_via_cnmc"
                  label="Tipo de vía del suministro"
                  items={ROAD_TYPES}
                  selectedKey={contractView.tipo_via_cnmc || ""}
                  onChange={(value) => updateContract("tipo_via_cnmc", value)}
                  errors={messageFor("tipo_via_cnmc")}
                  isRequired
                />
              ) : null}
              {show.contractProvince ? (
                <SelectComponent
                  name="contract_province"
                  label="Provincia del suministro"
                  items={PROVINCES}
                  selectedKey={contractView.province || ""}
                  onChange={(value) => updateContract("province", value)}
                  errors={messageFor("provincia")}
                  isRequired
                />
              ) : null}
              {show.contractCity ? (
                <ImaginaMunicipioCombobox
                  name="contract_city"
                  label="Municipio del suministro"
                  value={contractView.city || ""}
                  onChange={(value) => updateContract("city", value)}
                  error={messageFor("municipio")}
                />
              ) : null}
              {show.contractPostalCode ? (
                <InputComponent
                  name="contract_postal_code"
                  label="Código postal del suministro"
                  type="text"
                  value={contractView.postal_code || ""}
                  onChange={(event) =>
                    updateContract("postal_code", event.target.value)
                  }
                  errors={messageFor("cod_postal")}
                  isRequired
                />
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={handleSave}
          disabled={busy || !hasChanges}
        >
          <Save className="size-4" />
          {saving ? "Guardando..." : "Guardar y validar"}
        </Button>
      </div>
    </div>
  );
}
