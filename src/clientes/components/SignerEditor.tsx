"use client";

import { useState } from "react";
import { PenLine, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/core/components/ui/dialog";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { showCustomToast } from "@/core/components/CustomToast";
import { SignerDB } from "@/tramites/types/tramite.types";

interface SignerEditorProps {
  clientId: string;
  signer: SignerDB | null;
  onUpdated: () => void;
}

interface SignerFormState {
  name: string;
  last_name: string;
  email: string;
  phone: string;
  document_number: string;
  cargo: string;
}

export function SignerEditor({ clientId, signer, onUpdated }: SignerEditorProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SignerFormState>({
    name: signer?.name ?? "",
    last_name: signer?.last_name ?? "",
    email: signer?.email ?? "",
    phone: signer?.phone ?? "",
    document_number: signer?.document_number ?? "",
    cargo: signer?.cargo ?? "",
  });

  const handleChange = (field: keyof SignerFormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v2/clients/${clientId}/signature`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signer: {
            ...(signer?.id ? { id: signer.id } : {}),
            name: form.name,
            last_name: form.last_name,
            email: form.email,
            phone: form.phone,
            document_number: form.document_number,
            cargo: form.cargo || null,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Error al guardar el firmante");
      }

      showCustomToast({
        title: "Firmante actualizado",
        message: "Los datos del firmante se han guardado correctamente.",
        iconColor: "var(--success-color)",
      });

      setOpen(false);
      onUpdated();
    } catch (error) {
      showCustomToast({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al guardar el firmante.",
        iconColor: "var(--danger-color)",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <PenLine className="h-4 w-4" />
          Editar Firmante
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Firmante</DialogTitle>
          <DialogDescription>
            Modifica los datos del firmante asociado a este cliente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="signer-name">Nombre</Label>
              <Input
                id="signer-name"
                value={form.name}
                onChange={handleChange("name")}
                placeholder="Nombre"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signer-lastname">Apellidos</Label>
              <Input
                id="signer-lastname"
                value={form.last_name}
                onChange={handleChange("last_name")}
                placeholder="Apellidos"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="signer-email">Email</Label>
              <Input
                id="signer-email"
                type="email"
                value={form.email}
                onChange={handleChange("email")}
                placeholder="email@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signer-phone">Teléfono</Label>
              <Input
                id="signer-phone"
                value={form.phone}
                onChange={handleChange("phone")}
                placeholder="+34600000000"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="signer-dni">DNI/NIE</Label>
              <Input
                id="signer-dni"
                value={form.document_number}
                onChange={handleChange("document_number")}
                placeholder="12345678X"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signer-cargo">Cargo</Label>
              <Input
                id="signer-cargo"
                value={form.cargo}
                onChange={handleChange("cargo")}
                placeholder="Cargo (opcional)"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
