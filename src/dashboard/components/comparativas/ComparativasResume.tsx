import * as React from "react";
import { cn } from "@/core/utils";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { ComparativaVM } from "@/comparativas/types/comparativa.types";
import { User } from "@/core/types";
import { ComparativasAnimatedList } from "./ComparativasAnimatedList";
import Image from "next/image";
import AddComparativaDialog from "@/comparativas/components/createComparativa/AddComparativaDialog";
import LoadingStateCard from "../LoadingStateCard";

interface Props {
  loading: boolean;
  userData: User;
}

type StatusView = "all" | "pending" | "completed" | "processed";

// View Toggle Components (inspired by YearlyTramites pattern)
interface StatusViewToggleProps {
  statusView: StatusView;
  onViewChange: (view: StatusView) => void;
}

const StatusViewToggle: React.FC<StatusViewToggleProps> = React.memo(
  ({ statusView, onViewChange }) => {
    const getActiveIndex = () => {
      switch (statusView) {
        case "pending":
          return 0;
        case "completed":
          return 1;
        case "processed":
          return 2;
        default:
          return 0;
      }
    };

    return (
      <div className="relative flex items-center gap-1 p-0.5  bg-gray-50 rounded-md shadow-sm border border-gray-100 w-full max-w-xs">
        <div
          className="absolute transition-all duration-200 ease-out rounded-sm shadow-sm bg-white border border-gray-200 z-0"
          style={{
            left: `${getActiveIndex() * 33}%`,
            width: "calc(33.333% - 2px)",
            height: "calc(100% - 4px)",
            marginLeft: "2px",
          }}
        />

        <ViewToggleButton
          isActive={statusView === "pending"}
          onClick={() => onViewChange("pending")}
          label="Pendientes"
        />

        <ViewToggleButton
          isActive={statusView === "completed"}
          onClick={() => onViewChange("completed")}
          label="Estudio Realizado"
        />

        <ViewToggleButton
          isActive={statusView === "processed"}
          onClick={() => onViewChange("processed")}
          label="Completadas"
        />
      </div>
    );
  }
);

StatusViewToggle.displayName = "StatusViewToggle";

interface ViewToggleButtonProps {
  isActive: boolean;
  onClick: () => void;
  label: string;
}

const ViewToggleButton: React.FC<ViewToggleButtonProps> = ({
  isActive,
  onClick,
  label,
}) => (
  <button
    onClick={onClick}
    className={cn(
      "relative z-10 flex flex-col items-center justify-center w-1/3 px-2 py-2 rounded-sm transition-all duration-200",
      isActive ? "text-gray-900" : "text-gray-600 hover:text-gray-800"
    )}
  >
    <div className="flex items-center gap-1.5">
      {/* <span
        className={cn(
          "transition-colors duration-200",
          isActive ? "text-gray-700" : "text-gray-500"
        )}
      >
        {icon}
      </span> */}
      <span className="font-medium text-xs">{label}</span>
    </div>
  </button>
);

export function ComparativasResume({ loading, userData }: Props) {
  const [comparativas, setComparativas] = React.useState<ComparativaVM[]>([]);
  const [loadingData, setLoadingData] = React.useState(true);
  const [statusView, setStatusView] = React.useState<StatusView>("pending");

  const fetchComparativas = React.useCallback(async () => {
    setLoadingData(true);
    try {
      // Always fetch all comparisons to calculate summary
      const rs = await fetch(
        `/api/v2/analytics/comparisons?metric=by-status&id=${userData.id}&role=${userData.role}&status=${statusView}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

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
  }, [userData, statusView]);

  React.useEffect(() => {
    fetchComparativas();
  }, [fetchComparativas]);

  // Filter comparativas based on current view
  const filteredComparativas = React.useMemo(() => {
    if (statusView === "all") return comparativas;
    return comparativas.filter((c) => c.status === statusView);
  }, [comparativas, statusView]);

  return (
    <>
      <Card
        variant={"dashboard"}
        className={cn(loading ? "opacity-60" : "", "justify-normal gap-6")}
      >
        {/* Loading state overlay */}
        <div
          className={`absolute inset-0 flex items-center justify-center rounded-lg transition-opacity duration-300 ${
            loading ? "opacity-100" : "opacity-0 pointer-events-none -z-50"
          }`}
        >
          <div className="animate-pulse h-full w-full bg-gray-200 rounded-lg"></div>
        </div>

        {/* Header */}
        <CardHeader
          className={`transition-opacity duration-300 ${
            loading ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                Comparativas
              </CardTitle>
              <CardDescription className="text-xs text-gray-500 font-extralight">
                Resumen general por estado
              </CardDescription>
            </div>

            {/* Status View Toggle */}
            <StatusViewToggle
              statusView={statusView}
              onViewChange={setStatusView}
            />
          </div>
        </CardHeader>

        {/* Content */}
        <CardContent
          className={`transition-opacity duration-300 ${
            loading ? "opacity-0" : "opacity-100"
          }`}
        >
          {loadingData ? (
            <div className="flex items-center justify-center h-48">
              <LoadingStateCard />
            </div>
          ) : (
            <>
              {/* Empty State */}
              {filteredComparativas.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12 space-y-4">
                  <Image
                    src="/icons/comparativas3.webp"
                    alt="No hay comparativas"
                    width={64}
                    height={64}
                    className="opacity-60"
                  />
                  <div className="space-y-2">
                    <p className="text-lg font-medium text-gray-700">
                      No hay comparativas
                      {statusView !== "all" && (
                        <span className="text-sm text-gray-500 block">
                          en estado &quot;
                          {statusView === "pending"
                            ? "pendientes"
                            : statusView === "completed"
                              ? "estudio realizado"
                              : statusView === "processed"
                                ? "completadas"
                                : "completadas"}
                          &quot;
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500">
                      {statusView === "all"
                        ? "Comienza creando una nueva comparativa"
                        : "Prueba cambiar el filtro o crear una nueva comparativa"}
                    </p>
                  </div>
                  {statusView === "all" && <AddComparativaDialog />}
                </div>
              ) : (
                <div className="mt-4">
                  <ComparativasAnimatedList items={filteredComparativas} />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
