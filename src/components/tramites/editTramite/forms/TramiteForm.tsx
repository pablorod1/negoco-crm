import { EditTramiteFormData, TramiteDB, User } from "@/lib/core/types";
import {
  InputComponent,
  SelectComponent,
} from "../../createTramite/InputComponent";
import {
  COMERCIAL_STATUS_TYPES,
  LIQUIDEZ_STATUS,
  STATUS_TYPES,
} from "@/lib/core/const";
import React, { useEffect } from "react";
import CheckComisionModal from "../../createTramite/CheckComisionModal";

interface Props {
  setFormData: React.Dispatch<React.SetStateAction<EditTramiteFormData>>;
  tramite: TramiteDB;
  userData: User;
  loading: boolean;
  checkComisionOpen: boolean;
  setCheckComisionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onSubmit: () => void;
}

export default function TramiteForm({
  tramite,
  setFormData,
  userData,
  loading,
  checkComisionOpen,
  setCheckComisionOpen,
  onSubmit,
}: Props) {
  const [comerciales, setComerciales] = React.useState<User[]>([]);

  const handleFieldChange = (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      tramite: {
        ...prev.tramite,
        [name]: value,
      },
    }));
  };

  const handleSelectComercial = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const salesPerson = comerciales.find(
      (comercial) => comercial.id === e.target.value
    );

    if (salesPerson) {
      setFormData((prevState) => ({
        ...prevState,
        tramite: {
          ...prevState.tramite,
          sales_name: salesPerson.name,
          user_id: salesPerson.id,
        },
      }));
    }
  };

  useEffect(() => {
    const fetchComerciales = async () => {
      const res = await fetch(`/api/users/get/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: userData.id, role: userData.role }),
      });
      const { success, data } = await res.json();

      if (!success) {
        return;
      }

      if (data) {
        setComerciales(data as User[]);
      }
    };

    if (!loading) fetchComerciales();
  }, [userData, loading]);
  return (
    <>
      <div className="flex items-stretch gap-4">
        <SelectComponent
          name="status"
          label="Estado"
          selectedKey={tramite.status}
          isRequired
          items={
            userData.role === "2" &&
            (tramite.status === "Borrador" || tramite.status === "Tramitable")
              ? COMERCIAL_STATUS_TYPES
              : STATUS_TYPES
          }
          onChange={handleFieldChange}
          disabled={
            (userData.role === "2" &&
              tramite.status !== "Borrador" &&
              tramite.status !== "Tramitable") ||
            !tramite.status
          }
        />
        <SelectComponent
          name="sales_name"
          label="Comercial"
          selectedKey={
            comerciales.find((comercial) => comercial.id === tramite.user_id)
              ? tramite.user_id
              : ""
          }
          isRequired
          items={comerciales}
          onChange={handleSelectComercial}
        />
        {userData.role === "2" && !userData.super_id && (
          <InputComponent
            name="comision_sales_person"
            label="Comisión Comercial"
            value={tramite.comision_sales_person.toString()}
            onChange={handleFieldChange}
            type="number"
            endContent="€"
            disabled={userData.role === "2"}
          />
        )}
        {userData.role !== "2" && (
          <InputComponent
            name="comision"
            label="Comisión"
            value={tramite.comision.toString()}
            onChange={handleFieldChange}
            type="number"
            endContent="€"
          />
        )}
      </div>
      {userData.role !== "2" && (
        <div className="flex items-stretch gap-4">
          <SelectComponent
            name="liquidez_status"
            label="Estado Liquidez"
            selectedKey={tramite.liquidez_status as string}
            isRequired
            items={LIQUIDEZ_STATUS}
            onChange={handleFieldChange}
          />

          <InputComponent
            name="comision_sales_person"
            label="Comisión Comercial"
            value={tramite.comision_sales_person.toString()}
            onChange={handleFieldChange}
            type="number"
            endContent="€"
          />
        </div>
      )}

      <CheckComisionModal
        tramite={tramite}
        isOpen={checkComisionOpen}
        onSubmit={onSubmit}
        onClose={() => setCheckComisionOpen(false)}
      />
    </>
  );
}
