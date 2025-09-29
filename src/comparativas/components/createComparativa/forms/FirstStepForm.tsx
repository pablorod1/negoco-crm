"use client";
import { showCustomToast } from "@/core/components/CustomToast";
import FormWrapper from "@/tramites/components/createTramite/FormWrapper";
import { InputComponent } from "@/tramites/components/createTramite/InputComponent";
import { Label } from "@/core/components/ui/label";
import MultipleSelector, { Option } from "@/core/components/ui/multiselect";
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

const convertToOptions = (users: User[]): Option[] => {
  return users.map((user) => ({
    value: user.id,
    label: user.name,
    icon: user.image || undefined,
  }));
};

export default function FirstStepForm({
  userData,
  comparativa,
  setComparativa,
  onCancel,
  onNext,
}: Props) {
  const [comerciales, setComerciales] = useState<User[]>([]);
  const [selectedComercialOptions, setSelectedComercialOptions] = useState<
    Option[]
  >([]);
  const [selectedServiceOptions, setSelectedServiceOptions] = useState<
    Option[]
  >([]);
  const [selectedPlanOptions, setSelectedPlanOptions] = useState<Option[]>([]);
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
      const url = `/api/v2/users/${userData.id}/all?role=${encodeURIComponent(
        userData.role
      )}`;
      const res = await fetch(url, { method: "GET" });

      const { success, error, data } = await res.json();

      if (!success) {
        showCustomToast({
          title: "Error",
          message: error,
          icon: CircleX,
          iconColor: "var(--danger-color)",
          iconSize: 24,
        });
        return;
      }

      if (data) {
        setComerciales(data as User[]);
        // Inicializar el comercial seleccionado si ya hay uno en comparativa
        if (comparativa.user_id) {
          const comercial = data.find(
            (c: User) => c.id === comparativa.user_id
          );
          if (comercial) {
            setSelectedComercialOptions([
              { value: comercial.id, label: comercial.name },
            ]);
          }
        }
      }
    };
    fetchComerciales();
  }, [userData, comparativa.user_id]);

  // Inicializar opciones seleccionadas cuando cambie comparativa
  useEffect(() => {
    // Inicializar servicio
    if (comparativa.service) {
      setSelectedServiceOptions([
        { value: comparativa.service, label: comparativa.service },
      ]);
    }

    // Inicializar planes
    if (comparativa.plan && comparativa.plan.length > 0) {
      const planOptions = comparativa.plan.map((plan) => ({
        value: plan,
        label: plan === "fijo" ? "Fijo" : "Indexado",
      }));
      setSelectedPlanOptions(planOptions);
    }
  }, [comparativa.service, comparativa.plan]);

  const handleComercialChange = (options: Option[]) => {
    setSelectedComercialOptions(options);
    const comercialId = options.length > 0 ? options[0].value : "";
    setComparativa({
      ...comparativa,
      user_id: comercialId,
    });
  };

  const handleServiceChange = (options: Option[]) => {
    setSelectedServiceOptions(options);
    const service =
      options.length > 0 ? (options[0].value as "Luz" | "Gas") : undefined;
    if (service) {
      setComparativa({
        ...comparativa,
        service: service,
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setComparativa({
      ...comparativa,
      [name]: value,
    });
  };

  const handlePlanChange = (options: Option[]) => {
    setSelectedPlanOptions(options);
    const selectedPlans = options.map(
      (option) => option.value as ComparativaPlan
    );
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

  const handleSearchComercial = async (inputValue: string) => {
    if (inputValue.trim() === "") {
      return convertToOptions(comerciales);
    }
    // Aquí podrías implementar una búsqueda en el backend si es necesario
    return convertToOptions(
      comerciales.filter((comercial) =>
        comercial.name.toLowerCase().includes(inputValue.toLowerCase())
      )
    );
  };

  return (
    <FormWrapper>
      <form onSubmit={handleSubmit} className="w-full space-y-4">
        {/* Simplified form fields in 2x2 grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Comercial Field */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Comercial <span className="text-red-500 text-xs">*</span>
            </Label>
            <MultipleSelector
              value={selectedComercialOptions}
              onChange={handleComercialChange}
              options={convertToOptions(comerciales)}
              placeholder="Selecciona un comercial..."
              maxSelected={1}
              hidePlaceholderWhenSelected
              onSearch={handleSearchComercial}
              triggerSearchOnFocus={true}
              commandProps={{
                filter: (value: string, search: string) => {
                  // Buscar por label (nombre) en lugar de por value (id)
                  const option = convertToOptions(comerciales).find(
                    (opt) => opt.value === value
                  );
                  if (option) {
                    return option.label
                      .toLowerCase()
                      .includes(search.toLowerCase())
                      ? 1
                      : 0;
                  }
                  return 0;
                },
              }}
            />
            {errors.user_id && (
              <p className="text-red-600 text-xs">{errors.user_id}</p>
            )}
          </div>

          {/* Cliente Field */}
          <div className="space-y-2">
            <InputComponent
              type="text"
              name="client"
              label="Cliente"
              value={comparativa.client}
              onChange={handleInputChange}
              errors={errors.client}
            />
          </div>

          {/* Servicio Field */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Servicio <span className="text-red-500 text-xs">*</span>
            </Label>
            <MultipleSelector
              value={selectedServiceOptions}
              onChange={handleServiceChange}
              options={[
                { value: "Luz", label: "Luz" },
                { value: "Gas", label: "Gas" },
              ]}
              placeholder="Selecciona un servicio..."
              maxSelected={1}
              hidePlaceholderWhenSelected
            />
            {errors.service && (
              <p className="text-red-600 text-xs">{errors.service}</p>
            )}
          </div>

          {/* Plan Field */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Plan(es) <span className="text-red-500 text-xs">*</span>
            </Label>
            <MultipleSelector
              value={selectedPlanOptions}
              onChange={handlePlanChange}
              options={[
                { value: "fijo", label: "Fijo" },
                { value: "indexado", label: "Indexado" },
              ]}
              placeholder="Selecciona uno o más planes..."
              maxSelected={2}
            />
            {errors.plan && (
              <p className="text-red-600 text-xs">{errors.plan}</p>
            )}
          </div>
        </div>

        {/* Simplified Navigation Controls */}
        <div className="flex items-center justify-between pt-4">
          <Button variant="outline" onClick={onCancel} type="button">
            Cancelar
          </Button>
          <Button type="submit">Siguiente</Button>
        </div>
      </form>
    </FormWrapper>
  );
}
