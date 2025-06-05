import { User } from "@/lib/core/types";
import { ComparativasRatio } from "./charts/ComparativasRatio";
import { YearlyTramitesBarChart } from "./charts/YearlyTramitesBarChart";
import RenewableTramitesCalendar from "./renewable/RenewableTramitesCalendar";
import { PersonalTramitesChart } from "./charts/PersonalTramitesBarChart";
import { TeamTramitesBarChart } from "./charts/TeamTramitesBarChar";
import { useCallback, useEffect, useState } from "react";
import { ComparativasResume } from "./comparativas/ComparativasResume";
import { ObjetivosCard } from "./objectives/ObjectivesSection";
import { Skeleton } from "../ui/skeleton";
import { cn } from "@/lib/utils";

interface Props {
  userData: User;
  loading: boolean;
  getPlan: () => string | null;
}

export const DireccionView = ({ userData, loading, getPlan }: Props) => {
  const isStarterPlan = getPlan() === "starter";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 items-stretch gap-4">
      {loading ? (
        <>
          <div className="lg:col-span-2 row-span-2">
            <Skeleton className="w-full h-[500px]" />
          </div>
          {!isStarterPlan && (
            <div className="row-start-3 row-span-2  2xl:row-start-1 2xl:col-start-3 ">
              <Skeleton className="w-full h-[500px]" />
            </div>
          )}
          <div className="row-start-5 row-span-2 lg:row-start-3 lg:col-start-2 2xl:row-start-1 2xl:col-start-4 ">
            <Skeleton className="w-full h-[500px]" />
          </div>

          <div className="row-start-7 row-span-2 col-start-1 lg:row-start-5 2xl:row-start-3 2xl:col-span-1">
            <Skeleton className="w-full h-44" />
          </div>

          {!isStarterPlan && (
            <div className="row-start-9 row-span-2  lg:row-start-5 2xl:row-start-3 2xl:col-span-1 2xl:col-start-2">
              <Skeleton className="w-full h-44" />
            </div>
          )}
          <div className="row-start-11 row-span-2 lg:col-span-2 lg:row-start-7 2xl:row-start-3 2xl:col-start-3">
            <Skeleton className="w-full h-44" />
          </div>
          <div className="row-start-13  row-span-2 lg:col-span-2 lg:row-start-9 2xl:row-start-5 2xl:col-span-4">
            <Skeleton className="w-full h-44" />
          </div>
        </>
      ) : (
        <>
          <div className="lg:col-span-2 row-span-2">
            <YearlyTramitesBarChart loading={loading} userData={userData} />
          </div>
          {!isStarterPlan && (
            <div className="row-start-3 row-span-2  2xl:row-start-1 2xl:col-start-3 ">
              <ComparativasRatio userData={userData} loading={loading} />
            </div>
          )}
          <div
            className={cn(
              "row-start-5 row-span-2 lg:row-start-3 lg:col-start-2 2xl:row-start-1 2xl:col-start-4",
              isStarterPlan ? "row-start-3" : ""
            )}
          >
            <ObjetivosCard loading={loading} userData={userData} />
          </div>

          <div
            className={cn(
              "row-start-7 row-span-2 col-start-1 lg:row-start-5 2xl:row-start-3 2xl:col-span-1",
              isStarterPlan
                ? "row-start-5 lg:row-start-3 2xl:row-start-1 2xl:col-start-3"
                : ""
            )}
          >
            <RenewableTramitesCalendar userData={userData} loading={loading} />
          </div>

          {!isStarterPlan && (
            <div className="row-start-9 row-span-2 lg:row-start-5 2xl:row-start-3 2xl:col-span-1 2xl:col-start-2">
              <ComparativasResume userData={userData} loading={loading} />
            </div>
          )}
          <div
            className={cn(
              "row-start-11 row-span-2 lg:col-span-2 lg:row-start-7 2xl:row-start-3 2xl:col-start-3",
              isStarterPlan ? "row-start-7 lg:row-start-5" : ""
            )}
          >
            <PersonalTramitesChart userData={userData} loading={loading} />
          </div>
          <div
            className={cn(
              "row-start-13 row-span-2 lg:col-span-2 lg:row-start-9 2xl:row-start-5 2xl:col-span-4",
              isStarterPlan
                ? "row-start-9 lg:row-start-7 2xl:row-start-3 2xl:col-span-2"
                : ""
            )}
          >
            <TeamTramitesBarChart loading={loading} userData={userData} />
          </div>
        </>
      )}
    </div>
  );
};

