import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ComparativaVM, User } from "@/lib/core/types";
import { ComparativasAnimatedList } from "./ComparativasAnimatedList";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import SpinnerComponent from "../core/SpinnerComponent";
import Image from "next/image";

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
      className={`flex flex-col justify-between relative h-full backdrop-blur-lg  transition-colors duration-300 overflow-hidden ${
        loading ? "bg-gray-200 " : "bg-white"
      }`}
    >
      {/* Decorative background elements */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary-50 rounded-full opacity-30 blur-2xl"></div>
      <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-primary-100 rounded-full opacity-40 blur-xl"></div>

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
          <CardTitle>
            <h3 className="text-xl font-semibold text-[var(--primary-color-800)]">
              Comparativas
            </h3>
            <span className="text-sm text-gray-500 font-medium">
              Listado de comparativas
            </span>
          </CardTitle>
        </div>
        <div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger
              className="w-[190px] rounded-md"
              aria-label="Selecciona una opción"
            >
              <SelectValue placeholder="Pendiente de Estudio" />
            </SelectTrigger>
            <SelectContent className="rounded-md">
              <SelectItem value="pending" className="rounded-md ">
                Pendiente de Estudio
              </SelectItem>
              <SelectItem value="completed" className="rounded-md ">
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
            <SpinnerComponent userData={userData} />
          </div>
        ) : comparativas.length > 0 ? (
          <ComparativasAnimatedList items={comparativas || []} />
        ) : (
          <div className="flex flex-col items-center justify-center text-center w-full h-96 gap-6">
            <Image
              src="/icons/comparativas2.webp"
              alt="No hay comparativas"
              width={100}
              height={100}
              className="opacity-80 animate-fadeIn"
            />
            <p className="text-xl text-gray-600 font-semibold animate-fadeIn animation-delay-200">
              No hay comparativas{" "}
              <span className="text-gray-800 font-bold">
                {status === "pending" ? "pendientes" : "con estudio realizado"}
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
