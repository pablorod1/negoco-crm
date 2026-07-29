import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ComparativaVM } from "@/comparativas/types";
import type { User } from "@/core/types";
import { showCustomToast } from "@/core/components/CustomToast";
import ComparativaComissionsSection from "@/comparativas/components/editComparativa/ComparativaComissionsSection";
import { useComparativaDetails } from "./useComparativaDetails";

const mocks = vi.hoisted(() => ({
  comparisonId: "comparison-1",
  router: {
    push: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: mocks.comparisonId }),
}));

vi.mock("next-view-transitions", () => ({
  useTransitionRouter: () => mocks.router,
}));

vi.mock("@/core/components/CustomToast", () => ({
  showCustomToast: vi.fn(),
}));

const userData = {
  id: "admin-1",
  email: "admin@example.com",
  email_verified: true,
  name: "Admin",
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  banned: false,
  image: null,
  organization: {
    id: "organization-1",
    name: "Negoco",
    logo: null,
    plan: null,
  },
  company: null,
  role: "1",
  super_id: null,
  should_reset_password: false,
} satisfies User;

const comparisonOne = {
  id: "comparison-1",
  client: "ACME",
  service: "Luz",
  plan: ["fijo"],
  comision: { fijo: 120, indexado: 80 },
  comision_sales_person: { fijo: 60, indexado: 40 },
  notes: [],
  user: {
    id: "sales-person-1",
    name: "Ana",
    email: "ana@example.com",
    role: "2",
  },
  creation_date: "2026-01-01",
  status: "completed",
  tramite_id: undefined,
  files: [],
  has_permanencia: false,
  has_renovacion: false,
} satisfies ComparativaVM;

function comparisonResponse(comparativa: ComparativaVM) {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({
      success: true,
      data: comparativa,
    }),
  };
}

function mutationResponse() {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({ success: true }),
  };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

describe("useComparativaDetails loading boundaries", () => {
  beforeEach(() => {
    mocks.comparisonId = "comparison-1";
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  test("uses loading until the initial comparison arrives", async () => {
    const initialRequest =
      deferred<ReturnType<typeof comparisonResponse>>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(initialRequest.promise));

    const { result } = renderHook(() =>
      useComparativaDetails({ userData }),
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.loadedData).toBe(false);
    expect(result.current.comparativa).toBeNull();

    await act(async () => {
      initialRequest.resolve(comparisonResponse(comparisonOne));
      await initialRequest.promise;
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.loadedData).toBe(true);
    expect(result.current.comparativa).toEqual(comparisonOne);
  });

  test("keeps same-id loaded data available during a background refresh", async () => {
    const backgroundRequest =
      deferred<ReturnType<typeof comparisonResponse>>();
    const refreshedComparison = {
      ...comparisonOne,
      client: "ACME refreshed",
    } satisfies ComparativaVM;
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(comparisonResponse(comparisonOne))
        .mockReturnValueOnce(backgroundRequest.promise),
    );

    const { result } = renderHook(() =>
      useComparativaDetails({ userData }),
    );
    await waitFor(() => {
      expect(result.current.comparativa).toEqual(comparisonOne);
    });

    act(() => {
      void result.current.fetchComparativa();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.loadedData).toBe(true);
    expect(result.current.comparativa).toEqual(comparisonOne);

    await act(async () => {
      backgroundRequest.resolve(comparisonResponse(refreshedComparison));
      await backgroundRequest.promise;
    });

    await waitFor(() => {
      expect(result.current.comparativa).toEqual(refreshedComparison);
    });
  });

  test("returns to loading without exposing old data when the route id changes", async () => {
    const nextIdRequest =
      deferred<ReturnType<typeof comparisonResponse>>();
    const comparisonTwo = {
      ...comparisonOne,
      id: "comparison-2",
      client: "New comparison",
    } satisfies ComparativaVM;
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(comparisonResponse(comparisonOne))
        .mockReturnValueOnce(nextIdRequest.promise),
    );

    const { result, rerender } = renderHook(() =>
      useComparativaDetails({ userData }),
    );
    await waitFor(() => {
      expect(result.current.comparativa).toEqual(comparisonOne);
    });

    mocks.comparisonId = "comparison-2";
    rerender();

    expect(result.current.loading).toBe(true);
    expect(result.current.loadedData).toBe(false);
    expect(result.current.comparativa).toBeNull();

    await act(async () => {
      nextIdRequest.resolve(comparisonResponse(comparisonTwo));
      await nextIdRequest.promise;
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.comparativa).toEqual(comparisonTwo);
  });

  test("preserves a pending commission lock across a same-id refresh", async () => {
    const mutationRequest = deferred<ReturnType<typeof mutationResponse>>();
    const backgroundRequest =
      deferred<ReturnType<typeof comparisonResponse>>();
    const refreshedComparison = {
      ...comparisonOne,
      plan: ["indexado"],
      comision: { fijo: 120, indexado: 95 },
      comision_sales_person: { fijo: 60, indexado: 45 },
    } satisfies ComparativaVM;
    const fetchMock = vi.fn(
      (url: string, init?: { method?: string }) => {
        if (init?.method === "PATCH") {
          return mutationRequest.promise;
        }

        if (url === "/api/v2/comparisons/comparison-1") {
          const comparisonFetchCount = fetchMock.mock.calls.filter(
            ([calledUrl]) =>
              calledUrl === "/api/v2/comparisons/comparison-1",
          ).length;

          return comparisonFetchCount === 1
            ? Promise.resolve(comparisonResponse(comparisonOne))
            : backgroundRequest.promise;
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    function Harness() {
      const details = useComparativaDetails({ userData });

      if (
        details.loading ||
        !details.loadedData ||
        !details.comparativa
      ) {
        return <div role="status">Cargando comparativa</div>;
      }

      return (
        <>
          <button
            type="button"
            onClick={() => void details.fetchComparativa()}
          >
            Refrescar comparación
          </button>
          <ComparativaComissionsSection
            userData={userData}
            comparativa={details.comparativa}
            canEdit
            onUpdate={details.fetchComparativa}
          />
        </>
      );
    }

    render(<Harness />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Editar" })).toBeVisible();
    });

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(
      screen.getByRole("spinbutton", {
        name: "Comisión Fijo de Negoco",
      }),
      { target: { value: "125" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar comisiones" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Refrescar comparación" }),
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Guardar comisiones" }),
    ).toBeDisabled();

    await act(async () => {
      backgroundRequest.resolve(comparisonResponse(refreshedComparison));
      await backgroundRequest.promise;
    });

    const editButton = await screen.findByRole("button", {
      name: "Editar",
    });
    expect(editButton).toBeDisabled();
    fireEvent.click(editButton);
    expect(
      screen.queryByRole("button", { name: "Guardar comisiones" }),
    ).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(
        ([, init]) => init?.method === "PATCH",
      ),
    ).toHaveLength(1);

    await act(async () => {
      mutationRequest.resolve(mutationResponse());
      await mutationRequest.promise;
    });

    await waitFor(() => {
      expect(editButton).toBeEnabled();
    });
    expect(showCustomToast).not.toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.filter(
        ([, init]) => init?.method === "POST",
      ),
    ).toHaveLength(2);
  });
});
