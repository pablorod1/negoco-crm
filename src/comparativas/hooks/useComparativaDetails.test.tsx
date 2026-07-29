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

  test("invalidates a pending response when the active identity becomes null", async () => {
    const identityRequest =
      deferred<ReturnType<typeof comparisonResponse>>();
    const fetchMock = vi.fn().mockReturnValue(identityRequest.promise);
    vi.stubGlobal("fetch", fetchMock);
    let currentUser: User | null = userData;

    const { result, rerender } = renderHook(() =>
      useComparativaDetails({ userData: currentUser }),
    );
    expect(fetchMock).toHaveBeenCalledOnce();

    currentUser = null;
    rerender();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.current.loading).toBe(true);
    expect(result.current.loadedData).toBe(false);
    expect(result.current.comparativa).toBeNull();

    await act(async () => {
      identityRequest.resolve({
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({
          success: false,
          error: "Unauthorized",
        }),
      });
      await identityRequest.promise;
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.loadedData).toBe(false);
    expect(result.current.comparativa).toBeNull();
    expect(showCustomToast).not.toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
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

  test("ignores an older overlapping same-id refresh that resolves last", async () => {
    const olderRequest =
      deferred<ReturnType<typeof comparisonResponse>>();
    const newerRequest =
      deferred<ReturnType<typeof comparisonResponse>>();
    const olderComparison = {
      ...comparisonOne,
      client: "Older refresh",
    } satisfies ComparativaVM;
    const newerComparison = {
      ...comparisonOne,
      client: "Newer refresh",
    } satisfies ComparativaVM;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(comparisonResponse(comparisonOne))
      .mockReturnValueOnce(olderRequest.promise)
      .mockReturnValueOnce(newerRequest.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useComparativaDetails({ userData }),
    );
    await waitFor(() => {
      expect(result.current.comparativa).toEqual(comparisonOne);
    });
    expect(fetchMock).toHaveBeenCalledOnce();

    let olderRefresh: Promise<void> | undefined;
    let newerRefresh: Promise<void> | undefined;
    act(() => {
      olderRefresh = result.current.fetchComparativa();
      newerRefresh = result.current.fetchComparativa();
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.slice(1)).toEqual([
      [
        "/api/v2/comparisons/comparison-1",
        expect.objectContaining({ method: "POST" }),
      ],
      [
        "/api/v2/comparisons/comparison-1",
        expect.objectContaining({ method: "POST" }),
      ],
    ]);

    await act(async () => {
      newerRequest.resolve(comparisonResponse(newerComparison));
      await newerRefresh;
    });

    await waitFor(() => {
      expect(result.current.comparativa).toEqual(newerComparison);
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.loadedData).toBe(true);

    await act(async () => {
      olderRequest.resolve(comparisonResponse(olderComparison));
      await olderRefresh;
    });

    expect(result.current.comparativa).toEqual(newerComparison);
    expect(result.current.loading).toBe(false);
    expect(result.current.loadedData).toBe(true);
    expect(showCustomToast).not.toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
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

  test("ignores an older route response that resolves after the current one", async () => {
    const comparisonOneRequest =
      deferred<ReturnType<typeof comparisonResponse>>();
    const comparisonTwoRequest =
      deferred<ReturnType<typeof comparisonResponse>>();
    const comparisonTwo = {
      ...comparisonOne,
      id: "comparison-2",
      client: "Current comparison",
    } satisfies ComparativaVM;
    const staleComparisonOne = {
      ...comparisonOne,
      client: "Stale comparison",
    } satisfies ComparativaVM;
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(comparisonOneRequest.promise)
      .mockReturnValueOnce(comparisonTwoRequest.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(() =>
      useComparativaDetails({ userData }),
    );
    expect(fetchMock).toHaveBeenCalledOnce();

    mocks.comparisonId = "comparison-2";
    rerender();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/v2/comparisons/comparison-2",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.current.loading).toBe(true);
    expect(result.current.loadedData).toBe(false);
    expect(result.current.comparativa).toBeNull();

    await act(async () => {
      comparisonTwoRequest.resolve(comparisonResponse(comparisonTwo));
      await comparisonTwoRequest.promise;
    });

    await waitFor(() => {
      expect(result.current.comparativa).toEqual(comparisonTwo);
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.loadedData).toBe(true);

    await act(async () => {
      comparisonOneRequest.resolve(
        comparisonResponse(staleComparisonOne),
      );
      await comparisonOneRequest.promise;
    });

    expect(result.current.comparativa).toEqual(comparisonTwo);
    expect(result.current.loading).toBe(false);
    expect(result.current.loadedData).toBe(true);
    expect(showCustomToast).not.toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  test("preserves a pending commission lock across a same-id refresh", async () => {
    const mutationRequest = deferred<ReturnType<typeof mutationResponse>>();
    const backgroundRequest =
      deferred<ReturnType<typeof comparisonResponse>>();
    const refreshedComparison = {
      ...comparisonOne,
      comision: { fijo: 121, indexado: 80 },
    } satisfies ComparativaVM;
    const committedComparison = {
      ...comparisonOne,
      comision: { fijo: 125, indexado: 80 },
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

          if (comparisonFetchCount === 1) {
            return Promise.resolve(comparisonResponse(comparisonOne));
          }
          if (comparisonFetchCount === 2) {
            return backgroundRequest.promise;
          }
          if (comparisonFetchCount === 3) {
            return Promise.resolve(
              comparisonResponse(committedComparison),
            );
          }
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
    expect(screen.getByText("121,00 €")).toBeVisible();
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
      expect(screen.getByText("125,00 €")).toBeVisible();
    });
    expect(screen.getByRole("button", { name: "Editar" })).toBeEnabled();
    expect(showCustomToast).not.toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.filter(
        ([, init]) => init?.method === "POST",
      ),
    ).toHaveLength(3);
  });
});
