import { User } from "@/lib/core/types";
import { SelectComponent } from "../../InputComponent";
import { useEffect, useState } from "react";
import { FirstForm } from "@/lib/validation/validation.types";

interface Props {
  userData: User;
  formData: FirstForm;
  setFormData: React.Dispatch<React.SetStateAction<FirstForm>>;
  errors: string;
}

export default function SelectSalesPerson({
  userData,
  formData,
  setFormData,
  errors,
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
  const handleSelectComercial = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const salesPerson = comerciales.find(
      (comercial) => comercial.id === e.target.value
    );

    if (salesPerson) {
      setFormData((prevState) => ({
        ...prevState,
        sales_name: salesPerson.name,
        user_id: salesPerson.id,
      }));
    }
  };
  return (
    <SelectComponent
      name="sales_name"
      label="Comercial"
      selectedKey={
        comerciales.find((comercial) => comercial.id === formData.user_id)
          ? formData.user_id
          : ""
      }
      isRequired
      items={comerciales}
      onChange={handleSelectComercial}
      errors={errors}
    />
  );
}
