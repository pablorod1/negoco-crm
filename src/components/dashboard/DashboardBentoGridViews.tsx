import { User } from "@/lib/core/types";
import { ComparativasRatio } from "./charts/ComparativasRatio";
import { YearlyTramitesBarChart } from "./charts/YearlyTramitesBarChart";
import RenewableTramitesCalendar from "./renewable/RenewableTramitesCalendar";
import { PersonalTramitesChart } from "./charts/PersonalTramitesBarChart";
import { TeamTramitesBarChart } from "./charts/TeamTramitesBarChar";
import { useCallback, useEffect, useState } from "react";
import { ComparativasResume } from "./comparativas/ComparativasResume";
import { ObjetivosCard } from "./objectives/ObjectivesSection";

interface Props {
  userData: User;
  loading: boolean;
}

export const DireccionView = ({ userData, loading }: Props) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 items-stretch gap-4">
      <div className="lg:col-span-2 row-span-2">
        <YearlyTramitesBarChart loading={loading} userData={userData} />
      </div>
      <div className="row-start-3 row-span-2  2xl:row-start-1 2xl:col-start-3 ">
        <ComparativasRatio userData={userData} loading={loading} />
      </div>
      <div className="row-start-5 row-span-2 lg:row-start-3 lg:col-start-2 2xl:row-start-1 2xl:col-start-4 ">
        <ObjetivosCard loading={loading} userData={userData} />
      </div>

      <div className="row-start-7 row-span-2 col-start-1 lg:row-start-5 2xl:row-start-3 2xl:col-span-1">
        <RenewableTramitesCalendar userData={userData} loading={loading} />
      </div>

      <div className="row-start-9 row-span-2  lg:row-start-5 2xl:row-start-3 2xl:col-span-1 2xl:col-start-2">
        <ComparativasResume userData={userData} loading={loading} />
      </div>
      <div className="row-start-11 row-span-2 lg:col-span-2 lg:row-start-7 2xl:row-start-3 2xl:col-start-3">
        <PersonalTramitesChart userData={userData} loading={loading} />
      </div>
      <div className="row-start-13  row-span-2 lg:col-span-2 lg:row-start-9 2xl:row-start-5 2xl:col-span-4">
        <TeamTramitesBarChart loading={loading} userData={userData} />
      </div>
    </div>
  );
};

export const ComercialView = ({ userData, loading }: Props) => {
  const [hasSubComerciales, setComercialHasSubComerciales] = useState(false);
  const id = userData.id;
  const comercialHasSubComerciales = useCallback(async () => {
    const res = await fetch(`/api/users/get/subcomerciales`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
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
    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 items-stretch gap-4">
      <div className="row-span-2 lg:col-span-2">
        <PersonalTramitesChart userData={userData} loading={loading} />
      </div>
      <div className="row-span-2 lg:row-start-3 2xl:row-start-1 2xl:col-start-3">
        <ComparativasRatio userData={userData} loading={loading} />
      </div>
      <div className="row-span-2 lg:row-start-3 lg:col-start-2 2xl:row-start-1 2xl:col-start-4">
        <ObjetivosCard loading={loading} userData={userData} />
      </div>

      {hasSubComerciales ? (
        <>
          <div className="row-span-2 lg:row-start-5 2xl:row-start-3">
            <RenewableTramitesCalendar
              loading={loading}
              userData={userData as User}
            />
          </div>
          <div className="row-span-2 lg:row-start-5 lg:col-start-2 2xl:row-start-3 2xl:col-span-1 2xl:col-start-2">
            <ComparativasResume userData={userData} loading={loading} />
          </div>
          <div className="lg:col-span-2  2xl:row-start-3 row-span-2">
            <TeamTramitesBarChart loading={loading} userData={userData} />
          </div>
        </>
      ) : (
        <>
          <div className="row-span-2 lg:row-start-5 2xl:row-start-3 2xl:col-span-2">
            <RenewableTramitesCalendar
              loading={loading}
              userData={userData as User}
            />
          </div>
          <div className="row-span-2 lg:row-start-5 2xl:col-span-2 2xl:row-start-3 2xl:col-start-3">
            <ComparativasResume userData={userData} loading={loading} />
          </div>
        </>
      )}
    </div>
  );
};

interface BackofficeProps {
  userData: User;
  loading: boolean;
}

export const BackofficeView = ({ userData, loading }: BackofficeProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-4 items-stretch ">
      <div className=" col-span-1 row-span-2">
        <ComparativasRatio userData={userData} loading={loading} />
      </div>

      <div className="col-span-1 row-span-2">
        <ComparativasResume userData={userData} loading={loading} />
      </div>

      <div className="col-span-1 sm:col-span-2 xl:col-span-2 row-span-2">
        <RenewableTramitesCalendar
          loading={loading}
          userData={userData as User}
        />
      </div>

      <div className="col-span-1 sm:col-span-2 xl:col-span-4">
        <PersonalTramitesChart userData={userData} loading={loading} />
      </div>
    </div>
  );
};
