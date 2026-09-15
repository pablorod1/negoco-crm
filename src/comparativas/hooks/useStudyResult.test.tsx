import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { StrictMode } from "react";
import { useStudyResult } from "./useStudyResult";
import type { StudyResultDecision, StudyResultDTO } from "../types/study-result.types";

const pending = (overrides: Partial<StudyResultDTO> = {}): StudyResultDTO => ({
  id: "r1", state: "pending", receivedType: null, chosenType: null, typeOrigin: null, targetPlan: null, plans: ["fijo"], revision: "v1", pendingSteps: ["type"], hasExistingCommissions: false, offerAvailable: true, salesCalculable: true, current: null, proposed: null,
  capabilities: { canResolve: true, canChooseType: true, canManualSales: true, commissionDecisions: ["keep", "apply", "manual"] }, resolution: null, ...overrides,
});
const response = (data: StudyResultDTO | null, comparisonStatus = "awaiting_review") => new Response(JSON.stringify({ success: true, data, comparisonStatus }), { status: 200 });
const decision: StudyResultDecision = { resultId: "r1", revision: "v1", chosenType: "fijo", planDecision: "none", commissionDecision: "apply" };
const fetchMock = vi.fn<typeof fetch>();
const refresh = vi.fn();
const setup = (comparisonStatus = "processing") => renderHook(() => useStudyResult({ comparisonId: "c1", comparisonStatus, enabled: true, onRefresh: refresh }));
const tick = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const deferred = () => {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
};

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("persistent study result controller", () => {
  test.each(["applied", "resolved"] as const)("first read of a %s result refreshes stale processing details once and stops polling", async (state) => {
    fetchMock.mockImplementation(async () => response(pending({ state })));
    const { result, rerender } = renderHook(({ comparisonStatus }) => useStudyResult({ comparisonId: "c1", comparisonStatus, enabled: true, onRefresh: refresh }), { initialProps: { comparisonStatus: "processing" } });
    await tick();
    expect(refresh).toHaveBeenCalledOnce();
    expect(result.current.open).toBe(false);
    expect(result.current.draft).toBeNull();
    rerender({ comparisonStatus: "awaiting_review" });
    await tick(20000);
    expect(refresh).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test("first pending result refreshes even with matching detail status, without opening or repeated refresh", async () => {
    fetchMock.mockImplementation(async () => response(pending()));
    const { result } = setup("awaiting_review");
    await tick();
    expect(refresh).toHaveBeenCalledOnce();
    expect(result.current.canReview).toBe(true);
    expect(result.current.open).toBe(false);
    expect(result.current.draft).toBeNull();
    await tick(15000);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(refresh).toHaveBeenCalledOnce();
    expect(result.current.open).toBe(false);
  });

  test.each(["pending", "processing"])("first empty result refreshes only a status gap from %s", async (comparisonStatus) => {
    fetchMock.mockImplementation(async () => response(null, "processing"));
    setup(comparisonStatus);
    await tick();
    expect(refresh).toHaveBeenCalledTimes(comparisonStatus === "pending" ? 1 : 0);
    await tick(10000);
    expect(refresh).toHaveBeenCalledTimes(comparisonStatus === "pending" ? 1 : 0);
  });

  test("a persisted result arriving without a local watch refreshes details without auto-opening", async () => {
    let data: StudyResultDTO | null = null;
    fetchMock.mockImplementation(async () => response(data));
    const { result } = setup("awaiting_review");
    await tick();
    expect(refresh).not.toHaveBeenCalled();
    data = pending();
    await tick(5000);
    expect(refresh).toHaveBeenCalledOnce();
    expect(result.current.open).toBe(false);
    expect(result.current.draft).toBeNull();
    await tick(10000);
    expect(refresh).toHaveBeenCalledOnce();
  });

  test.each([null, pending({ state: "applied" }), pending({ state: "resolved" })])("does not open historical, applied or resolved data", async (data) => {
    fetchMock.mockImplementation(async () => response(data, "completed"));
    const { result } = setup();
    await tick();
    expect(result.current.open).toBe(false);
    expect(result.current.canReview).toBeFalsy();
    await tick(20000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("old pending result offers review without automatically opening; cancellation never PATCHes and reopens", async () => {
    fetchMock.mockImplementation(async () => response(pending()));
    const { result } = setup();
    await tick();
    expect(result.current.canReview).toBe(true);
    expect(result.current.open).toBe(false);
    await act(async () => result.current.review());
    expect(result.current.open).toBe(true);
    act(() => result.current.close());
    expect(result.current.open).toBe(false);
    await act(async () => result.current.review());
    expect(result.current.draft?.revision).toBe("v1");
    expect(fetchMock.mock.calls.every(([, init]) => init?.method !== "PATCH")).toBe(true);
  });

  test("closing the panel early still watches a late callback and automatically opens once", async () => {
    let data: StudyResultDTO | null = null;
    fetchMock.mockImplementation(async () => response(data, data ? "awaiting_review" : "processing"));
    const { result } = setup();
    await tick();
    act(() => { result.current.startWatching(); result.current.setPanelOpen(true); });
    await tick();
    act(() => result.current.setPanelOpen(false));
    await tick();
    data = pending();
    await tick(5000);
    expect(result.current.open).toBe(true);
    expect(result.current.panelOpen).toBe(false);
    expect(refresh).toHaveBeenCalledTimes(1);
    act(() => result.current.close());
    await tick(15000);
    expect(result.current.open).toBe(false);
    expect(result.current.canReview).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test("a new automatically applied study refreshes and never opens a dialog", async () => {
    let data: StudyResultDTO | null = null;
    fetchMock.mockImplementation(async () => response(data, "processing"));
    const { result } = setup();
    await tick();
    act(() => result.current.startWatching());
    await tick();
    data = pending({ state: "applied" });
    await tick(5000);
    expect(result.current.open).toBe(false);
    expect(refresh).toHaveBeenCalledOnce();
  });

  test("new pending receipt closes an open panel before displaying review", async () => {
    let data: StudyResultDTO | null = null;
    fetchMock.mockImplementation(async () => response(data, data ? "awaiting_review" : "processing"));
    const { result } = setup();
    await tick();
    act(() => { result.current.startWatching(); result.current.setPanelOpen(true); });
    await tick();
    expect(result.current.panelOpen).toBe(true);
    data = pending();
    await tick(5000);
    expect(result.current.panelOpen).toBe(false);
    expect(result.current.open).toBe(true);
  });

  test("cancelling an in-flight preview cannot reopen the dialog or restore its draft", async () => {
    fetchMock.mockImplementationOnce(async () => response(pending()));
    const { result } = setup();
    await tick();
    const preview = deferred();
    fetchMock.mockReturnValueOnce(preview.promise);
    act(() => result.current.review());
    act(() => result.current.close());
    await act(async () => preview.resolve(response(pending({ targetPlan: "fijo" }))));
    expect(result.current.open).toBe(false);
    expect(result.current.draft).toBeNull();
    expect(fetchMock.mock.calls.every(([, init]) => init?.method !== "PATCH")).toBe(true);
  });

  test("only one status request is in flight despite repeated starts/closes", async () => {
    const request = deferred();
    fetchMock.mockReturnValue(request.promise);
    const { result } = setup();
    act(() => { result.current.startWatching(); result.current.startWatching(); result.current.setPanelOpen(false); });
    await tick(30000);
    expect(fetchMock).toHaveBeenCalledOnce();
    await act(async () => request.resolve(response(null, "processing")));
    fetchMock.mockImplementation(async () => response(null, "processing"));
    await tick(5000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("background polling never silently changes the reviewed revision or amounts", async () => {
    let data = pending({ targetPlan: "fijo", proposed: { sales: 10 } });
    fetchMock.mockImplementation(async () => response(data));
    const { result } = setup();
    await tick();
    await act(async () => result.current.review());
    data = pending({ revision: "v2", targetPlan: "fijo", proposed: { sales: 900 } });
    await tick(5000);
    expect(result.current.result?.revision).toBe("v2");
    expect(result.current.draft?.revision).toBe("v1");
    expect(result.current.draft?.proposed?.sales).toBe(10);
  });

  test("409 reloads selected plan and requires new review without resubmission", async () => {
    fetchMock.mockImplementation(async () => response(pending()));
    const { result } = setup();
    await tick();
    await act(async () => result.current.review());
    fetchMock.mockImplementation(async (_url, init) => init?.method === "PATCH" ? new Response("conflict", { status: 409 }) : response(pending({ revision: "v2", targetPlan: "fijo" })));
    await act(async () => result.current.submit(decision));
    expect(result.current.changed).toBe(true);
    expect(result.current.draft?.revision).toBe("v2");
    expect(fetchMock).toHaveBeenLastCalledWith("/api/v2/comparisons/c1/study-result?plan=fijo", expect.anything());
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(1);
  });

  test("out-of-order type preview is ignored, including servers that ignore abort", async () => {
    fetchMock.mockImplementation(async () => response(pending()));
    const { result } = setup();
    await tick();
    const first = deferred();
    const second = deferred();
    fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    act(() => { void result.current.preview("fijo"); void result.current.preview("indexado"); });
    await act(async () => second.resolve(response(pending({ targetPlan: "indexado", revision: "indexado" }))));
    await act(async () => first.resolve(response(pending({ targetPlan: "fijo", revision: "fijo" }))));
    expect(result.current.draft?.targetPlan).toBe("indexado");
  });

  test("another tab resolving closes the stale draft and refreshes once", async () => {
    let data = pending();
    fetchMock.mockImplementation(async () => response(data));
    const { result } = setup();
    await tick();
    expect(refresh).toHaveBeenCalledOnce();
    refresh.mockClear();
    await act(async () => result.current.review());
    data = pending({ state: "resolved" });
    await tick(5000);
    expect(result.current.open).toBe(false);
    expect(result.current.draft).toBeNull();
    expect(refresh).toHaveBeenCalledOnce();
    await tick(10000);
    expect(refresh).toHaveBeenCalledOnce();
  });

  test("double confirm is suppressed and a network retry preserves the exact body", async () => {
    fetchMock.mockImplementation(async () => response(pending()));
    const { result } = setup();
    await tick();
    const submitRequest = deferred();
    fetchMock.mockReturnValueOnce(submitRequest.promise);
    act(() => { void result.current.submit(decision); void result.current.submit(decision); });
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(1);
    await act(async () => submitRequest.resolve(new Response("failure", { status: 502 })));
    fetchMock.mockImplementation(async () => response(pending({ state: "resolved" })));
    await act(async () => result.current.submit(decision));
    const writes = fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");
    expect(writes).toHaveLength(2);
    expect(writes[0][1]?.body).toBe(writes[1][1]?.body);
  });

  test.each([401, 403])("permission %s clears financial data and stops retries", async (status) => {
    fetchMock.mockImplementation(async () => response(pending()));
    const { result } = setup();
    await tick();
    await act(async () => result.current.review());
    fetchMock.mockResolvedValue(new Response("denied", { status }));
    await tick(5000);
    expect(result.current.result).toBeNull();
    expect(result.current.draft).toBeNull();
    expect(result.current.open).toBe(false);
    const count = fetchMock.mock.calls.length;
    await tick(120000);
    expect(fetchMock).toHaveBeenCalledTimes(count);
  });

  test("unmount aborts requests and suppresses late refreshes from former identity", async () => {
    const request = deferred();
    fetchMock.mockReturnValueOnce(request.promise);
    const { unmount } = setup();
    unmount();
    expect((fetchMock.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(true);
    await act(async () => request.resolve(response(pending())));
    expect(refresh).not.toHaveBeenCalled();
    await tick(10000);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test("no financial requests are made without effective permission", async () => {
    renderHook(() => useStudyResult({ comparisonId: "c1", comparisonStatus: "processing", enabled: false, onRefresh: refresh }));
    await tick(15000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("StrictMode cleanup leaves only one live polling loop", async () => {
    fetchMock.mockImplementation(async () => response(null, "processing"));
    renderHook(() => useStudyResult({ comparisonId: "c1", comparisonStatus: "processing", enabled: true, onRefresh: refresh }), { wrapper: StrictMode });
    await tick();
    const count = fetchMock.mock.calls.length;
    await tick(10000);
    expect(fetchMock).toHaveBeenCalledTimes(count + 2);
  });

  test.each(["route", "user", "role", "permission"])("keyed controller clears state immediately on %s change and rejects old response", async (change) => {
    function Probe({ id, enabled }: { id: string; enabled: boolean }) {
      const controller = useStudyResult({ comparisonId: id, comparisonStatus: "awaiting_review", enabled, onRefresh: refresh });
      return <><button onClick={controller.review}>review</button><span data-testid="amount">{controller.draft?.proposed?.sales ?? "empty"}</span></>;
    }
    const old = deferred();
    fetchMock.mockImplementationOnce(async () => response(pending())).mockReturnValueOnce(old.promise).mockImplementation(async () => response(null));
    const { rerender } = render(<Probe key="c1:u1:admin:true" id="c1" enabled />);
    await tick();
    expect(refresh).toHaveBeenCalledOnce();
    refresh.mockClear();
    fireEvent.click(screen.getByText("review"));
    rerender(<Probe key={`new-${change}`} id={change === "route" ? "c2" : "c1"} enabled={change !== "permission"} />);
    expect(screen.getByTestId("amount")).toHaveTextContent("empty");
    await act(async () => old.resolve(response(pending({ proposed: { sales: 999, agency: 888 } }))));
    expect(screen.getByTestId("amount")).toHaveTextContent("empty");
    expect(refresh).not.toHaveBeenCalled();
    if (change === "permission") {
      rerender(<Probe key="permission-granted-again" id="c1" enabled />);
      await tick();
      expect(screen.getByTestId("amount")).toHaveTextContent("empty");
    }
  });
});
