import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ClipboardList } from "lucide-react";
import { ComparativaVM, User } from "@/lib/core/types";
import { ComparativasAnimatedList } from "./ComparativasAnimatedList";
import { Spinner } from "@heroui/spinner";

interface Props {
  loading: boolean;
  userData: User;
}

export function ComparativasResume({ loading, userData }: Props) {
  const [comparativas, setComparativas] = React.useState<ComparativaVM[]>([]);
  const [loadingData, setLoadingData] = React.useState(true);

  React.useEffect(() => {
    const fetchComparativas = async () => {
      try {
        const rs = await fetch(`/api/comparativas/get/by-status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "pending",
            id: userData.id,
            role: userData.role,
          }),
        });

        const { data, success, error } = await rs.json();

        if (!success) {
          throw new Error(error || "Error al obtener comparativas");
        }

        setComparativas(data);
      } catch (error) {
        console.error("Error al obtener comparativas:", error);
      } finally {
        setLoadingData(false);
      }
    };

    fetchComparativas();
  }, [userData]);

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
              Comparativas
            </h3>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent
        className={`flex flex-col lg:flex-row gap-8 justify-center h-full w-full transition-opacity duration-300 ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      >
        {loadingData ? (
          <Spinner
            label="Cargando comparativas..."
            variant="gradient"
            color="primary"
          />
        ) : (
          <ComparativasAnimatedList items={comparativas} />
        )}
      </CardContent>
    </Card>
  );
}
