"use client";
import { showCustomToast } from "@/core/components/CustomToast";
import FormWrapper from "@/tramites/components/createTramite/FormWrapper";
import {
  InputComponent,
  SelectComponent,
} from "@/tramites/components/createTramite/InputComponent";
import { Label } from "@/core/components/ui/label";
import { MultiSelect } from "@/core/components/ui/multi-select";
import { User } from "@/core/types";
import { Button } from "@/core/components/ui/button";
import { CircleX } from "lucide-react";
import { useEffect, useState } from "react";
import { ComparativaDB, ComparativaPlan } from "@/comparativas/types";

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
  const [selectedComercial, setSelectedComercial] = useState<string>("");
  const [errors, setErrors] = useState({
    user_id: "",
    client: "",
    service: "",
    plan: "",
  });

  useEffect(() => {
    const fetchComerciales = async () => {
      if (!userData) {
        return;
      }
      const res = await fetch(`/api/users/get/${userData.id}/all`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: userData.role,
        }),
      });
      const { success, data } = await res.json();

      if (!success) {
        return;
      }

      if (data) {
        setComerciales(data as User[]);
        setSelectedComercial(
          data.find((c: User) => c.id === userData.id)?.name || ""
        );
      }
    };
    fetchComerciales();
  }, [userData]);

  const handleSelectChange = (value: string, name: string) => {
    if (name === "user_id") {
      const comercial = comerciales.find((c) => c.id === value);
      if (comercial) {
        setSelectedComercial(comercial.name);
      }
    }
    setComparativa({
      ...comparativa,
      [name]: value,
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const validateFields = () => {
    const requiredFields = ["user_id", "client", "service", "plan"];
    for (const field of requiredFields) {
      if (
        !comparativa[field as keyof ComparativaDB] ||
        comparativa[field as keyof ComparativaDB] === "" ||
        (Array.isArray(comparativa[field as keyof ComparativaDB]) &&
          (comparativa[field as keyof ComparativaDB] as ComparativaPlan[])
            .length === 0)
      ) {
        setErrors((prevState) => ({
          ...prevState,
          [field]: "Este campo es obligatorio",
        }));
        return false;
      }
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateFields()) {
      showCustomToast({
        title: "Error de validación",
        message: "Por favor, completa todos los campos obligatorios.",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
      return;
    }
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
              selectedKey={comparativa.user_id}
              textValue={selectedComercial || ""}
              isRequired
              items={comerciales}
              onChange={(value) => handleSelectChange(value, "user_id")}
              errors={errors.user_id}
            />
            <InputComponent
              type="text"
              name="client"
              label="Cliente"
              value={comparativa.client}
              onChange={handleInputChange}
              errors={errors.client}
            />
          </div>
          <div className="flex items-stretch gap-4 w-full">
            <SelectComponent
              name="service"
              label="Servicio"
              items={["Luz", "Gas"]}
              onChange={(value) => handleSelectChange(value, "service")}
              isRequired
              selectedKey={comparativa.service}
              errors={errors.service}
            />
            <div className="w-full ">
              <Label>
                Plan <span className="text-red-500">*</span>
              </Label>
              <MultiSelect
                modalPopover
                name="plan"
                value={comparativa.plan || []}
                defaultValue={comparativa.plan || []}
                onValueChange={handlePlanChange}
                options={[
                  { label: "Fijo", value: "fijo" },
                  { label: "Indexado", value: "indexado" },
                ]}
                variant="primary"
                maxCount={2}
              />
              {errors.plan && (
                <p className="text-red-500 text-sm">{errors.plan}</p>
              )}
            </div>
          </div>
          <div className="w-full justify-between flex gap-4 mt-4">
            <Button variant="destructive" onClick={onCancel} type="button">
              Cancelar
            </Button>
            <Button type="submit">Siguiente</Button>
          </div>
        </div>
      </form>
    </FormWrapper>
  );
}
