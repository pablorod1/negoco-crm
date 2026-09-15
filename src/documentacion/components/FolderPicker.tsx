"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Folder,
  HardDrive,
  Search,
} from "lucide-react";

import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { cn } from "@/core/utils";
import { SupplierLogo } from "@/comercializadoras/components/SupplierLogo";
import {
  filterFolderTree,
  folderAncestors,
  FolderNode,
  FolderTree,
} from "@/documentacion/lib/folder-tree";
import { DOCUMENT_LIBRARY_ROOT_FOLDER } from "@/core/utils/document-library-path";

interface FolderPickerProps {
  tree: FolderTree;
  /** Carpeta seleccionada: "/" para la raíz. */
  value: string;
  onChange: (path: string) => void;
  disabled?: boolean;
  /** Carpetas que no se pueden elegir (p. ej. la que se está moviendo y sus hijas). */
  isDisabled?: (node: FolderNode) => boolean;
}

interface PickerRowProps {
  node: FolderNode;
  depth: number;
  value: string;
  expanded: Set<string>;
  forceExpanded: boolean;
  disabled?: boolean;
  isDisabled?: (node: FolderNode) => boolean;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
}

function PickerRow({
  node,
  depth,
  value,
  expanded,
  forceExpanded,
  disabled,
  isDisabled,
  onSelect,
  onToggle,
}: PickerRowProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = forceExpanded || expanded.has(node.path);
  const isSelected = value === node.path;
  const isRowDisabled = disabled || isDisabled?.(node) === true;

  return (
    <li>
      <div
        className={cn(
          "flex items-center gap-1 rounded-md pe-1",
          isSelected ? "bg-primary-50" : !isRowDisabled && "hover:bg-gray-50",
          isRowDisabled && "opacity-50"
        )}
        style={{ paddingLeft: depth * 20 }}
      >
        <button
          type="button"
          disabled={isRowDisabled}
          aria-pressed={isSelected}
          onClick={() => onSelect(node.path)}
          className="flex min-w-0 flex-1 items-center gap-3 px-2 py-1.5 text-left text-sm disabled:cursor-not-allowed"
        >
          {node.supplier ? (
            <SupplierLogo supplier={node.supplier} size={24} />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-blue-600" />
          )}
          <span
            className={cn(
              "truncate",
              isSelected ? "font-medium text-primary-800" : "text-gray-800"
            )}
          >
            {node.name}
          </span>
          {node.virtual && (
            <span className="shrink-0 text-xs text-gray-400">
              sin documentos
            </span>
          )}
          {isSelected && (
            <Check className="ms-auto h-4 w-4 shrink-0 text-primary-700" />
          )}
        </button>
        {hasChildren && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-gray-500"
            aria-label={isExpanded ? "Contraer" : "Expandir"}
            aria-expanded={isExpanded}
            disabled={disabled || forceExpanded}
            onClick={() => onToggle(node.path)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
      {hasChildren && isExpanded && (
        <ul className="mt-0.5 space-y-0.5">
          {node.children.map((child) => (
            <PickerRow
              key={child.path}
              node={child}
              depth={depth + 1}
              value={value}
              expanded={expanded}
              forceExpanded={forceExpanded}
              disabled={disabled}
              isDisabled={isDisabled}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function PickerSection({
  title,
  nodes,
  ...rowProps
}: { title: string; nodes: FolderNode[] } & Omit<
  PickerRowProps,
  "node" | "depth"
>) {
  if (nodes.length === 0) return null;

  return (
    <li>
      <p className="px-2 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {title}
      </p>
      <ul className="space-y-0.5">
        {nodes.map((node) => (
          <PickerRow key={node.path} node={node} depth={1} {...rowProps} />
        ))}
      </ul>
    </li>
  );
}

/**
 * Árbol de carpetas para elegir un destino. Con búsqueda se muestran sólo las
 * ramas que coinciden, desplegadas; sin búsqueda se despliega la rama de la
 * carpeta seleccionada.
 */
export function FolderPicker({
  tree,
  value,
  onChange,
  disabled,
  isDisabled,
}: FolderPickerProps) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(folderAncestors(value))
  );

  // Al cambiar la selección desde fuera, que su rama quede visible
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setExpanded((prev) => new Set([...prev, ...folderAncestors(value)]));
  }

  const isFiltering = query.trim().length > 0;
  const visible = useMemo(
    () =>
      isFiltering
        ? {
            supplierFolders: filterFolderTree(tree.supplierFolders, query),
            otherFolders: filterFolderTree(tree.otherFolders, query),
          }
        : tree,
    [isFiltering, query, tree]
  );
  const noResults =
    isFiltering &&
    visible.supplierFolders.length === 0 &&
    visible.otherFolders.length === 0;

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const rowProps = {
    value,
    expanded,
    forceExpanded: isFiltering,
    disabled,
    isDisabled,
    onSelect: onChange,
    onToggle: toggle,
  };
  const isRootSelected = value === DOCUMENT_LIBRARY_ROOT_FOLDER;

  return (
    <div className="rounded-lg border border-gray-200">
      <div className="relative border-b border-gray-100 p-2">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          type="search"
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar carpeta…"
          aria-label="Buscar carpeta"
          className="h-8 rounded-md pl-8"
        />
      </div>
      <ul className="max-h-56 overflow-y-auto p-1">
        {!isFiltering && (
          <li>
            <button
              type="button"
              disabled={disabled}
              aria-pressed={isRootSelected}
              onClick={() => onChange(DOCUMENT_LIBRARY_ROOT_FOLDER)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm disabled:cursor-not-allowed",
                isRootSelected ? "bg-primary-50" : "hover:bg-gray-50"
              )}
            >
              <HardDrive className="h-4 w-4 shrink-0 text-gray-500" />
              <span
                className={cn(
                  isRootSelected
                    ? "font-medium text-primary-800"
                    : "text-gray-800"
                )}
              >
                Inicio
              </span>
              {isRootSelected && (
                <Check className="ms-auto h-4 w-4 shrink-0 text-primary-700" />
              )}
            </button>
          </li>
        )}
        <PickerSection
          title="Comercializadoras"
          nodes={visible.supplierFolders}
          {...rowProps}
        />
        <PickerSection
          title="Carpetas"
          nodes={visible.otherFolders}
          {...rowProps}
        />
        {noResults && (
          <li className="px-2 py-6 text-center text-sm text-gray-500">
            Ninguna carpeta coincide con «{query.trim()}».
          </li>
        )}
      </ul>
    </div>
  );
}
