"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/core/contexts/UserContext";
import { Button } from "@/core/components/ui/button";
import { Badge } from "@/core/components/ui/badge";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Textarea } from "@/core/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/core/components/ui/dialog";
import { ScrollArea } from "@/core/components/ui/scroll-area";
import { Skeleton } from "@/core/components/ui/skeleton";
import LoaderComponent from "@/core/components/LoaderComponent";
import { showCustomToast } from "@/core/components/CustomToast";
import { cn } from "@/core/utils";
import { formatForumRelativeTime } from "@/forum/utils";
import type {
  ApiResponse,
  ForumComment,
  ForumTopic,
  ForumTopicDetail,
  ForumTopicStatus,
} from "@/forum/types";
import { ForumCommentList } from "./ForumCommentList";
import { ForumComposer } from "./ForumComposer";
import {
  ChevronLeft,
  CircleCheck,
  CircleX,
  Loader2,
  Lock,
  MessageSquareText,
  MessagesSquare,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  Unlock,
  X,
} from "lucide-react";

type StatusFilter = "all" | ForumTopicStatus;

const getTopicStatusLabel = (status: ForumTopicStatus) =>
  status === "open" ? "Abierto" : "Cerrado";

const fetchForumTopics = async () => {
  const response = await fetch("/api/v2/forum/topics");
  const result = (await response.json()) as ApiResponse<ForumTopic[]>;
  if (!result.success || !result.data) {
    throw new Error(result.error || "Error al cargar el foro");
  }
  return result.data;
};

const fetchForumTopicDetail = async (topicId: string) => {
  const response = await fetch(`/api/v2/forum/topics/${topicId}`);
  const result = (await response.json()) as ApiResponse<ForumTopicDetail>;
  if (!result.success || !result.data) {
    throw new Error(result.error || "Error al cargar el debate");
  }
  return result.data;
};

const getNextSelectedTopicId = (
  forumTopics: ForumTopic[],
  currentTopicId: string | null,
) =>
  currentTopicId && forumTopics.some((topic) => topic.id === currentTopicId)
    ? currentTopicId
    : forumTopics[0]?.id ?? null;

const scrollCommentsToBottom = (
  scrollRoot: HTMLDivElement | null,
  smooth = false,
) => {
  const viewport = scrollRoot?.querySelector<HTMLElement>(
    "[data-radix-scroll-area-viewport]",
  );
  if (!viewport) {
    return;
  }
  viewport.scrollTo({
    top: viewport.scrollHeight,
    behavior: smooth ? "smooth" : "auto",
  });
};

