import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { User } from "@/core/types";
import type { AccessControlSnapshot } from "@/core/access-control/types";
import { showCustomToast } from "@/core/components/CustomToast";
import PermissionsSection from "./PermissionsSection";

vi.mock("@/core/components/CustomToast", () => ({
  showCustomToast: vi.fn(),
}));

const userData = {
  id: "admin-1",
  role: "admin",
} as User;

const users = [
  {
    id: "commercial-1",
    name: "Ana Comercial",
    email: "ana@example.com",
    role: "2",
    banned: false,
  },
  {
    id: "commercial-2",
    name: "Bruno Inactivo",
    email: "bruno@example.com",
    role: "2",
    banned: true,
  },
  {
    id: "admin-2",
    name: "Dirección Dos",
    email: "direccion@example.com",
    role: "admin",
    banned: false,
  },
];

const snapshot: AccessControlSnapshot = {
  catalog: [
    {
      key: "comparisons.study.complete",
      group: "Comparativas",
      label: "Completar estudios",
      description: "Permite completar estudios.",
      defaults: { admin: true, "1": true, "2": false },
    },
    {
      key: "comparisons.study.review",
      group: "Comparativas",
      label: "Revisar estudios con IA",
      description: "Permite revisar estudios.",
      defaults: { admin: true, "1": true, "2": false },
    },
  ],
  roles: [
    {
      id: "1",
      label: "Backoffice",
      permissions: {
        "comparisons.study.complete": true,
        "comparisons.study.review": true,
      },
      settings: {},
    },
    {
      id: "2",
      label: "Comercial",
      permissions: {
        "comparisons.study.complete": false,
        "comparisons.study.review": false,
      },
      settings: {},
    },
  ],
  user_overrides: [
    {
      user_id: "commercial-1",
      permission_key: "comparisons.study.review",
      enabled: true,
    },
    {
      user_id: "commercial-2",
      permission_key: "comparisons.study.complete",
      enabled: false,
    },
  ],
};

const snapshotWithoutAi: AccessControlSnapshot = {
  ...snapshot,
  catalog: snapshot.catalog.filter(
    (permission) => permission.key === "comparisons.study.complete",
  ),
  roles: snapshot.roles.map((role) => ({
    ...role,
    permissions: {
      "comparisons.study.complete": role.id === "1",
    },
    settings: {},
  })),
  user_overrides: snapshot.user_overrides.filter(
    (override) =>
      override.permission_key === "comparisons.study.complete",
  ),
};

function jsonResponse(data: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
  } as Response);
}

function mockInitialRequests(
  nextSnapshot: unknown = snapshot,
  initialSnapshot: unknown = snapshot,
) {
  const fetchMock = vi.mocked(fetch);
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);

    if (init?.method === "PATCH") {
      return jsonResponse({ success: true, data: nextSnapshot });
    }
    if (url === "/api/v2/access-control") {
      return jsonResponse({ success: true, data: initialSnapshot });
    }
    if (url === "/api/v2/users/admin-1/all?role=admin") {
      return jsonResponse({ success: true, data: users });
    }

    throw new Error(`Unexpected request: ${url}`);
  });

  return fetchMock;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

