"use client";
import FormWrapper from "@/components/tramites/createTramite/FormWrapper";
import {
  InputComponent,
  SelectComponent,
} from "@/components/tramites/createTramite/InputComponent";
import { ComparativaDB, ComparativaPlan, User } from "@/lib/core/types";
import { Button } from "@heroui/react";
import { Select, SelectItem } from "@heroui/select";
import { useEffect, useState } from "react";

interface Props {
  userData: User;
  comparativa: ComparativaDB;
  setComparativa: React.Dispatch<React.SetStateAction<ComparativaDB>>;
  onCancel: () => void;
  onNext: () => void;
}

export default function FirstStepForm({
  userData,
  comparativa,
  setComparativa,
  onCancel,
  onNext,
}: Props) {
  const [comerciales, setComerciales] = useState<User[]>([]);

  useEffect(() => {
    const fetchComerciales = async () => {
      const res = await fetch(`/api/users/get/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: userData?.id,
          role: userData?.role,
        }),
      });
      const { success, data } = await res.json();

      if (!success) {
        return;
      }

      if (data) {
        setComerciales(data as User[]);
      }
    };
    fetchComerciales();
  }, [userData]);

  const handleFieldChange = (
    e:
      | React.ChangeEvent<HTMLSelectElement>
      | React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setComparativa({
      ...comparativa,
      [name]: value,
    });
  };

  // Función corregida para manejar selección múltiple correctamente
  const handlePlanChange = (values: string[]) => {
    // Convertir array de strings a array de ComparativaPlan
    const selectedPlans = values.map((value) => value as ComparativaPlan);

    setComparativa({
      ...comparativa,
      plan: selectedPlans,
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onNext();
  };

  return (
    <FormWrapper>
      <form onSubmit={handleSubmit} className="w-full">
        <div className="flex flex-col gap-y-4 w-full">
          <div className="flex items-stretch gap-4 w-full">
            <SelectComponent
              name="user_id"
              label="Comercial"
              selectedKey={
                comerciales.find(
                  (comercial) => comercial.id === comparativa.user_id
                )
                  ? comparativa.user_id
                  : ""
              }
              isRequired
              items={comerciales}
              onChange={handleFieldChange}
            />
            <InputComponent
              type="text"
              name="client"
              label="Cliente"
              value={comparativa.client}
              onChange={handleFieldChange}
              isRequired
            />
          </div>
          <div className="flex items-stretch gap-4 w-full">
            <SelectComponent
              name="service"
              label="Servicio"
              items={["Luz", "Gas"]}
              onChange={handleFieldChange}
              isRequired
              selectedKey={comparativa.service}
            />
            <Select
              name="plan"
              label="Plan"
              size="lg"
              variant="bordered"
              color="primary"
              radius="sm"
              isRequired
              selectionMode="multiple"
              selectedKeys={comparativa.plan || []}
              onSelectionChange={(keys) =>
                handlePlanChange(Array.from(keys) as string[])
              }
            >
              <SelectItem key="fijo" textValue="Fijo">
                Fijo
              </SelectItem>
              <SelectItem key="indexado" textValue="Indexado">
                Indexado
              </SelectItem>
            </Select>
          </div>
          <div className="w-full justify-end flex gap-4">
            <Button
              variant="light"
              color="danger"
              onPress={onCancel}
              type="button"
              radius="sm"
            >
              Cancelar
            </Button>
            <Button radius="sm" color="primary" variant="solid" type="submit">
              Siguiente
            </Button>
          </div>
        </div>
      </form>
    </FormWrapper>
  );
}
