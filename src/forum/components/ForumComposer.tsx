"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/core/components/ui/button";
import { cn } from "@/core/utils";
import { CornerDownLeft, Loader2, Send } from "lucide-react";

interface ForumComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  sending: boolean;
  maxLength?: number;
}

const MAX_TEXTAREA_HEIGHT = 200;

export function ForumComposer({
  value,
  onChange,
  onSubmit,
  sending,
  maxLength = 3000,
}: ForumComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const trimmedLength = value.trim().length;
  const canSubmit = trimmedLength > 0 && !sending;
  const nearLimit = value.length >= maxLength * 0.9;

  // Auto-crecer el textarea hasta un máximo, luego permitir scroll interno.
  useEffect(() => {
    const element = textareaRef.current;
    if (!element) {
      return;
    }
    element.style.height = "auto";
    element.style.height = `${Math.min(
      element.scrollHeight,
      MAX_TEXTAREA_HEIGHT,
    )}px`;
  }, [value]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (canSubmit) {
        onSubmit();
      }
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-xs transition-colors focus-within:border-primary-300 focus-within:ring-2 focus-within:ring-primary-100">
      <textarea
        ref={textareaRef}
        aria-label="Escribe tu mensaje"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        maxLength={maxLength}
        placeholder="Escribe un comentario para el equipo…"
        className="block max-h-[200px] min-h-[44px] w-full resize-none bg-transparent px-4 pt-3 text-sm leading-6 text-gray-800 outline-none placeholder:text-gray-400"
      />
      <div className="flex items-center justify-between gap-3 px-3 pb-3 pt-1">
        <span className="hidden items-center gap-1.5 text-xs text-gray-400 sm:flex">
          <kbd className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-sans text-[11px] font-medium text-gray-500">
            ⌘/Ctrl
            <CornerDownLeft className="size-3" />
          </kbd>
          para enviar
        </span>
        <div className="ml-auto flex items-center gap-3">
          <span
            className={cn(
              "text-xs tabular-nums",
              nearLimit ? "font-medium text-warning-600" : "text-gray-400",
            )}
          >
            {value.length}/{maxLength}
          </span>
          <Button
            type="button"
            size="sm"
            onClick={onSubmit}
            disabled={!canSubmit}
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Publicar
          </Button>
        </div>
      </div>
    </div>
  );
}