export const ComercialView = ({ userData, loading, getPlan }: Props) => {
  const [hasSubComerciales, setComercialHasSubComerciales] = useState(false);
  const isStarterPlan = getPlan() === "starter";
  const id = userData.id;
  const comercialHasSubComerciales = useCallback(async () => {
    const res = await fetch(`/api/users/get/${id}/subcomerciales`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const { success } = await res.json();
    if (success) {
      setComercialHasSubComerciales(true);
    } else {
      setComercialHasSubComerciales(false);
    }
  }, [id]);

  useEffect(() => {
    comercialHasSubComerciales();
  }, [comercialHasSubComerciales]);
  return (
    <div
      className={cn(
        "grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 items-stretch gap-4",
        isStarterPlan ? "lg:grid-cols-3" : ""
      )}
    >
      <div
        className={cn(
          "row-span-2 2xl:col-span-3",
          hasSubComerciales ? "2xl:col-span-2" : "",
          isStarterPlan ? "lg:col-span-2" : ""
        )}
      >
        <PersonalTramitesChart userData={userData} loading={loading} />
      </div>

      {hasSubComerciales ? (
        <>
          {!isStarterPlan && (
            <div className="row-span-2 lg:row-start-3 2xl:row-start-1 2xl:col-start-3 2xl:col-span-1">
              <ComparativasRatio userData={userData} loading={loading} />
            </div>
          )}
          <div
            className={cn(
              "row-span-2 lg:row-start-3 lg:col-start-2 2xl:row-start-1 2xl:col-start-4",
              isStarterPlan
                ? "lg:row-start-1 lg:col-start-3 2xl:col-start-4 2xl:col-span-1"
                : ""
            )}
          >
            <ObjetivosCard loading={loading} userData={userData} />
          </div>
          {!isStarterPlan && (
            <div className="row-span-2 lg:row-start-5 2xl:row-start-3 lg:col-span-2">
              <ComparativasResume userData={userData} loading={loading} />
            </div>
          )}
          <div
            className={cn(
              "lg:col-span-2 2xl:row-start-3 row-span-2",
              isStarterPlan ? "lg:col-span-3 2xl:col-span-4" : ""
            )}
          >
            <TeamTramitesBarChart loading={loading} userData={userData} />
          </div>
        </>
      ) : (
        <>
          {!isStarterPlan && (
            <div className="row-span-2 lg:row-start-3 2xl:row-start-1 2xl:col-start-4 2xl:col-span-1">
              <ComparativasRatio userData={userData} loading={loading} />
            </div>
          )}
          <div
            className={cn(
              "row-span-2 lg:row-start-3 lg:col-start-2 2xl:row-start-3 2xl:col-start-1 2xl:col-span-2",
              isStarterPlan
                ? "lg:row-start-1 lg:col-start-3 2xl:row-start-1 2xl:col-start-4"
                : ""
            )}
          >
            <ObjetivosCard loading={loading} userData={userData} />
          </div>
          {!isStarterPlan && (
            <div className="row-span-2 lg:row-start-5 lg:col-span-2 2xl:row-start-3 2xl:col-start-3">
              <ComparativasResume userData={userData} loading={loading} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export const BackofficeView = ({ userData, loading, getPlan }: Props) => {
  const isStarterPlan = getPlan() === "starter";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 items-stretch ">
      {!isStarterPlan && (
        <div className=" col-span-1 row-span-2">
          <ComparativasRatio userData={userData} loading={loading} />
        </div>
      )}

      {!isStarterPlan && (
        <div className="col-span-1 row-span-2">
          <ComparativasResume userData={userData} loading={loading} />
        </div>
      )}

      <div
        className={cn(
          "col-span-1 lg:col-span-2 2xl:col-span-1 row-span-2",
          isStarterPlan ? "lg:col-span-2" : ""
        )}
      >
        <RenewableTramitesCalendar
          loading={loading}
          userData={userData as User}
        />
      </div>

      <div className="col-span-1 lg:col-span-2 row-span-2 2xl:col-span-3">
        <PersonalTramitesChart userData={userData} loading={loading} />
      </div>
    </div>
  );
};
