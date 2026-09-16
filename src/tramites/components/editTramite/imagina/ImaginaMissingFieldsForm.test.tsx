import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { User } from "@/core/types";
import type { ClientDB, ContractDB, SignerDB } from "@/tramites/types";
import ImaginaMissingFieldsForm from "./ImaginaMissingFieldsForm";

vi.mock("@/core/components/CustomToast", () => ({
  showCustomToast: vi.fn(),
}));

// Radix Select no se puede manejar con fireEvent; un <select> nativo basta
// para comprobar qué opciones se ofrecen y qué valor se guarda.
vi.mock(
  "@/tramites/components/createTramite/InputComponent",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/tramites/components/createTramite/InputComponent")
    >()),
    SelectComponent: ({
      label,
      selectedKey,
      onChange,
      items,
      errors,
    }: {
      label: string;
      selectedKey: string;
      onChange: (value: string) => void;
      items: Array<string | { value: string; label: string }>;
      errors?: string;
    }) => (
      <label>
        {label}
        <select
          aria-label={label}
          value={selectedKey}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value={selectedKey}>{selectedKey}</option>
          {items.map((item) => {
            const value = typeof item === "string" ? item : item.value;
            return (
              <option key={value} value={value}>
                {typeof item === "string" ? item : item.label}
              </option>
            );
          })}
        </select>
        {errors ? <p>{errors}</p> : null}
      </label>
    ),
  }),
);

const client: ClientDB = {
  id: "client-1",
  name: "Juan",
  last_name: "Perez",
  email: "juan@example.test",
  type: "Particular",
  phone: "600000000",
  address: "Calle Alcala 1",
  postal_code: "28001",
  province: "Madrid",
  city: "Madrid",
  document_type: "DNI",
  document_number: "12345678A",
  IBAN: "",
  coordinates: null,
};

const contract: ContractDB = {
  id: "contract-1",
  type: "Cambio Compañía",
  province: "Madrid",
  city: "Madrid",
  address: "Calle Alcala 1",
  postal_code: "28001",
  new_company: "Imagina Energía",
  plan: "2.0TD",
  consumption: 2500,
  CUPS: "",
  pot1: 3.45,
  pot2: 3.45,
  pot3: 0,
  pot4: 0,
  pot5: 0,
  pot6: 0,
  description: "",
  tramite_id: "tramite-1",
  rate_id: "rate-1",
};

const userData = { id: "user-1", role: "1" } as User;

const fetchMock = vi.fn();
const okResponse = () =>
  Promise.resolve({ json: () => Promise.resolve({ success: true }) });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(okResponse);
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const patchCalls = () =>
  fetchMock.mock.calls.map(([url, init]) => ({
    url: String(url),
    body: JSON.parse((init as RequestInit).body as string),
  }));

test("renders only the missing fields and saves client and contract separately", async () => {
  const onSaved = vi.fn();
  render(
    <ImaginaMissingFieldsForm
      missing={[
        { field: "iban", source: "clients", message: "Completa iban" },
        { field: "cups", source: "contracts", message: "Completa cups" },
      ]}
      tramiteId="tramite-1"
      client={client}
      contract={contract}
      signer={null}
      userData={userData}
      onSaved={onSaved}
    />,
  );

  expect(screen.getByLabelText(/IBAN/)).toBeInTheDocument();
  expect(screen.getByLabelText(/CUPS/)).toBeInTheDocument();
  expect(screen.queryByText("Firmante")).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Teléfono/)).not.toBeInTheDocument();

  const save = screen.getByRole("button", { name: /Guardar y validar/ });
  expect(save).toBeDisabled();

  fireEvent.change(screen.getByLabelText(/IBAN/), {
    target: { value: "ES9121000418450200051332" },
  });
  fireEvent.change(screen.getByLabelText(/CUPS/), {
    target: { value: "es0026000010979933fw" },
  });
  fireEvent.click(save);

  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));

  const calls = patchCalls();
  expect(calls).toHaveLength(2);
  expect(calls[0]).toEqual({
    url: "/api/v2/clients/client-1/signature",
    body: { client: { IBAN: "ES9121000418450200051332" } },
  });
  expect(calls[1].url).toBe("/api/v2/contracts/tramite-1/contract");
  expect(calls[1].body.user_id).toBe("user-1");
  expect(calls[1].body.contract).toMatchObject({
    ...contract,
    CUPS: "ES0026000010979933FW",
  });
});

test("creates the signer prefilled from the client when the company has none", async () => {
  const onSaved = vi.fn();
  render(
    <ImaginaMissingFieldsForm
      missing={[
        { field: "firmante", source: "signers", message: "Completa el firmante" },
      ]}
      tramiteId="tramite-1"
      client={{ ...client, type: "Empresa", document_type: "CIF" }}
      contract={contract}
      signer={{} as SignerDB}
      userData={userData}
      onSaved={onSaved}
    />,
  );

  expect(screen.getByText(/se creará al guardar/)).toBeInTheDocument();
  expect(screen.getByLabelText(/^Email/)).toHaveValue("juan@example.test");

  fireEvent.change(screen.getByLabelText(/^Nombre/), {
    target: { value: "Ana" },
  });
  fireEvent.change(screen.getByLabelText(/Apellidos/), {
    target: { value: "García" },
  });
  fireEvent.change(screen.getByLabelText(/Número de documento/), {
    target: { value: "87654321B" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Guardar y validar/ }));

  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));

  const [call] = patchCalls();
  expect(call.url).toBe("/api/v2/clients/client-1/signature");
  expect(call.body.client).toBeUndefined();
  expect(call.body.signer).toEqual({
    name: "Ana",
    last_name: "García",
    email: "juan@example.test",
    phone: "600000000",
    document_type: "DNI",
    document_number: "87654321B",
    phone_prefix: "34",
    cargo: null,
  });
});

