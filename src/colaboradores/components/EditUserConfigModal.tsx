"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { showCustomToast } from "@/core/components/CustomToast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/core/components/ui/dialog";
import { Checkbox } from "@/core/components/ui/checkbox";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/components/ui/select";
import { Textarea } from "@/core/components/ui/textarea";
import TooltipComponent from "@/core/components/TooltipComponent";
import { useUser } from "@/core/contexts/UserContext";
import {
  CommissionType,
  User,
  UserCompanyCommission,
  UserDefaultNote,
  UserDefaultNoteTarget,
} from "@/core/types";
import { useActiveEnergySuppliers } from "@/comercializadoras/hooks/useActiveEnergySuppliers";
import { useDefaultCompanyCommissions } from "@/core/hooks/use-default-company-commissions";

interface Props {
  user: User;
  onUpdated?: (user: User) => void;
}

type CommissionDraft = {
  comercializadora_id: string;
  commission_type: CommissionType;
  commission_value: string;
};

type NoteDraft = {
  client_id: string;
  id?: string;
  target: UserDefaultNoteTarget;
  note: string;
};

const noteTargets: { value: UserDefaultNoteTarget; label: string }[] = [
  { value: "global", label: "Global" },
  { value: "tramites", label: "Trámites" },
  { value: "comparativas", label: "Comparativas" },
];

const NO_SUPER_ID = "__none__";

