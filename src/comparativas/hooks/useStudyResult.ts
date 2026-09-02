"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StudyPlan, StudyResultDecision, StudyResultDTO, StudyResultResponse } from "@/comparativas/types/study-result.types";

interface Options {
  comparisonId: string;
  comparisonStatus: string;
  enabled: boolean;
  onRefresh: () => void;
}

/** Mount under a comparison/user/role key: no financial state survives an identity change. */
export function useStudyResult({ comparisonId, comparisonStatus, enabled, onRefresh }: Options) {
  const [result, setResult] = useState<StudyResultDTO | null>(null);
  const [draft, setDraft] = useState<StudyResultDTO | null>(null);
  const [open, setOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const [denied, setDenied] = useState(false);
  const refresh = useRef(onRefresh);
  useEffect(() => { refresh.current = onRefresh; }, [onRefresh]);
  const alive = useRef(false);
  const blocked = useRef(false);
  const latest = useRef<StudyResultDTO | null>(null);
  const watch = useRef<{ previousId: string | null } | null>(null);
  // The first result read can already be newer than the detail that mounted us.
  const lastStatus = useRef(comparisonStatus);
  const controllers = useRef(new Set<AbortController>());
  const previewRequest = useRef<AbortController | null>(null);
  const pollingRequest = useRef<AbortController | null>(null);
  const submitLock = useRef(false);
  const checkNow = useRef<(() => void) | null>(null);

  const deny = useCallback(() => {
    blocked.current = true;
    controllers.current.forEach((controller) => controller.abort());
    latest.current = null;
    setResult(null);
    setDraft(null);
    setOpen(false);
    setPanelOpen(false);
    setDenied(true);
    setError("Ya no tienes permiso para revisar este resultado.");
  }, []);

  const receive = useCallback((response: StudyResultResponse, autoOpen: boolean) => {
    const next = response.data;
    const previous = latest.current;
    const transitioned = previous?.id === next?.id && previous?.state === "pending" && next?.state !== "pending";
    const receivedResult = next && next.id !== previous?.id;
    const newResult = watch.current && next && next.id !== watch.current.previousId;
    const statusChanged = lastStatus.current !== response.comparisonStatus;
    lastStatus.current = response.comparisonStatus;
    latest.current = next;
    setResult(next);
    if (transitioned || statusChanged || receivedResult) refresh.current();
    if (next?.state !== "pending" || !next.capabilities.canResolve) {
      setOpen(false);
      setDraft(null);
    }
    if (newResult) {
      watch.current = null;
      setPanelOpen(false);
      if (autoOpen && next.state === "pending" && next.capabilities.canResolve) {
        setDraft(next);
        setChanged(false);
        setOpen(true);
      }
    }
  }, []);

  const requestPreview = useCallback(async (plan?: StudyPlan, conflict = false) => {
    if (!alive.current || blocked.current || !enabled) return;
    previewRequest.current?.abort();
    pollingRequest.current?.abort();
    const controller = new AbortController();
    previewRequest.current = controller;
    controllers.current.add(controller);
    setLoading(true);
    setDraft(null);
    setError(null);
    setChanged(conflict);
    try {
      const response = await fetch(`/api/v2/comparisons/${comparisonId}/study-result${plan ? `?plan=${plan}` : ""}`, { signal: controller.signal, cache: "no-store" });
      if (controller.signal.aborted || !alive.current) return;
      if (response.status === 401 || response.status === 403) { deny(); return; }
      if (!response.ok) throw new Error("preview");
      const body: StudyResultResponse = await response.json();
      if (controller.signal.aborted || !alive.current) return;
      receive(body, false);
      if (body.data?.state === "pending" && body.data.capabilities.canResolve) setDraft(body.data);
    } catch {
      if (!controller.signal.aborted && alive.current) setError("No se pudo cargar el resultado. Vuelve a intentarlo.");
    } finally {
      controllers.current.delete(controller);
      if (previewRequest.current === controller) {
        previewRequest.current = null;
        if (alive.current) setLoading(false);
      }
    }
  }, [comparisonId, deny, enabled, receive]);

  useEffect(() => {
    alive.current = true;
    if (!enabled) return () => { alive.current = false; };
    let disposed = false;
    let terminal = false;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    const poll = async () => {
      if (disposed || !alive.current || blocked.current) return;
      if (previewRequest.current || submitLock.current || pollingRequest.current) {
        timer = setTimeout(poll, 5000);
        return;
      }
      const controller = new AbortController();
      pollingRequest.current = controller;
      controllers.current.add(controller);
      try {
        const response = await fetch(`/api/v2/comparisons/${comparisonId}/study-result`, { signal: controller.signal, cache: "no-store" });
        if (controller.signal.aborted || !alive.current) return;
        if (response.status === 401 || response.status === 403) { deny(); return; }
        if (!response.ok) throw new Error("poll");
        const body: StudyResultResponse = await response.json();
        if (controller.signal.aborted || !alive.current) return;
        receive(body, true);
        terminal = body.data?.state === "applied" || body.data?.state === "resolved" || (!["pending", "processing", "awaiting_review"].includes(body.comparisonStatus) && body.data?.state !== "pending");
        // Background reads update availability, never the revision being reviewed.
        if (failures > 0) setError(null);
        failures = 0;
      } catch {
        if (!controller.signal.aborted && alive.current) {
          failures++;
          setError("No se pudo comprobar el estudio. Se volverá a intentar automáticamente.");
        }
      } finally {
        controllers.current.delete(controller);
        if (pollingRequest.current === controller) pollingRequest.current = null;
        if (!disposed && alive.current && !blocked.current && !terminal) timer = setTimeout(poll, Math.min(5000 * 2 ** failures, 60000));
      }
    };
    checkNow.current = () => {
      if (pollingRequest.current || previewRequest.current || submitLock.current) return;
      clearTimeout(timer);
      void poll();
    };
    void poll();
    const activeControllers = controllers.current;
    return () => {
      alive.current = false;
      disposed = true;
      checkNow.current = null;
      clearTimeout(timer);
      activeControllers.forEach((controller) => controller.abort());
    };
  }, [comparisonId, deny, enabled, receive]);

  const submit = useCallback(async (decision: StudyResultDecision) => {
    if (submitLock.current || blocked.current || !alive.current || !enabled) return;
    submitLock.current = true;
    setSubmitting(true);
    setError(null);
    pollingRequest.current?.abort();
    const controller = new AbortController();
    controllers.current.add(controller);
    try {
      const response = await fetch(`/api/v2/comparisons/${comparisonId}/study-result`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(decision), signal: controller.signal,
      });
      if (controller.signal.aborted || !alive.current) return;
      if (response.status === 401 || response.status === 403) { deny(); return; }
      if (response.status === 409) {
        await requestPreview(decision.chosenType, true);
        return;
      }
      if (!response.ok) throw new Error("submit");
      const body: StudyResultResponse = await response.json();
      if (controller.signal.aborted || !alive.current) return;
      receive(body, false);
      setOpen(false);
      setDraft(null);
    } catch {
      if (!controller.signal.aborted && alive.current) setError("No se pudo guardar la decisión. Puedes reintentar la misma confirmación.");
    } finally {
      controllers.current.delete(controller);
      submitLock.current = false;
      if (alive.current) setSubmitting(false);
    }
  }, [comparisonId, deny, enabled, receive, requestPreview]);

  return {
    result: enabled && !denied ? result : null, draft: enabled && !denied ? draft : null,
    open: open && enabled && !denied, panelOpen,
    setPanelOpen: (value: boolean) => { setPanelOpen(value); if (!value) checkNow.current?.(); },
    loading, submitting, error, changed,
    canReview: enabled && !denied && result?.state === "pending" && result.capabilities.canResolve,
    startWatching: () => { watch.current = { previousId: latest.current?.id ?? null }; checkNow.current?.(); },
    review: () => { setPanelOpen(false); setOpen(true); void requestPreview(); },
    close: () => { if (!submitLock.current) { previewRequest.current?.abort(); setOpen(false); setDraft(null); } },
    preview: requestPreview, submit,
  };
}