describe("PermissionsSection", () => {
  test("loads access control and users in parallel and renders the role matrix", async () => {
    let resolveAccess!: (response: Response) => void;
    let resolveUsers!: (response: Response) => void;
    const accessResponse = new Promise<Response>((resolve) => {
      resolveAccess = resolve;
    });
    const usersResponse = new Promise<Response>((resolve) => {
      resolveUsers = resolve;
    });

    vi.mocked(fetch).mockImplementation((input) => {
      if (String(input) === "/api/v2/access-control") return accessResponse;
      return usersResponse;
    });

    render(<PermissionsSection userData={userData} />);

    expect(screen.getByText("Cargando permisos…")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);

    resolveAccess({
      ok: true,
      json: () => Promise.resolve({ success: true, data: snapshot }),
    } as Response);
    resolveUsers({
      ok: true,
      json: () => Promise.resolve({ success: true, data: users }),
    } as Response);

    expect(
      await screen.findByRole("heading", { name: "Comparativas" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Completar estudios")).toBeInTheDocument();
    expect(screen.getByText("Revisar estudios con IA")).toBeInTheDocument();
    expect(screen.getByText("Backoffice")).toBeInTheDocument();
    expect(screen.getByText("Comercial")).toBeInTheDocument();
    expect(screen.getAllByRole("switch")).toHaveLength(4);

    fireEvent.click(screen.getByRole("tab", { name: "Por usuario" }));
    expect(
      screen.getByRole("button", { name: /Ana Comercial/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Dirección Dos")).not.toBeInTheDocument();
  });

  test("renders only the tenant catalog without exposing hidden AI permissions", async () => {
    mockInitialRequests(snapshotWithoutAi, snapshotWithoutAi);

    render(<PermissionsSection userData={userData} />);

    expect(await screen.findByText("Completar estudios")).toBeInTheDocument();
    expect(screen.queryByText("Revisar estudios con IA")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("switch", {
        name: "Revisar estudios con IA para Comercial",
      }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("switch")).toHaveLength(2);

    fireEvent.click(screen.getByRole("tab", { name: "Por usuario" }));
    fireEvent.click(screen.getByRole("button", { name: /Ana Comercial/ }));

    expect(screen.getByText("Completar estudios")).toBeInTheDocument();
    expect(screen.queryByText("Revisar estudios con IA")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("switch", {
        name: "Revisar estudios con IA para Ana Comercial",
      }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("switch")).toHaveLength(1);
  });

  test("rejects a snapshot without an effective role value for a visible permission", async () => {
    const inconsistentSnapshot: AccessControlSnapshot = {
      ...snapshotWithoutAi,
      roles: snapshotWithoutAi.roles.map((role) =>
        role.id === "2" ? { ...role, permissions: {} } : role,
      ),
    };
    mockInitialRequests(inconsistentSnapshot, inconsistentSnapshot);

    render(<PermissionsSection userData={userData} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falta el permiso efectivo comparisons.study.complete para el rol Comercial.",
    );
    expect(
      screen.queryByRole("switch", {
        name: "Completar estudios para Comercial",
      }),
    ).not.toBeInTheDocument();
  });

  test.each([
    {
      name: "a duplicate configurable role",
      invalidSnapshot: {
        ...snapshot,
        roles: [snapshot.roles[0], snapshot.roles[0]],
      },
    },
    {
      name: "an admin role",
      invalidSnapshot: {
        ...snapshot,
        roles: [
          { ...snapshot.roles[0], id: "admin" },
          snapshot.roles[1],
        ],
      },
    },
    {
      name: "malformed catalog strings",
      invalidSnapshot: {
        ...snapshot,
        catalog: [
          { ...snapshot.catalog[0], group: " " },
          snapshot.catalog[1],
        ],
      },
    },
    {
      name: "a duplicate catalog key",
      invalidSnapshot: {
        ...snapshot,
        catalog: [
          snapshot.catalog[0],
          { ...snapshot.catalog[1], key: snapshot.catalog[0].key },
        ],
      },
    },
    {
      name: "an invalid override subject",
      invalidSnapshot: {
        ...snapshot,
        user_overrides: [
          { ...snapshot.user_overrides[0], user_id: " " },
        ],
      },
    },
  ])("shows a load error for $name", async ({ invalidSnapshot }) => {
    mockInitialRequests(invalidSnapshot, invalidSnapshot);

    render(<PermissionsSection userData={userData} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo cargar la configuración",
    );
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  test("renders and updates a future permission supplied by the server catalog", async () => {
    const futurePermissionKey = "comparisons.study.export";
    const futureSnapshot = {
      ...snapshot,
      catalog: [
        ...snapshot.catalog,
        {
          key: futurePermissionKey,
          group: "Comparativas",
          label: "Exportar estudios",
          description: "Permite exportar el resultado de los estudios.",
          defaults: { admin: true, "1": true, "2": false },
        },
      ],
      roles: snapshot.roles.map((role) => ({
        ...role,
        permissions: {
          ...role.permissions,
          [futurePermissionKey]: role.id === "1",
        },
        settings: {
          ...role.settings,
          [futurePermissionKey]: role.id === "1",
        },
      })),
      user_overrides: [
        ...snapshot.user_overrides,
        {
          user_id: "commercial-2",
          permission_key: futurePermissionKey,
          enabled: true,
        },
      ],
    };
    const fetchMock = mockInitialRequests(futureSnapshot, futureSnapshot);

    render(<PermissionsSection userData={userData} />);

    const roleSwitch = await screen.findByRole("switch", {
      name: "Exportar estudios para Comercial",
    });
    expect(screen.getByText("Exportar estudios")).toBeInTheDocument();
    expect(roleSwitch).not.toBeChecked();

    fireEvent.click(roleSwitch);
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar cambios de rol" }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v2/access-control",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            updates: [
              {
                subject_type: "role",
                subject_id: "2",
                permission_key: futurePermissionKey,
                enabled: true,
              },
            ],
          }),
        }),
      );
      expect(screen.getByRole("tab", { name: "Por usuario" })).not.toBeDisabled();
    });
    expect(
      screen.getByRole("button", { name: "Guardar cambios de rol" }),
    ).toBeEnabled();

    fireEvent.click(screen.getByRole("tab", { name: "Por usuario" }));
    fireEvent.click(screen.getByRole("button", { name: /Ana Comercial/ }));

    const userSwitch = screen.getByRole("switch", {
      name: "Exportar estudios para Ana Comercial",
    });
    expect(screen.getByText("Exportar estudios")).toBeInTheDocument();
    expect(userSwitch).not.toBeChecked();

    fireEvent.click(userSwitch);
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar cambios de usuario" }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v2/access-control",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            updates: [
              {
                subject_type: "user",
                subject_id: "commercial-1",
                permission_key: futurePermissionKey,
                enabled: true,
              },
            ],
          }),
        }),
      );
    });
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Guardar cambios de usuario" }),
      ).toBeEnabled();
    });
  });

  test("sends only the staged role change and applies the returned snapshot", async () => {
    const updatedSnapshot: AccessControlSnapshot = {
      ...snapshot,
      roles: snapshot.roles.map((role) =>
        role.id === "2"
          ? {
              ...role,
              permissions: {
                ...role.permissions,
                "comparisons.study.complete": true,
              },
              settings: {
                ...role.settings,
                "comparisons.study.complete": true,
              },
            }
          : role,
      ),
    };
    const fetchMock = mockInitialRequests(updatedSnapshot);

    render(<PermissionsSection userData={userData} />);

    const roleSwitch = await screen.findByRole("switch", {
      name: "Completar estudios para Comercial",
    });
    fireEvent.click(roleSwitch);
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios de rol" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v2/access-control",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            updates: [
              {
                subject_type: "role",
                subject_id: "2",
                permission_key: "comparisons.study.complete",
                enabled: true,
              },
            ],
          }),
        }),
      );
    });
    expect(roleSwitch).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Guardar cambios de rol" }),
    ).toBeDisabled();
  });

  test("shows inherited permissions and creates an override contrary to the role", async () => {
    const updatedSnapshot: AccessControlSnapshot = {
      ...snapshot,
      user_overrides: [
        ...snapshot.user_overrides,
        {
          user_id: "commercial-1",
          permission_key: "comparisons.study.complete",
          enabled: true,
        },
      ],
    };
    const fetchMock = mockInitialRequests(updatedSnapshot);

    render(<PermissionsSection userData={userData} />);

    fireEvent.click(await screen.findByRole("tab", { name: "Por usuario" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar usuario" }), {
      target: { value: "Ana" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Ana Comercial/ }));

    const permissionRow = screen
      .getByText("Completar estudios")
      .closest("[data-permission-row]");
    expect(permissionRow).not.toBeNull();
    expect(
      within(permissionRow as HTMLElement).getByText("Rol: Deshabilitado"),
    ).toBeInTheDocument();

    fireEvent.click(
      within(permissionRow as HTMLElement).getByRole("switch", {
        name: "Completar estudios para Ana Comercial",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar cambios de usuario" }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v2/access-control",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            updates: [
              {
                subject_type: "user",
                subject_id: "commercial-1",
                permission_key: "comparisons.study.complete",
                enabled: true,
              },
            ],
          }),
        }),
      );
    });
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Guardar cambios de usuario" }),
      ).toBeDisabled();
    });
  });

  test("keeps a user's draft when the selected user is clicked again", async () => {
    mockInitialRequests();

    render(<PermissionsSection userData={userData} />);

    fireEvent.click(await screen.findByRole("tab", { name: "Por usuario" }));
    const anaButton = screen.getByRole("button", { name: /Ana Comercial/ });
    fireEvent.click(anaButton);

    const permissionSwitch = screen.getByRole("switch", {
      name: "Completar estudios para Ana Comercial",
    });
    fireEvent.click(permissionSwitch);
    expect(permissionSwitch).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Guardar cambios de usuario" }),
    ).toBeEnabled();

    fireEvent.click(anaButton);

    expect(permissionSwitch).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Guardar cambios de usuario" }),
    ).toBeEnabled();
  });

  test("rebases a user draft after the role update makes it redundant", async () => {
    const updatedSnapshot: AccessControlSnapshot = {
      ...snapshot,
      roles: snapshot.roles.map((role) =>
        role.id === "2"
          ? {
              ...role,
              permissions: {
                ...role.permissions,
                "comparisons.study.complete": true,
              },
              settings: {
                ...role.settings,
                "comparisons.study.complete": true,
              },
            }
          : role,
      ),
    };
    const fetchMock = mockInitialRequests(updatedSnapshot);

    render(<PermissionsSection userData={userData} />);

    fireEvent.click(await screen.findByRole("tab", { name: "Por usuario" }));
    fireEvent.click(screen.getByRole("button", { name: /Ana Comercial/ }));
    fireEvent.click(
      screen.getByRole("switch", {
        name: "Completar estudios para Ana Comercial",
      }),
    );

    fireEvent.click(screen.getByRole("tab", { name: "Por rol" }));
    fireEvent.click(
      screen.getByRole("switch", {
        name: "Completar estudios para Comercial",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar cambios de rol" }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Guardar cambios de rol" }),
      ).toBeDisabled();
    });
    fireEvent.click(screen.getByRole("tab", { name: "Por usuario" }));

    const permissionRow = screen
      .getByText("Completar estudios")
      .closest("[data-permission-row]");
    expect(permissionRow).not.toBeNull();
    expect(
      within(permissionRow as HTMLElement).getByRole("switch", {
        name: "Completar estudios para Ana Comercial",
      }),
    ).toBeChecked();
    expect(
      within(permissionRow as HTMLElement).queryByText("Personalizado"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Guardar cambios de usuario" }),
    ).toBeDisabled();

    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH"),
    ).toHaveLength(1);
  });

  test("keeps matching stored overrides personalized and resets them with null", async () => {
    const updatedSnapshot: AccessControlSnapshot = {
      ...snapshot,
      user_overrides: snapshot.user_overrides.filter(
        (override) =>
          !(
            override.user_id === "commercial-2" &&
            override.permission_key === "comparisons.study.complete"
          ),
      ),
    };
    const fetchMock = mockInitialRequests(updatedSnapshot);

    render(<PermissionsSection userData={userData} />);

    fireEvent.click(await screen.findByRole("tab", { name: "Por usuario" }));
    fireEvent.click(screen.getByRole("button", { name: /Bruno Inactivo/ }));

    const permissionRow = screen
      .getByText("Completar estudios")
      .closest("[data-permission-row]");
    expect(permissionRow).not.toBeNull();
    expect(
      within(permissionRow as HTMLElement).getByText("Personalizado"),
    ).toBeInTheDocument();
    expect(
      within(permissionRow as HTMLElement).getByText("Rol: Deshabilitado"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Inactivo")).not.toHaveLength(0);

    fireEvent.click(
      within(permissionRow as HTMLElement).getByRole("button", {
        name: "Restablecer Completar estudios al rol",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar cambios de usuario" }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v2/access-control",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            updates: [
              {
                subject_type: "user",
                subject_id: "commercial-2",
                permission_key: "comparisons.study.complete",
                enabled: null,
              },
            ],
          }),
        }),
      );
    });
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Guardar cambios de usuario" }),
      ).toBeDisabled();
    });
  });

  test("restores a matching persisted override after toggling away and back", async () => {
    const fetchMock = mockInitialRequests();

    render(<PermissionsSection userData={userData} />);

    fireEvent.click(await screen.findByRole("tab", { name: "Por usuario" }));
    fireEvent.click(screen.getByRole("button", { name: /Bruno Inactivo/ }));

    const permissionRow = screen
      .getByText("Completar estudios")
      .closest("[data-permission-row]");
    expect(permissionRow).not.toBeNull();
    const permissionSwitch = within(
      permissionRow as HTMLElement,
    ).getByRole("switch", {
      name: "Completar estudios para Bruno Inactivo",
    });

    fireEvent.click(permissionSwitch);
    fireEvent.click(permissionSwitch);

    expect(
      within(permissionRow as HTMLElement).getByText("Personalizado"),
    ).toBeInTheDocument();
    const saveButton = screen.getByRole("button", {
      name: "Guardar cambios de usuario",
    });
    expect(saveButton).toBeDisabled();
    fireEvent.click(saveButton);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("aborts stale GET requests and ignores their late responses after rerender", async () => {
    let resolveOldAccess!: (response: Response) => void;
    let resolveOldUsers!: (response: Response) => void;
    let accessRequests = 0;
    const oldAccess = new Promise<Response>((resolve) => {
      resolveOldAccess = resolve;
    });
    const oldUsers = new Promise<Response>((resolve) => {
      resolveOldUsers = resolve;
    });
    const oldSignals: AbortSignal[] = [];
    const oldSnapshot: AccessControlSnapshot = {
      ...snapshotWithoutAi,
      catalog: snapshotWithoutAi.catalog.map((permission) => ({
        ...permission,
        label: "Permiso obsoleto",
      })),
    };
    const nextSnapshot: AccessControlSnapshot = {
      ...snapshotWithoutAi,
      catalog: snapshotWithoutAi.catalog.map((permission) => ({
        ...permission,
        label: "Permiso vigente",
      })),
    };
    const nextUserData = { ...userData, id: "admin-next" } as User;

    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = String(input);
      if (url === "/api/v2/access-control") {
        accessRequests += 1;
        if (accessRequests === 1) {
          if (init?.signal) oldSignals.push(init.signal);
          return oldAccess;
        }
        return jsonResponse({ success: true, data: nextSnapshot });
      }
      if (url === "/api/v2/users/admin-1/all?role=admin") {
        if (init?.signal) oldSignals.push(init.signal);
        return oldUsers;
      }
      if (url === "/api/v2/users/admin-next/all?role=admin") {
        return jsonResponse({ success: true, data: users });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const { rerender } = render(
      <PermissionsSection userData={userData} />,
    );
    rerender(<PermissionsSection userData={nextUserData} />);

    expect(oldSignals).toHaveLength(2);
    expect(oldSignals.every((signal) => signal.aborted)).toBe(true);
    expect(await screen.findByText("Permiso vigente")).toBeInTheDocument();

    await act(async () => {
      resolveOldAccess({
        ok: true,
        json: () =>
          Promise.resolve({ success: true, data: oldSnapshot }),
      } as Response);
      resolveOldUsers({
        ok: true,
        json: () => Promise.resolve({ success: true, data: users }),
      } as Response);
      await Promise.resolve();
    });

    expect(screen.getByText("Permiso vigente")).toBeInTheDocument();
    expect(screen.queryByText("Permiso obsoleto")).not.toBeInTheDocument();
  });

  test("resets identity state and ignores a late PATCH response after rerender", async () => {
    let resolvePatch!: (response: Response) => void;
    let resolveNextAccess!: (response: Response) => void;
    let resolveNextUsers!: (response: Response) => void;
    let patchSignal: AbortSignal | undefined;
    let accessRequests = 0;
    const pendingPatch = new Promise<Response>((resolve) => {
      resolvePatch = resolve;
    });
    const pendingNextAccess = new Promise<Response>((resolve) => {
      resolveNextAccess = resolve;
    });
    const pendingNextUsers = new Promise<Response>((resolve) => {
      resolveNextUsers = resolve;
    });
    const nextIdentitySnapshot: AccessControlSnapshot = {
      ...snapshotWithoutAi,
      catalog: snapshotWithoutAi.catalog.map((permission) => ({
        ...permission,
        label: "Permiso de la nueva identidad",
      })),
    };
    const nextUserData = {
      ...userData,
      id: "admin-next",
    } as User;

    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = String(input);
      if (init?.method === "PATCH") {
        patchSignal = init.signal ?? undefined;
        return pendingPatch;
      }
      if (url === "/api/v2/access-control") {
        accessRequests += 1;
        return accessRequests === 1
          ? jsonResponse({ success: true, data: snapshot })
          : pendingNextAccess;
      }
      if (url === "/api/v2/users/admin-1/all?role=admin") {
        return jsonResponse({ success: true, data: users });
      }
      if (url === "/api/v2/users/admin-next/all?role=admin") {
        return pendingNextUsers;
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const { rerender } = render(
      <PermissionsSection userData={userData} />,
    );

    fireEvent.click(await screen.findByRole("tab", { name: "Por usuario" }));
    fireEvent.click(screen.getByRole("button", { name: /Ana Comercial/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar usuario" }), {
      target: { value: "Ana" },
    });
    fireEvent.click(
      screen.getByRole("switch", {
        name: "Completar estudios para Ana Comercial",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar cambios de usuario" }),
    );

    await waitFor(() => expect(patchSignal).toBeDefined());
    rerender(<PermissionsSection userData={nextUserData} />);

    expect(patchSignal?.aborted).toBe(true);
    expect(screen.getByText("Cargando permisos…")).toBeInTheDocument();

    await act(async () => {
      resolveNextAccess({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: nextIdentitySnapshot,
          }),
      } as Response);
      resolveNextUsers({
        ok: true,
        json: () => Promise.resolve({ success: true, data: users }),
      } as Response);
    });

    fireEvent.click(
      await screen.findByRole("tab", { name: "Por rol" }),
    );
    expect(screen.getByText("Permiso de la nueva identidad")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Por usuario" }));
    expect(screen.getByRole("searchbox", { name: "Buscar usuario" })).toHaveValue(
      "",
    );

    await act(async () => {
      resolvePatch({
        ok: true,
        json: () => Promise.resolve({ success: true, data: snapshot }),
      } as Response);
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Por rol" }));
    expect(
      screen.getByText("Permiso de la nueva identidad"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Completar estudios")).not.toBeInTheDocument();
    expect(showCustomToast).not.toHaveBeenCalled();
  });

  test("aborts a pending PATCH on unmount without showing a late toast", async () => {
    let resolvePatch!: (response: Response) => void;
    let patchSignal: AbortSignal | undefined;
    const pendingPatch = new Promise<Response>((resolve) => {
      resolvePatch = resolve;
    });

    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = String(input);
      if (init?.method === "PATCH") {
        patchSignal = init.signal ?? undefined;
        return pendingPatch;
      }
      if (url === "/api/v2/access-control") {
        return jsonResponse({ success: true, data: snapshot });
      }
      if (url === "/api/v2/users/admin-1/all?role=admin") {
        return jsonResponse({ success: true, data: users });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const { unmount } = render(
      <PermissionsSection userData={userData} />,
    );

    fireEvent.click(await screen.findByRole("tab", { name: "Por usuario" }));
    fireEvent.click(screen.getByRole("button", { name: /Ana Comercial/ }));
    fireEvent.click(
      screen.getByRole("switch", {
        name: "Completar estudios para Ana Comercial",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar cambios de usuario" }),
    );

    await waitFor(() => expect(patchSignal).toBeDefined());
    unmount();
    expect(patchSignal?.aborted).toBe(true);

    await act(async () => {
      resolvePatch({
        ok: true,
        json: () => Promise.resolve({ success: true, data: snapshot }),
      } as Response);
      await Promise.resolve();
    });

    expect(showCustomToast).not.toHaveBeenCalled();
  });

  test("locks draft-changing controls while a PATCH is pending", async () => {
    let resolvePatch!: (response: Response) => void;
    const pendingPatch = new Promise<Response>((resolve) => {
      resolvePatch = resolve;
    });
    const updatedSnapshot: AccessControlSnapshot = {
      ...snapshot,
      user_overrides: [
        ...snapshot.user_overrides,
        {
          user_id: "commercial-1",
          permission_key: "comparisons.study.complete",
          enabled: true,
        },
      ],
    };

    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = String(input);
      if (init?.method === "PATCH") return pendingPatch;
      if (url === "/api/v2/access-control") {
        return jsonResponse({ success: true, data: snapshot });
      }
      if (url === "/api/v2/users/admin-1/all?role=admin") {
        return jsonResponse({ success: true, data: users });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<PermissionsSection userData={userData} />);

    fireEvent.click(await screen.findByRole("tab", { name: "Por usuario" }));
    const anaButton = screen.getByRole("button", { name: /Ana Comercial/ });
    const brunoButton = screen.getByRole("button", { name: /Bruno Inactivo/ });
    fireEvent.click(anaButton);
    fireEvent.click(
      screen.getByRole("switch", {
        name: "Completar estudios para Ana Comercial",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar cambios de usuario" }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: "Guardando cambios de usuario…",
        }),
      ).toHaveTextContent("Guardando…");
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Tienes cambios sin guardar",
    );
    expect(
      screen
        .getByRole("tab", { name: "Por usuario" })
        .closest('[aria-busy="true"]'),
    ).not.toBeNull();
    expect(screen.getByRole("tab", { name: "Por rol" })).toBeDisabled();
    expect(screen.getByRole("searchbox", { name: "Buscar usuario" })).toBeDisabled();
    expect(anaButton).toBeDisabled();
    expect(brunoButton).toBeDisabled();
    expect(
      screen.getByRole("switch", {
        name: "Completar estudios para Ana Comercial",
      }),
    ).toBeDisabled();

    fireEvent.click(brunoButton);
    expect(anaButton).toHaveAttribute("aria-pressed", "true");
    expect(brunoButton).toHaveAttribute("aria-pressed", "false");

    resolvePatch({
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: updatedSnapshot }),
    } as Response);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Guardar cambios de usuario" }),
      ).toBeDisabled();
    });
    expect(anaButton).toHaveAttribute("aria-pressed", "true");
  });
});