export default function EditUserConfigModal({ user, onUpdated }: Props) {
  const { userData } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [superId, setSuperId] = useState(user.super_id ?? "");
  const [password, setPassword] = useState("");
  const [commissions, setCommissions] = useState<CommissionDraft[]>([]);
  const [notes, setNotes] = useState<NoteDraft[]>([]);
  const [deletedNoteIds, setDeletedNoteIds] = useState<string[]>([]);
  const [commercialUsers, setCommercialUsers] = useState<User[]>([]);
  const { activeSuppliers, loading: suppliersLoading, refetch } =
    useActiveEnergySuppliers();
  const { defaults, loading: defaultsLoading } =
    useDefaultCompanyCommissions(isOpen);

  // `commissions` guarda solo las comisiones personalizadas del colaborador.
  // Las comercializadoras que no estén aquí heredan el valor por defecto.
  const commissionsBySupplier = useMemo(() => {
    return new Map(
      commissions.map((commission) => [
        commission.comercializadora_id,
        commission,
      ]),
    );
  }, [commissions]);

  const defaultsBySupplier = useMemo(() => {
    return new Map(
      defaults.map((fallback) => [fallback.comercializadora_id, fallback]),
    );
  }, [defaults]);

  const selectedSuperName = useMemo(() => {
    if (!superId) return "Sin superior asignado";
    return (
      commercialUsers.find((commercial) => commercial.id === superId)?.name ??
      "Usuario asignado no encontrado"
    );
  }, [commercialUsers, superId]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    async function loadDetail() {
      setInitializing(true);
      setPassword("");
      setDeletedNoteIds([]);
      try {
        const userListPromise = userData
          ? fetch(`/api/v2/users/${userData.id}/all?role=${userData.role}`)
          : Promise.resolve(null);

        const [userResponse, usersResponse] = await Promise.all([
          fetch(`/api/v2/users/${user.id}`),
          userListPromise,
          refetch(),
        ]);
        const userResult = await userResponse.json();
        if (!userResponse.ok || !userResult.success) {
          throw new Error(userResult.error || "No se pudo cargar el usuario");
        }
        const usersResult = usersResponse ? await usersResponse.json() : null;
        if (usersResponse && (!usersResponse.ok || !usersResult.success)) {
          throw new Error(
            usersResult.error || "No se pudo cargar el listado de comerciales",
          );
        }
        if (cancelled) return;

        const detail = userResult.data as User;
        const allUsers = Array.isArray(usersResult?.data)
          ? (usersResult.data as User[])
          : [];
        setCommercialUsers(
          allUsers.filter(
            (commercial) => commercial.role === "2" && commercial.id !== user.id,
          ),
        );
        setName(detail.name);
        setEmail(detail.email);
        setSuperId(detail.super_id ?? "");
        setCommissions(
          (detail.company_commissions ?? []).map(
            (commission: UserCompanyCommission) => ({
              comercializadora_id: commission.comercializadora_id,
              commission_type: commission.commission_type,
              commission_value: String(commission.commission_value),
            }),
          ),
        );
        setNotes(
          (detail.targeted_notes ?? []).map((note: UserDefaultNote) => ({
            client_id: note.id,
            id: note.id,
            target: note.target,
            note: note.note,
          })),
        );
      } catch (error) {
        showCustomToast({
          title: "Error",
          message:
            error instanceof Error
              ? error.message
              : "Error al cargar la configuración",
          icon: Pencil,
          iconSize: 24,
          iconColor: "red",
        });
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [isOpen, refetch, user.id, userData]);

  const handleOpen = () => {
    setName(user.name);
    setEmail(user.email);
    setSuperId(user.super_id ?? "");
    setPassword("");
    setIsOpen(true);
  };

  const updateCommission = (
    supplierId: string,
    patch: Partial<CommissionDraft>,
  ) => {
    setCommissions((current) => {
      const existing = current.find(
        (commission) => commission.comercializadora_id === supplierId,
      );
      if (!existing) {
        return [
          ...current,
          {
            comercializadora_id: supplierId,
            commission_type: patch.commission_type ?? "percent",
            commission_value: patch.commission_value ?? "0",
          },
        ];
      }
      return current.map((commission) =>
        commission.comercializadora_id === supplierId
          ? { ...commission, ...patch }
          : commission,
      );
    });
  };

  /**
   * Alterna entre heredar la comisión por defecto de la asesoría y fijar una
   * propia. Al personalizar se parte del valor heredado para no perderlo.
   */
  const toggleCommissionOverride = (supplierId: string, override: boolean) => {
    if (!override) {
      setCommissions((current) =>
        current.filter(
          (commission) => commission.comercializadora_id !== supplierId,
        ),
      );
      return;
    }

    const fallback = defaultsBySupplier.get(supplierId);
    updateCommission(supplierId, {
      commission_type: fallback?.commission_type ?? "percent",
      commission_value: String(fallback?.commission_value ?? 0),
    });
  };

  const addNote = () => {
    setNotes((current) => [
      ...current,
      {
        client_id: crypto.randomUUID(),
        target: "global",
        note: "",
      },
    ]);
  };

  const removeNote = (note: NoteDraft) => {
    if (note.id) {
      setDeletedNoteIds((current) => [...current, note.id as string]);
    }
    setNotes((current) => current.filter((item) => item.client_id !== note.client_id));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Solo se envían las comisiones personalizadas: lo que no viaje se borra
      // en el servidor y pasa a heredar el valor por defecto.
      const submittedCommissions = commissions.map((commission) => ({
        comercializadora_id: commission.comercializadora_id,
        commission_type: commission.commission_type,
        commission_value: Number(commission.commission_value) || 0,
      }));

      const res = await fetch(`/api/v2/users/${user.id}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            name,
            email,
            super_id: superId.trim() ? superId.trim() : null,
            ...(password ? { password } : {}),
          },
          company_commissions: submittedCommissions,
          targeted_notes: [
            ...notes.map((note) => ({
              id: note.id,
              target: note.target,
              note: note.note,
            })),
            ...deletedNoteIds.map((id) => ({
              id,
              target: "global" as const,
              note: "",
              delete: true,
            })),
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showCustomToast({
          title: "Error",
          message: data.error || "Error al guardar la configuración",
          icon: Pencil,
          iconSize: 24,
          iconColor: "red",
        });
        return;
      }

      showCustomToast({
        title: "Configuración actualizada",
        message: "Los cambios se han guardado correctamente",
        icon: Check,
        iconSize: 24,
        iconColor: "green",
      });
      onUpdated?.({ ...user, name, email, super_id: superId.trim() || null });
      setIsOpen(false);
    } catch {
      showCustomToast({
        title: "Error",
        message: "Error desconocido al guardar la configuración",
        icon: Pencil,
        iconSize: 24,
        iconColor: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <TooltipComponent color="bg-primary" content="Configuración avanzada">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
            onClick={handleOpen}
          >
            <Settings2 size={14} />
          </Button>
        </TooltipComponent>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-5xl border-gray-200 p-0 overflow-hidden"
      >
        <DialogHeader className="px-6 py-5 border-b border-gray-100 bg-gray-50/70">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 flex items-center justify-center">
              <Settings2 className="text-blue-600" size={20} />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-gray-900">
                Configuración de colaborador
              </DialogTitle>
              <p className="text-sm text-gray-500">{user.name}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[72vh] overflow-y-auto p-6 space-y-6">
          <section className="rounded-3xl border border-gray-200 p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900">Datos básicos</h3>
              <p className="text-sm text-gray-500">
                Edita el perfil y define una nueva contraseña si es necesario.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="user-name">Nombre</Label>
                <Input
                  id="user-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={initializing || loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-email">Email</Label>
                <Input
                  id="user-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={initializing || loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-super-id">Jefe de equipo</Label>
                <Select
                  value={superId || NO_SUPER_ID}
                  onValueChange={(value) =>
                    setSuperId(value === NO_SUPER_ID ? "" : value)
                  }
                  disabled={initializing || loading}
                >
                  <SelectTrigger id="user-super-id">
                    <SelectValue placeholder="Sin superior asignado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SUPER_ID}>Sin superior</SelectItem>
                    {commercialUsers.map((commercial) => (
                      <SelectItem key={commercial.id} value={commercial.id}>
                        {commercial.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Superior actual: {selectedSuperName}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-password">Nueva contraseña</Label>
                <Input
                  id="user-password"
                  type="password"
                  value={password}
                  placeholder="Dejar en blanco para no cambiar"
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={initializing || loading}
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200 p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900">Comisiones</h3>
              <p className="text-sm text-gray-500">
                Por defecto hereda la comisión de la asesoría. Marca
                &laquo;Personalizar&raquo; solo donde este colaborador cobre algo
                distinto.
              </p>
            </div>
            {suppliersLoading || defaultsLoading || initializing ? (
              <div className="text-sm text-gray-500 py-6 text-center">
                Cargando comercializadoras...
              </div>
            ) : activeSuppliers.length === 0 ? (
              <div className="text-sm text-gray-500 py-6 text-center">
                No hay comercializadoras activas.
              </div>
            ) : (
              <div className="space-y-2">
                {activeSuppliers.map((supplier) => {
                  const commission = commissionsBySupplier.get(supplier.id);
                  const fallback = defaultsBySupplier.get(supplier.id);
                  const isOverride = Boolean(commission);
                  const effectiveType =
                    commission?.commission_type ??
                    fallback?.commission_type ??
                    "percent";
                  const effectiveValue =
                    commission?.commission_value ??
                    (fallback ? String(fallback.commission_value) : "");

                  return (
                    <div
                      key={supplier.id}
                      className="grid grid-cols-1 md:grid-cols-[1fr_150px_120px_150px] gap-3 items-center rounded-2xl bg-gray-50 p-3"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-gray-800 truncate">
                          {supplier.name}
                        </div>
                        {!isOverride && (
                          <span className="text-xs text-gray-400">
                            {fallback
                              ? `Hereda ${fallback.commission_value}${
                                  fallback.commission_type === "percent"
                                    ? "%"
                                    : " €"
                                }`
                              : "Sin comisión por defecto"}
                          </span>
                        )}
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={isOverride}
                          onCheckedChange={(checked) =>
                            toggleCommissionOverride(
                              supplier.id,
                              checked === true,
                            )
                          }
                          disabled={loading}
                        />
                        <span className="text-sm text-gray-600">
                          Personalizar
                        </span>
                      </label>
                      <Select
                        value={effectiveType}
                        onValueChange={(value: CommissionType) =>
                          updateCommission(supplier.id, { commission_type: value })
                        }
                        disabled={loading || !isOverride}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">%</SelectItem>
                          <SelectItem value="fixed">Fijo</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Sin comisión"
                        value={effectiveValue}
                        onChange={(event) =>
                          updateCommission(supplier.id, {
                            commission_value: event.target.value,
                          })
                        }
                        disabled={loading || !isOverride}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-gray-900">Notas predefinidas</h3>
                <p className="text-sm text-gray-500">
                  Crea notas distintas para global, trámites o comparativas.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="border-gray-200"
                onClick={addNote}
                disabled={loading || initializing}
              >
                <Plus size={16} className="mr-2" />
                Añadir nota
              </Button>
            </div>
            {notes.length === 0 ? (
              <div className="text-sm text-gray-500 py-6 text-center rounded-2xl bg-gray-50">
                Sin notas configuradas.
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div
                    key={note.client_id}
                    className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-3 rounded-2xl bg-gray-50 p-3"
                  >
                    <Select
                      value={note.target}
                      onValueChange={(value: UserDefaultNoteTarget) =>
                        setNotes((current) =>
                          current.map((item) =>
                            item.client_id === note.client_id
                              ? { ...item, target: value }
                              : item,
                          ),
                        )
                      }
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {noteTargets.map((target) => (
                          <SelectItem key={target.value} value={target.value}>
                            {target.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Textarea
                      value={note.note}
                      placeholder="Escribe la nota..."
                      onChange={(event) =>
                        setNotes((current) =>
                          current.map((item) =>
                            item.client_id === note.client_id
                              ? { ...item, note: event.target.value }
                              : item,
                          ),
                        )
                      }
                      disabled={loading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => removeNote(note)}
                      disabled={loading}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="gap-3 px-6 py-4 border-t border-gray-100 bg-white">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            className="border-gray-200 text-gray-700 hover:bg-gray-50"
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={loading || initializing}
          >
            {loading ? "Guardando..." : "Guardar configuración"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
