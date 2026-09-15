"use client";

import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { cn } from "@/core/utils";
import { formatDateTime } from "@/core/utils/format";
import { getForumMonogram } from "@/forum/utils";
import type { ForumComment } from "@/forum/types";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";

interface ForumCommentListProps {
  comments: ForumComment[];
  isDireccion: boolean;
  updatingCommentId?: string | null;
  onToggleHidden?: (comment: ForumComment) => void;
}

export function ForumCommentList({
  comments,
  isDireccion,
  updatingCommentId,
  onToggleHidden,
}: ForumCommentListProps) {
  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 px-6 py-12 text-center">
        <p className="text-sm font-semibold text-gray-700">Aún no hay respuestas</p>
        <p className="mt-1 max-w-xs text-sm text-gray-500">
          Sé el primero en aportar al debate. Tu mensaje aparecerá de forma
          anónima para el resto del equipo.
        </p>
      </div>
    );
  }

  return (
    <ol className="space-y-1">
      {comments.map((comment) => {
        const isHidden = Boolean(comment.is_hidden);
        const isUpdating = updatingCommentId === comment.id;

        return (
          <li
            key={comment.id}
            className={cn(
              "group flex gap-3 rounded-2xl px-3 py-3 transition-colors",
              isHidden ? "bg-gray-50 opacity-70" : "hover:bg-gray-50",
            )}
          >
            <div
              className="mt-0.5 flex size-9 shrink-0 select-none items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600"
              aria-hidden="true"
            >
              {getForumMonogram(comment.author_label)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold text-gray-900">
                      {comment.author_label}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDateTime(comment.created_at)}
                    </span>
                    {isHidden ? (
                      <Badge variant="warning">Oculto</Badge>
                    ) : null}
                  </div>
                  {isDireccion && comment.author_name ? (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                      <ShieldCheck className="size-3.5 text-primary-500" />
                      <span className="truncate">
                        {comment.author_name}
                        {comment.author_email
                          ? ` · ${comment.author_email}`
                          : ""}
                      </span>
                    </div>
                  ) : null}
                </div>

                {isDireccion && onToggleHidden ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onToggleHidden(comment)}
                    disabled={isUpdating}
                    aria-label={
                      isHidden ? "Restaurar comentario" : "Ocultar comentario"
                    }
                    className="size-8 shrink-0 text-gray-400 opacity-0 transition-opacity hover:text-gray-900 focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    {isUpdating ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : isHidden ? (
                      <Eye className="size-4" />
                    ) : (
                      <EyeOff className="size-4" />
                    )}
                  </Button>
                ) : null}
              </div>

              <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">
                {comment.message}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
