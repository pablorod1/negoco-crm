"use client";

import React from "react";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/core/components/ui/popover";
import type { CartoCiudadCandidate } from "@/core/addresses/cartociudad";
import type { ContractDB } from "@/tramites/types";
import { InputComponent } from "@/tramites/components/createTramite/InputComponent";

type AddressFields = Pick<
  ContractDB,
  | "address"
  | "tipo_via_cnmc"
  | "calle"
  | "numero_finca"
  | "aclarador_finca"
  | "province"
  | "city"
  | "postal_code"
>;
interface Props {
  formData: AddressFields;
  onChange: (fields: Partial<AddressFields>) => void;
  error?: string;
  label?: string;
  required?: boolean;
}

export default function AddressFields({
  formData,
  onChange,
  error,
  label = "Dirección",
  required = true,
}: Props) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [candidates, setCandidates] = React.useState<CartoCiudadCandidate[]>(
    [],
  );
  const [status, setStatus] = React.useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [active, setActive] = React.useState(-1);
  const listId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const requestVersion = React.useRef(0);

  React.useEffect(() => {
    if (!open || query.trim().length < 3) return;
    const controller = new AbortController();
    const version = requestVersion.current;
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query.trim(), limit: "6" });
        const response = await fetch(
          `/api/v2/addresses/cartociudad/search?${params}`,
          { signal: controller.signal },
        );
        const result = await response.json();
        if (!response.ok || !result.success || !Array.isArray(result.data))
          throw new Error("Address search failed");
        if (controller.signal.aborted || version !== requestVersion.current)
          return;
        setCandidates(result.data);
        setStatus("ready");
      } catch {
        if (controller.signal.aborted || version !== requestVersion.current)
          return;
        setStatus("error");
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  const close = () => {
    requestVersion.current++;
    setOpen(false);
  };
  const select = (candidate: CartoCiudadCandidate) => {
    onChange({
      address: candidate.address,
      tipo_via_cnmc: candidate.tipo_via_cnmc,
      calle: candidate.calle,
      numero_finca: candidate.numero_finca,
      postal_code: candidate.postal_code,
      city: candidate.city,
      province: candidate.province,
      aclarador_finca: "",
    });
    close();
    setQuery("");
    setCandidates([]);
    inputRef.current?.focus();
  };
  const updateStructured = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fields = { ...formData, [event.target.name]: event.target.value };
    onChange({
      [event.target.name]: event.target.value,
      address: [fields.tipo_via_cnmc, fields.calle, fields.numero_finca]
        .filter(Boolean)
        .join(" "),
    });
    close();
    setQuery("");
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={`${listId}-input`}>
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <Popover
        open={open}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <PopoverAnchor asChild>
          <Input
            ref={inputRef}
            id={`${listId}-input`}
            name="address"
            role="combobox"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={
              open && active >= 0 ? `${listId}-${active}` : undefined
            }
            aria-invalid={Boolean(error)}
            aria-describedby={`${listId}-help`}
            value={formData.address}
            placeholder="Escribe calle, número y población"
            onChange={(event) => {
              const value = event.target.value;
              requestVersion.current++;
              onChange({
                address: value,
                tipo_via_cnmc: "",
                calle: "",
                numero_finca: "",
              });
              setQuery(value);
              setCandidates([]);
              setActive(-1);
              setStatus(value.trim().length >= 3 ? "loading" : "idle");
              setOpen(value.trim().length >= 3);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                close();
                return;
              }
              if (!open || candidates.length === 0) return;
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setActive((current) =>
                  event.key === "ArrowDown"
                    ? (current + 1) % candidates.length
                    : current <= 0
                      ? candidates.length - 1
                      : current - 1,
                );
              }
              if (event.key === "Enter" && active >= 0) {
                event.preventDefault();
                select(candidates[active]);
              }
              if (event.key === "Tab") close();
            }}
          />
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] min-w-72 rounded-xl p-1"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (event.target === inputRef.current) event.preventDefault();
          }}
        >
          {status === "loading" && (
            <p role="status" className="p-3 text-sm">
              Buscando direcciones…
            </p>
          )}
          {status === "error" && (
            <p role="alert" className="p-3 text-sm">
              No se pudo buscar la dirección. Puedes escribirla y completar los
              datos manualmente.
            </p>
          )}
          {status === "ready" && candidates.length === 0 && (
            <p role="status" className="p-3 text-sm">
              Sin resultados. Añade el número y la población o completa los
              datos manualmente.
            </p>
          )}
          <div
            id={listId}
            role="listbox"
            aria-label="Direcciones sugeridas"
            className="max-h-64 overflow-y-auto"
          >
            {candidates.map((candidate, index) => (
              <div
                role="option"
                aria-selected={active === index}
                id={`${listId}-${index}`}
                key={`${candidate.type}-${candidate.id}-${index}`}
                className={`cursor-pointer rounded-lg px-3 py-2 text-sm hover:bg-primary-50 ${active === index ? "bg-primary-50" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(candidate)}
              >
                <p className="font-medium">{candidate.label}</p>
                <p className="text-xs text-muted-foreground">
                  {[candidate.postal_code, candidate.city, candidate.province]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {(!candidate.numero_finca || !candidate.postal_code) && (
                  <p className="text-xs text-muted-foreground">
                    Completa los datos que falten tras seleccionar.
                  </p>
                )}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <p id={`${listId}-help`} className="text-xs text-muted-foreground">
        Selecciona una sugerencia para completar provincia, población y código
        postal.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          Revisar o completar calle y número manualmente
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <InputComponent
            name="tipo_via_cnmc"
            label="Tipo de vía"
            type="text"
            placeholder="Calle, avenida…"
            value={formData.tipo_via_cnmc || ""}
            onChange={updateStructured}
          />
          <InputComponent
            name="calle"
            label="Calle"
            type="text"
            value={formData.calle || ""}
            onChange={updateStructured}
          />
          <InputComponent
            name="numero_finca"
            label="Número"
            type="text"
            value={formData.numero_finca || ""}
            onChange={updateStructured}
          />
        </div>
      </details>
      <InputComponent
        name="aclarador_finca"
        label="Complemento de dirección (opcional)"
        type="text"
        placeholder="Bloque, escalera, piso, puerta…"
        value={formData.aclarador_finca || ""}
        onChange={(event) => onChange({ aclarador_finca: event.target.value })}
      />
    </div>
  );
}
