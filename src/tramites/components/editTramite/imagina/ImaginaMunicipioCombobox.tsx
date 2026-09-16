"use client";
import React from "react";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/core/components/ui/popover";

interface Props {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
}

type Search = (query: string, limit?: number) => string[];

// Municipio del catálogo de Imagina (8k nombres INE). El catálogo se carga
// con import() la primera vez que se escribe, así no entra en el bundle de
// la página; el filtrado es local.
export default function ImaginaMunicipioCombobox({
  name,
  label,
  value,
  onChange,
  error,
  required = true,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [results, setResults] = React.useState<string[]>([]);
  const [active, setActive] = React.useState(-1);
  const [loading, setLoading] = React.useState(false);
  const searchRef = React.useRef<Search | null>(null);
  const listId = React.useId();

  const search = React.useCallback(async (query: string) => {
    if (!searchRef.current) {
      setLoading(true);
      try {
        const catalog = await import(
          "@/core/integrations/imagina-energia/municipios"
        );
        searchRef.current = catalog.searchImaginaMunicipios;
      } finally {
        setLoading(false);
      }
    }
    return searchRef.current(query, 30);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    search(value).then((found) => {
      if (!cancelled) {
        setResults(found);
        setActive(found.length > 0 ? 0 : -1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, search, value]);

  const select = (municipio: string) => {
    onChange(municipio);
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <Label htmlFor={name}>
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <Popover
        open={open && (loading || results.length > 0)}
        onOpenChange={(next) => {
          if (!next) setOpen(false);
        }}
      >
        <PopoverAnchor asChild>
          <Input
            id={name}
            name={name}
            role="combobox"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={
              open && active >= 0 ? `${listId}-${active}` : undefined
            }
            aria-invalid={Boolean(error)}
            value={value}
            placeholder="Escribe para buscar en el catálogo de Imagina"
            onChange={(event) => {
              onChange(event.target.value);
              setOpen(event.target.value.trim().length > 0);
            }}
            onFocus={() => setOpen(value.trim().length > 0)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                return;
              }
              if (!open || results.length === 0) return;
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setActive((current) =>
                  event.key === "ArrowDown"
                    ? (current + 1) % results.length
                    : current <= 0
                      ? results.length - 1
                      : current - 1,
                );
              }
              if (event.key === "Enter" && active >= 0) {
                event.preventDefault();
                select(results[active]);
              }
              if (event.key === "Tab") setOpen(false);
            }}
          />
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] min-w-64 rounded-xl p-1"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {loading ? (
            <p role="status" className="p-3 text-sm">
              Cargando catálogo de municipios…
            </p>
          ) : (
            <div id={listId} role="listbox" className="max-h-64 overflow-auto">
              {results.map((municipio, index) => (
                <button
                  type="button"
                  key={municipio}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                    index === active ? "bg-gray-100" : ""
                  }`}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => select(municipio)}
                >
                  {municipio}
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
      {error && <p className="text-red-600 text-sm ms-1">{error}</p>}
    </div>
  );
}