export default function ForumPageClient() {
  const { userData } = useUser();
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ForumTopicDetail | null>(null);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [commentMessage, setCommentMessage] = useState("");
  const [commentSending, setCommentSending] = useState(false);
  const [topicDialogOpen, setTopicDialogOpen] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicDescription, setNewTopicDescription] = useState("");
  const [topicSaving, setTopicSaving] = useState(false);
  const [topicUpdating, setTopicUpdating] = useState(false);
  const [updatingCommentId, setUpdatingCommentId] = useState<string | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  const scrollRootRef = useRef<HTMLDivElement>(null);

  const isDireccion = userData?.role === "admin";

  const counts = useMemo(
    () => ({
      all: topics.length,
      open: topics.filter((topic) => topic.status === "open").length,
      closed: topics.filter((topic) => topic.status === "closed").length,
    }),
    [topics],
  );

  const filteredTopics = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return topics.filter((topic) => {
      if (statusFilter !== "all" && topic.status !== statusFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        topic.title.toLowerCase().includes(query) ||
        (topic.description?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [topics, searchQuery, statusFilter]);

  useEffect(() => {
    let ignoreResult = false;

    const loadInitialTopics = async () => {
      try {
        if (ignoreResult) {
          return;
        }
        const forumTopics = await fetchForumTopics();
        if (!ignoreResult) {
          const nextSelectedTopicId = getNextSelectedTopicId(forumTopics, null);
          setTopics(forumTopics);
          if (nextSelectedTopicId) {
            setDetailLoading(true);
          }
          setSelectedTopicId(nextSelectedTopicId);
        }
      } catch (error) {
        if (ignoreResult) {
          return;
        }
        showCustomToast({
          title: "Error al cargar el foro",
          message:
            error instanceof Error
              ? error.message
              : "Inténtalo de nuevo más tarde",
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
      } finally {
        if (!ignoreResult) {
          setTopicsLoading(false);
        }
      }
    };

    void loadInitialTopics();

    return () => {
      ignoreResult = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedTopicId) {
      return;
    }

    let ignoreResult = false;

    const loadTopicDetail = async () => {
      try {
        if (ignoreResult) {
          return;
        }
        const topicDetail = await fetchForumTopicDetail(selectedTopicId);
        if (!ignoreResult) {
          setDetail(topicDetail);
        }
      } catch (error) {
        if (ignoreResult) {
          return;
        }
        showCustomToast({
          title: "Error al cargar el debate",
          message:
            error instanceof Error
              ? error.message
              : "Inténtalo de nuevo más tarde",
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        setDetail(null);
      } finally {
        if (!ignoreResult) {
          setDetailLoading(false);
        }
      }
    };

    void loadTopicDetail();

    return () => {
      ignoreResult = true;
    };
  }, [selectedTopicId]);

  const activeTopicId = detail?.topic.id;
  const commentCount = detail?.comments.length ?? 0;
  useEffect(() => {
    if (!activeTopicId) {
      return;
    }
    const frame = requestAnimationFrame(() =>
      scrollCommentsToBottom(scrollRootRef.current),
    );
    return () => cancelAnimationFrame(frame);
  }, [activeTopicId, commentCount]);

  const resetTopicDialog = () => {
    setNewTopicTitle("");
    setNewTopicDescription("");
  };

  const handleRefreshTopics = async () => {
    setTopicsLoading(true);
    try {
      const forumTopics = await fetchForumTopics();
      const nextSelectedTopicId = getNextSelectedTopicId(
        forumTopics,
        selectedTopicId,
      );
      setTopics(forumTopics);

      if (nextSelectedTopicId !== selectedTopicId) {
        if (nextSelectedTopicId) {
          setDetailLoading(true);
        } else {
          setDetail(null);
          setDetailLoading(false);
        }
        setSelectedTopicId(nextSelectedTopicId);
      }
    } catch (error) {
      showCustomToast({
        title: "Error al cargar el foro",
        message:
          error instanceof Error ? error.message : "Inténtalo de nuevo más tarde",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    } finally {
      setTopicsLoading(false);
    }
  };

  const handleSelectTopic = (topicId: string) => {
    if (topicId !== selectedTopicId) {
      setDetailLoading(true);
      setSelectedTopicId(topicId);
    }
    setMobileView("detail");
  };

  const handleCreateTopic = async () => {
    if (!newTopicTitle.trim()) {
      showCustomToast({
        title: "Título obligatorio",
        message: "Añade un título para crear el debate",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
      return;
    }

    setTopicSaving(true);
    try {
      const response = await fetch("/api/v2/forum/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTopicTitle,
          description: newTopicDescription,
        }),
      });
      const result = (await response.json()) as ApiResponse<ForumTopic>;
      if (!result.success || !result.data) {
        throw new Error(result.error || "Error al crear el debate");
      }

      setTopics((current) => [result.data!, ...current]);
      setDetailLoading(true);
      setSelectedTopicId(result.data.id);
      setMobileView("detail");
      resetTopicDialog();
      setTopicDialogOpen(false);
      showCustomToast({
        title: "Debate creado",
        message: "El tema ya está disponible para comentar",
        icon: CircleCheck,
        iconColor: "var(--success-color)",
        iconSize: 24,
      });
    } catch (error) {
      showCustomToast({
        title: "Error al crear el debate",
        message:
          error instanceof Error ? error.message : "Inténtalo de nuevo más tarde",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    } finally {
      setTopicSaving(false);
    }
  };

  const handleToggleTopicStatus = async () => {
    if (!detail) return;

    const nextStatus = detail.topic.status === "open" ? "closed" : "open";
    setTopicUpdating(true);
    try {
      const response = await fetch(`/api/v2/forum/topics/${detail.topic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = (await response.json()) as ApiResponse<ForumTopicDetail>;
      if (!result.success || !result.data) {
        throw new Error(result.error || "Error al actualizar el debate");
      }

      setDetail(result.data);
      setTopics((current) =>
        current.map((topic) =>
          topic.id === result.data!.topic.id ? result.data!.topic : topic,
        ),
      );
    } catch (error) {
      showCustomToast({
        title: "Error al actualizar el debate",
        message:
          error instanceof Error ? error.message : "Inténtalo de nuevo más tarde",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    } finally {
      setTopicUpdating(false);
    }
  };

  const handleSendComment = async () => {
    if (!detail || !commentMessage.trim()) return;

    setCommentSending(true);
    try {
      const response = await fetch(
        `/api/v2/forum/topics/${detail.topic.id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: commentMessage }),
        },
      );
      const result = (await response.json()) as ApiResponse<ForumComment>;
      if (!result.success || !result.data) {
        throw new Error(result.error || "Error al publicar el comentario");
      }

      setDetail((current) =>
        current
          ? {
            ...current,
            comments: [...current.comments, result.data!],
            topic: {
              ...current.topic,
              comments_count: current.topic.comments_count + 1,
            },
          }
          : current,
      );
      setTopics((current) =>
        current.map((topic) =>
          topic.id === detail.topic.id
            ? { ...topic, comments_count: topic.comments_count + 1 }
            : topic,
        ),
      );
      setCommentMessage("");
      requestAnimationFrame(() =>
        scrollCommentsToBottom(scrollRootRef.current, true),
      );
    } catch (error) {
      showCustomToast({
        title: "Error al publicar",
        message:
          error instanceof Error ? error.message : "Inténtalo de nuevo más tarde",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    } finally {
      setCommentSending(false);
    }
  };

  const handleToggleCommentHidden = async (comment: ForumComment) => {
    setUpdatingCommentId(comment.id);
    try {
      const response = await fetch(
        `/api/v2/forum/topics/${comment.topic_id}/comments/${comment.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_hidden: !comment.is_hidden }),
        },
      );
      const result = (await response.json()) as ApiResponse<ForumComment>;
      if (!result.success || !result.data) {
        throw new Error(result.error || "Error al actualizar el comentario");
      }

      setDetail((current) =>
        current
          ? {
            ...current,
            comments: current.comments.map((item) =>
              item.id === result.data!.id ? result.data! : item,
            ),
          }
          : current,
      );
    } catch (error) {
      showCustomToast({
        title: "Error al moderar",
        message:
          error instanceof Error ? error.message : "Inténtalo de nuevo más tarde",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    } finally {
      setUpdatingCommentId(null);
    }
  };

  if (!userData) {
    return <LoaderComponent title="Cargando foro..." />;
  }

  const statusFilters: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "Todos", count: counts.all },
    { key: "open", label: "Abiertos", count: counts.open },
    { key: "closed", label: "Cerrados", count: counts.closed },
  ];

  const hasActiveFilters = Boolean(searchQuery.trim()) || statusFilter !== "all";

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              Foro
            </h1>
            <p className="text-sm text-gray-500">
              Debates internos por tema. Tu identidad se muestra de forma
              anónima al resto del equipo.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefreshTopics}
            disabled={topicsLoading}
          >
            <RefreshCw className={cn("size-4", topicsLoading && "animate-spin")} />
            Actualizar
          </Button>
          {isDireccion ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setTopicDialogOpen(true)}
            >
              <Plus className="size-4" />
              Nuevo tema
            </Button>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 xl:h-[calc(100vh-13rem)] xl:min-h-[600px] xl:grid-cols-[370px_minmax(0,1fr)]">
        {/* Lista de temas */}
        <aside
          className={cn(
            "flex min-h-[480px] flex-col overflow-hidden rounded-4xl border border-gray-200 bg-white shadow-xs xl:min-h-0",
            mobileView === "detail" ? "hidden xl:flex" : "flex",
          )}
        >
          <div className="shrink-0 space-y-3 border-b border-gray-100 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar temas…"
                className="h-9 pl-9 pr-9"
                aria-label="Buscar temas"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-1 rounded-full bg-gray-100 p-1">
              {statusFilters.map((filter) => {
                const isActive = statusFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setStatusFilter(filter.key)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium transition-colors",
                      isActive
                        ? "bg-white text-primary-700 shadow-sm"
                        : "text-gray-500 hover:text-gray-800",
                    )}
                  >
                    {filter.label}
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-[10px] tabular-nums",
                        isActive
                          ? "bg-primary-50 text-primary-700"
                          : "bg-gray-200/70 text-gray-500",
                      )}
                    >
                      {filter.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-1.5 p-3">
              {topicsLoading ? (
                <>
                  <Skeleton className="h-[88px] w-full rounded-2xl" />
                  <Skeleton className="h-[88px] w-full rounded-2xl" />
                  <Skeleton className="h-[88px] w-full rounded-2xl" />
                </>
              ) : filteredTopics.length === 0 ? (
                <div className="flex flex-col items-center px-4 py-12 text-center">
                  <Search className="size-8 text-gray-300" />
                  <p className="mt-3 text-sm font-medium text-gray-700">
                    {hasActiveFilters
                      ? "Sin resultados"
                      : "No hay temas publicados"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {hasActiveFilters
                      ? "Prueba con otra búsqueda o filtro."
                      : isDireccion
                        ? "Crea el primer debate para el equipo."
                        : "Vuelve más tarde para participar."}
                  </p>
                  {hasActiveFilters ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        setSearchQuery("");
                        setStatusFilter("all");
                      }}
                    >
                      Limpiar filtros
                    </Button>
                  ) : null}
                </div>
              ) : (
                filteredTopics.map((topic) => {
                  const isActive = topic.id === selectedTopicId;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => handleSelectTopic(topic.id)}
                      className={cn(
                        "w-full rounded-2xl border px-3.5 py-3 text-left transition-all",
                        isActive
                          ? "border-primary-200 bg-primary-50/60 shadow-xs"
                          : "border-transparent hover:border-gray-200 hover:bg-gray-50",
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className={cn(
                            "mt-1.5 size-2 shrink-0 rounded-full",
                            topic.status === "open"
                              ? "bg-success-500"
                              : "bg-gray-300",
                          )}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">
                            {topic.title}
                          </h3>
                          {topic.description ? (
                            <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">
                              {topic.description}
                            </p>
                          ) : null}
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-400">
                            <span className="inline-flex items-center gap-1">
                              <MessageSquareText className="size-3.5" />
                              {topic.comments_count}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{formatForumRelativeTime(topic.updated_at)}</span>
                            {isDireccion && topic.hidden_comments_count ? (
                              <Badge variant="warning" className="ml-auto">
                                {topic.hidden_comments_count} ocultos
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* Detalle del debate */}
        <section
          className={cn(
            "flex min-h-[480px] flex-col overflow-hidden rounded-4xl border border-gray-200 bg-white shadow-xs xl:min-h-0",
            mobileView === "list" ? "hidden xl:flex" : "flex",
          )}
        >
          {detailLoading ? (
            <div className="space-y-4 p-6">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-8 w-2/3 rounded-full" />
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-4/5 rounded-2xl" />
            </div>
          ) : detail ? (
            <>
              <div className="shrink-0 border-b border-gray-100 px-5 py-4 sm:px-6">
                <button
                  type="button"
                  onClick={() => setMobileView("list")}
                  className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 xl:hidden"
                >
                  <ChevronLeft className="size-4" />
                  Temas
                </button>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          detail.topic.status === "open" ? "success" : "default"
                        }
                      >
                        {getTopicStatusLabel(detail.topic.status)}
                      </Badge>
                      {isDireccion && detail.topic.hidden_comments_count ? (
                        <Badge variant="warning">
                          {detail.topic.hidden_comments_count} ocultos
                        </Badge>
                      ) : null}
                    </div>
                    <h2 className="text-lg font-semibold tracking-tight text-gray-900 sm:text-xl">
                      {detail.topic.title}
                    </h2>
                    {detail.topic.description ? (
                      <p className="max-w-3xl whitespace-pre-wrap text-sm leading-6 text-gray-600">
                        {detail.topic.description}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <MessageSquareText className="size-3.5" />
                        {detail.topic.comments_count} comentarios
                      </span>
                      {isDireccion && detail.topic.created_by_name ? (
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="size-3.5" />
                          {detail.topic.created_by_name}
                        </span>
                      ) : null}
                      <span>
                        Actualizado {formatForumRelativeTime(detail.topic.updated_at)}
                      </span>
                    </div>
                  </div>
                  {isDireccion ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleToggleTopicStatus}
                      disabled={topicUpdating}
                      className="shrink-0"
                    >
                      {topicUpdating ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : detail.topic.status === "open" ? (
                        <Lock className="size-4" />
                      ) : (
                        <Unlock className="size-4" />
                      )}
                      {detail.topic.status === "open" ? "Cerrar" : "Reabrir"}
                    </Button>
                  ) : null}
                </div>
              </div>

              <ScrollArea ref={scrollRootRef} className="min-h-0 flex-1">
                <div className="px-4 py-4 sm:px-6">
                  <ForumCommentList
                    comments={detail.comments}
                    isDireccion={isDireccion}
                    updatingCommentId={updatingCommentId}
                    onToggleHidden={
                      isDireccion ? handleToggleCommentHidden : undefined
                    }
                  />
                </div>
              </ScrollArea>

              <div className="shrink-0 border-t border-gray-100 p-4 sm:px-6">
                {detail.topic.status === "closed" ? (
                  <div className="flex items-center justify-center gap-2 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
                    <Lock className="size-4" />
                    Este debate está cerrado. No admite nuevos comentarios.
                  </div>
                ) : (
                  <ForumComposer
                    value={commentMessage}
                    onChange={setCommentMessage}
                    onSubmit={handleSendComment}
                    sending={commentSending}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-gray-50">
                <MessagesSquare className="size-8 text-gray-300" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-gray-900">
                Selecciona un tema
              </h2>
              <p className="mt-1 max-w-sm text-sm text-gray-500">
                Elige un debate de la lista para leer las respuestas y
                participar.
              </p>
              {isDireccion && topics.length === 0 && !topicsLoading ? (
                <Button
                  type="button"
                  className="mt-5"
                  onClick={() => setTopicDialogOpen(true)}
                >
                  <Plus className="size-4" />
                  Crear el primer debate
                </Button>
              ) : null}
            </div>
          )}
        </section>
      </div>

      <Dialog
        open={topicDialogOpen}
        onOpenChange={(open) => {
          setTopicDialogOpen(open);
          if (!open) {
            resetTopicDialog();
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nuevo debate</DialogTitle>
            <DialogDescription>
              Crea un tema visible para todos los usuarios del equipo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topic-title">Título</Label>
              <Input
                id="topic-title"
                value={newTopicTitle}
                onChange={(event) => setNewTopicTitle(event.target.value)}
                maxLength={140}
                placeholder="Ej. Prioridades comerciales de hoy"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="topic-description">Descripción</Label>
              <Textarea
                id="topic-description"
                value={newTopicDescription}
                onChange={(event) => setNewTopicDescription(event.target.value)}
                maxLength={600}
                rows={4}
                placeholder="Contexto opcional del debate"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTopicDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreateTopic}
              disabled={topicSaving}
            >
              {topicSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              Crear debate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
