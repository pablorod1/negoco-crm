import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ClipboardList } from "lucide-react";
import { ComparativaVM, User } from "@/lib/core/types";
import { ComparativasAnimatedList } from "./ComparativasAnimatedList";
import { Spinner } from "@heroui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface Props {
  loading: boolean;
  userData: User;
}

export function ComparativasResume({ loading, userData }: Props) {
  const [comparativas, setComparativas] = React.useState<ComparativaVM[]>([]);
  const [loadingData, setLoadingData] = React.useState(true);
  const [status, setStatus] = React.useState<string>("pending");

  React.useEffect(() => {
    const fetchComparativas = async () => {
      setLoadingData(true);
      try {
        const rs = await fetch(`/api/comparativas/get/by-status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
            id: userData.id,
            role: userData.role,
          }),
        });

        const { data, success, error } = await rs.json();
        if (!success) {
          throw new Error(error || "Error al obtener comparativas");
        }

        setComparativas(data || []);
      } catch (error) {
        console.error("Error al obtener comparativas:", error);
      } finally {
        setLoadingData(false);
      }
    };

    fetchComparativas();
  }, [userData, status]);

  return (
    <Card
      className={`relative w-full h-full backdrop-blur-lg border-0 shadow-[0_2px_6px_rgba(0,0,0,0.1)] group transition-colors duration-300 ${
        loading ? "bg-gray-200 " : "bg-white"
      }`}
    >
      <div
        className={`absolute inset-0 h-full flex items-center justify-center rounded-lg transition-opacity duration-300 ${
          loading ? "opacity-100" : "opacity-0 pointer-events-none -z-50"
        }`}
      >
        <div className="animate-pulse h-full w-full bg-gray-200 rounded-lg"></div>
      </div>
      <CardHeader
        className={`flex flex-row justify-between w-full transition-opacity duration-300 ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg backdrop-blur-md bg-white/90 shadow-md bg-opacity-10">
            <ClipboardList className="text-[var(--primary-color-800)]" />
          </div>
          <CardTitle>
            <h3 className="text-xl font-semibold text-[var(--primary-color-800)]">
              Resumen de Comparativas
            </h3>
            <span className="text-sm text-gray-500 font-medium">
              Listado de comparativas
            </span>
          </CardTitle>
        </div>
        <div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger
              className="w-[260px] rounded-md"
              aria-label="Selecciona una opción"
            >
              <SelectValue placeholder="Pendiente de Estudio" />
            </SelectTrigger>
            <SelectContent className="rounded-md">
              <SelectItem value="pending" className="rounded-md">
                Pendiente de Estudio
              </SelectItem>
              <SelectItem value="completed" className="rounded-md">
                Estudio Realizado
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent
        className={`flex flex-col lg:flex-row gap-8 justify-center transition-opacity duration-300 ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      >
        {loadingData ? (
          <div className="flex items-center justify-center w-full h-64">
            <Spinner
              label="Cargando comparativas..."
              variant="gradient"
              color="primary"
            />
          </div>
        ) : comparativas.length > 0 ? (
          <ComparativasAnimatedList items={comparativas || []} />
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-64">
            <p className="text-lg text-gray-500 font-medium">
              No hay comparativas{" "}
              {status === "pending" ? "pendientes" : "con estudio realizado"}
            </p>
            <p className="text-sm text-gray-400 font-normal">
              {status === "pending"
                ? "No hay comparativas pendientes de estudio"
                : "No hay comparativas con estudio realizado"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