test("keeps the edits and does not refresh when the server rejects them", async () => {
  fetchMock.mockImplementation(() =>
    Promise.resolve({
      json: () => Promise.resolve({ success: false, error: "IBAN inválido" }),
    }),
  );
  const onSaved = vi.fn();
  render(
    <ImaginaMissingFieldsForm
      missing={[{ field: "iban", source: "clients", message: "" }]}
      tramiteId="tramite-1"
      client={client}
      contract={contract}
      userData={userData}
      onSaved={onSaved}
    />,
  );

  fireEvent.change(screen.getByLabelText(/IBAN/), { target: { value: "XX" } });
  fireEvent.click(screen.getByRole("button", { name: /Guardar y validar/ }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(onSaved).not.toHaveBeenCalled();
  expect(screen.getByLabelText(/IBAN/)).toHaveValue("XX");
  expect(
    screen.getByRole("button", { name: /Guardar y validar/ }),
  ).toBeEnabled();
});

test("offers Imagina's own province and road type lists for unrecognised values", async () => {
  const onSaved = vi.fn();
  render(
    <ImaginaMissingFieldsForm
      missing={[
        {
          field: "provincia",
          source: "contracts",
          message: 'Provincia del punto de suministro: "Comunidad Valenciana" no está en la lista de Imagina',
        },
        { field: "tipo_via_cnmc", source: "contracts", message: "" },
      ]}
      tramiteId="tramite-1"
      client={client}
      contract={{
        ...contract,
        CUPS: "ES0026000010979933FW",
        province: "Comunidad Valenciana",
        tipo_via_cnmc: "Boulevard",
      }}
      userData={userData}
      onSaved={onSaved}
    />,
  );

  const province = screen.getByRole("combobox", {
    name: "Provincia del suministro",
  });
  expect(
    within(province).getByRole("option", { name: "Valencia/València" }),
  ).toBeInTheDocument();
  expect(screen.getByText(/no está en la lista de Imagina/)).toBeInTheDocument();
  // Sin buscador de direcciones: calle y número no faltan.
  expect(screen.queryByLabelText(/Dirección del suministro/)).not.toBeInTheDocument();

  fireEvent.change(province, { target: { value: "Valencia/València" } });
  fireEvent.change(
    screen.getByRole("combobox", { name: "Tipo de vía del suministro" }),
    { target: { value: "Calle" } },
  );
  fireEvent.click(screen.getByRole("button", { name: /Guardar y validar/ }));

  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  const [call] = patchCalls();
  expect(call.url).toBe("/api/v2/contracts/tramite-1/contract");
  expect(call.body.contract).toMatchObject({
    province: "Valencia/València",
    tipo_via_cnmc: "Calle",
  });
});

test("lets the user pick the municipality from Imagina's catalogue", async () => {
  const onSaved = vi.fn();
  render(
    <ImaginaMissingFieldsForm
      missing={[
        {
          field: "municipio",
          source: "contracts",
          message: 'Municipio del punto de suministro: "El Palmar" no está en la lista de Imagina',
        },
      ]}
      tramiteId="tramite-1"
      client={client}
      contract={{ ...contract, CUPS: "ES0026000010979933FW", city: "El Palmar" }}
      userData={userData}
      onSaved={onSaved}
    />,
  );

  const municipio = screen.getByRole("combobox", {
    name: /Municipio del suministro/,
  });
  expect(municipio).toHaveValue("El Palmar");

  fireEvent.change(municipio, { target: { value: "valen" } });
  const option = await screen.findByRole("option", { name: "València" });
  fireEvent.click(option);

  expect(municipio).toHaveValue("València");
  fireEvent.click(screen.getByRole("button", { name: /Guardar y validar/ }));

  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  const [call] = patchCalls();
  expect(call.url).toBe("/api/v2/contracts/tramite-1/contract");
  expect(call.body.contract.city).toBe("València");
});

test("asks for the holder's surname when Imagina requires it", async () => {
  const onSaved = vi.fn();
  render(
    <ImaginaMissingFieldsForm
      missing={[
        {
          field: "primer_apellido_titular",
          source: "clients",
          message: "Completa los apellidos del titular; Imagina los exige",
        },
      ]}
      tramiteId="tramite-1"
      client={{ ...client, last_name: "" }}
      contract={contract}
      userData={userData}
      onSaved={onSaved}
    />,
  );

  fireEvent.change(screen.getByLabelText(/Apellidos/), {
    target: { value: "Pérez García" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Guardar y validar/ }));

  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(patchCalls()).toEqual([
    {
      url: "/api/v2/clients/client-1/signature",
      body: { client: { last_name: "Pérez García" } },
    },
  ]);
});
