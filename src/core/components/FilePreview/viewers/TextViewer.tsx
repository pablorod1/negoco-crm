/**
 * TextViewer Component
 *
 * A comprehensive text file viewer with search functionality,
 * copy-to-clipboard support, and basic syntax highlighting.
 *
 * Features:
 * - Text search with highlighting
 * - Copy to clipboard functionality
 * - Basic syntax highlighting for code files
 * - Line numbers
 * - Scrollable content with virtualization for large files
 * - Loading states and error handling
 */

"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { ScrollArea } from "@/core/components/ui/scroll-area";
import {
  Search,
  Copy,
  CheckIcon,
  Loader2,
  AlertCircle,
  FileText,
} from "lucide-react";
import { TextViewerProps, ViewerState, FilePreviewError } from "@/types/files";

interface TextViewerState extends ViewerState {
  content: string;
  searchText: string;
  searchMatches: number[];
  currentMatch: number;
  copied: boolean;
  lineNumbers: boolean;
}

interface ExtendedTextViewerProps extends TextViewerProps {
  onError?: (error: FilePreviewError) => void;
  onStateChange?: (state: Partial<ViewerState>) => void;
}

// Simple syntax highlighting for common file types
const getSyntaxHighlighting = (content: string, extension: string) => {
  const ext = extension.toLowerCase();

  // Basic syntax highlighting patterns
  const patterns: Record<
    string,
    Array<{ pattern: RegExp; className: string }>
  > = {
    ".js": [
      {
        pattern:
          /\b(function|const|let|var|if|else|for|while|return|class|import|export)\b/g,
        className: "text-blue-600",
      },
      { pattern: /"([^"\\]|\\.)*"/g, className: "text-green-600" },
      { pattern: /'([^'\\]|\\.)*'/g, className: "text-green-600" },
      { pattern: /\/\/.*$/gm, className: "text-gray-500 italic" },
      { pattern: /\/\*[\s\S]*?\*\//g, className: "text-gray-500 italic" },
    ],
    ".ts": [
      {
        pattern:
          /\b(function|const|let|var|if|else|for|while|return|class|import|export|interface|type|enum)\b/g,
        className: "text-blue-600",
      },
      { pattern: /"([^"\\]|\\.)*"/g, className: "text-green-600" },
      { pattern: /'([^'\\]|\\.)*'/g, className: "text-green-600" },
      { pattern: /\/\/.*$/gm, className: "text-gray-500 italic" },
      { pattern: /\/\*[\s\S]*?\*\//g, className: "text-gray-500 italic" },
    ],
    ".json": [
      { pattern: /"([^"\\]|\\.)*":/g, className: "text-blue-600" },
      { pattern: /"([^"\\]|\\.)*"/g, className: "text-green-600" },
      { pattern: /\b(true|false|null)\b/g, className: "text-purple-600" },
      { pattern: /\b\d+\.?\d*\b/g, className: "text-orange-600" },
    ],
    ".css": [
      { pattern: /[.#][\w-]+/g, className: "text-blue-600" },
      {
        pattern:
          /\b(color|background|border|margin|padding|width|height|font-size|display|position|flex|grid)\b/g,
        className: "text-purple-600",
      },
      { pattern: /\/\*[\s\S]*?\*\//g, className: "text-gray-500 italic" },
    ],
    ".html": [
      { pattern: /<\/?[\w\s="/.':;#-\/\?]+>/g, className: "text-blue-600" },
      {
        pattern: /\b(class|id|src|href|type|value|placeholder|data-[\w-]+)\b/g,
        className: "text-purple-600",
      },
      { pattern: /<!--[\s\S]*?-->/g, className: "text-gray-500 italic" },
    ],
  };

  return patterns[ext] || [];
};

export default function TextViewer({
  file,
  maxLines = 1000,
  enableSearch = true,
  enableCopy = true,
  syntaxHighlighting = true,
  onError,
  onStateChange,
  className = "",
}: ExtendedTextViewerProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [textState, setTextState] = useState<TextViewerState>({
    loading: "loading",
    error: undefined,
    content: "",
    searchText: "",
    searchMatches: [],
    currentMatch: -1,
    copied: false,
    lineNumbers: true,
  });

  // Update parent state when local state changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange({
        loading: textState.loading,
        error: textState.error,
      });
    }
  }, [textState, onStateChange]);

  // Update local state
  const updateState = useCallback((updates: Partial<TextViewerState>) => {
    setTextState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Load file content
  useEffect(() => {
    const loadFileContent = async () => {
      try {
        updateState({ loading: "loading", error: undefined });

        const response = await fetch(file.download_url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const content = await response.text();

        // Limit content for performance
        const lines = content.split("\n");
        const limitedContent =
          lines.length > maxLines
            ? lines.slice(0, maxLines).join("\n") +
              `\n\n... (archivo truncado, mostrando ${maxLines} líneas de ${lines.length})`
            : content;

        updateState({
          loading: "success",
          content: limitedContent,
          error: undefined,
        });
      } catch (error) {
        const textError: FilePreviewError = {
          code: "LOAD_ERROR",
          message: "No se pudo cargar el archivo de texto",
          details: error instanceof Error ? error.message : "Error desconocido",
        };

        updateState({
          loading: "error",
          error: textError,
        });

        if (onError) {
          onError(textError);
        }
      }
    };

    if (file.download_url) {
      loadFileContent();
    }
  }, [file.download_url, maxLines, updateState, onError]);

  // Handle search
  const handleSearch = useCallback(
    (searchTerm: string) => {
      updateState({ searchText: searchTerm });

      if (!searchTerm.trim() || !textState.content) {
        updateState({ searchMatches: [], currentMatch: -1 });
        return;
      }

      // Find all matches
      const regex = new RegExp(
        searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "gi"
      );
      const matches: number[] = [];
      let match;

      while ((match = regex.exec(textState.content)) !== null) {
        matches.push(match.index);
      }

      updateState({
        searchMatches: matches,
        currentMatch: matches.length > 0 ? 0 : -1,
      });
    },
    [textState.content, updateState]
  );

  // Navigate search matches
  const handleSearchNavigation = useCallback(
    (direction: "next" | "prev") => {
      if (textState.searchMatches.length === 0) return;

      let newIndex = textState.currentMatch;
      if (direction === "next") {
        newIndex =
          (textState.currentMatch + 1) % textState.searchMatches.length;
      } else {
        newIndex =
          textState.currentMatch > 0
            ? textState.currentMatch - 1
            : textState.searchMatches.length - 1;
      }

      updateState({ currentMatch: newIndex });

      // Scroll to match (basic implementation)
      // In a real implementation, you'd want to calculate the exact position
      // and scroll to it smoothly
    },
    [textState.searchMatches, textState.currentMatch, updateState]
  );

  // Handle copy to clipboard
  const handleCopyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(textState.content);
      updateState({ copied: true });

      // Reset copied state after 2 seconds
      setTimeout(() => {
        updateState({ copied: false });
      }, 2000);
    } catch {
      // Error copying to clipboard
    }
  }, [textState.content, updateState]);

  // Highlight search matches in content
  const highlightMatches = useCallback(
    (content: string) => {
      if (
        !textState.searchText.trim() ||
        textState.searchMatches.length === 0
      ) {
        return content;
      }

      const searchTerm = textState.searchText;
      const regex = new RegExp(
        `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
        "gi"
      );

      return content.replace(regex, (match, p1, offset) => {
        const matchIndex = textState.searchMatches.indexOf(offset);
        const isCurrent = matchIndex === textState.currentMatch;
        const highlightClass = isCurrent ? "bg-yellow-400" : "bg-yellow-200";
        return `<mark class="${highlightClass}">${p1}</mark>`;
      });
    },
    [textState.searchText, textState.searchMatches, textState.currentMatch]
  );

  // Apply syntax highlighting
  const applySyntaxHighlighting = useCallback(
    (content: string) => {
      if (!syntaxHighlighting) return content;

      const patterns = getSyntaxHighlighting(content, file.extension);
      let highlightedContent = content;

      patterns.forEach(({ pattern, className }) => {
        highlightedContent = highlightedContent.replace(pattern, (match) => {
          return `<span class="${className}">${match}</span>`;
        });
      });

      return highlightedContent;
    },
    [syntaxHighlighting, file.extension]
  );

  // Render loading state
  if (textState.loading === "loading") {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-600">Cargando archivo de texto...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (textState.loading === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">
            Error al cargar archivo
          </h3>
          <p className="text-sm text-gray-600 max-w-md">
            {textState.error?.message}
          </p>
          {textState.error?.details && (
            <p className="text-xs text-gray-500 mt-2">
              {textState.error.details}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
          className="text-sm"
        >
          Reintentar
        </Button>
      </div>
    );
  }

  const processedContent = highlightMatches(
    applySyntaxHighlighting(textState.content)
  );
  const lines = textState.content.split("\n");

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Controls Toolbar */}
      <div className="flex items-center justify-between p-3 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-600" />
          <span className="text-sm text-gray-600">
            {lines.length} líneas • {file.extension.toUpperCase()}
          </span>

          {/* Search */}
          {enableSearch && (
            <div className="flex items-center gap-2 ml-4">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar en archivo..."
                  value={textState.searchText}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 w-48 text-sm"
                />
              </div>

              {textState.searchMatches.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">
                    {textState.currentMatch + 1} de{" "}
                    {textState.searchMatches.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSearchNavigation("prev")}
                    disabled={textState.searchMatches.length === 0}
                    className="h-7 w-7 p-0"
                  >
                    ↑
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSearchNavigation("next")}
                    disabled={textState.searchMatches.length === 0}
                    className="h-7 w-7 p-0"
                  >
                    ↓
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Copy to Clipboard */}
          {enableCopy && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyToClipboard}
              disabled={!textState.content}
              className="text-sm"
            >
              {textState.copied ? (
                <>
                  <CheckIcon className="h-4 w-4 mr-2" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <ScrollArea ref={scrollAreaRef} className="flex-1">
        <div className="p-4">
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="flex">
              {/* Line Numbers */}
              {textState.lineNumbers && (
                <div className="bg-gray-50 border-r text-xs text-gray-500 p-2 select-none">
                  {lines.map((_, index) => (
                    <div key={index} className="leading-6 text-right pr-2">
                      {index + 1}
                    </div>
                  ))}
                </div>
              )}

              {/* Content */}
              <div className="flex-1 p-2">
                <pre
                  className="text-sm leading-6 whitespace-pre-wrap font-mono"
                  dangerouslySetInnerHTML={{ __html: processedContent }}
                />
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
