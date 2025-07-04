import { User } from "@/core/types";
import { useEffect, useState } from "react";
import { FirstForm, FirstFormError } from "@/core/validation/validation.types";
import AvatarComponent from "@/core/components/AvatarComponent";
import { ScrollArea } from "@/core/components/ui/scroll-area";
import { Button } from "@/core/components/ui/button";
import { showCustomToast } from "@/core/components/CustomToast";
import { CircleX } from "lucide-react";
import LoadingStateModal from "@/core/components/LoadingStateModal";
import { Input } from "@/core/components/ui/input";

interface Props {
  userData: User;
  formData: FirstForm;
  setFormData: React.Dispatch<React.SetStateAction<FirstForm>>;
  errors: FirstFormError;
}

export default function SelectSalesPerson({
  userData,
  formData,
  setFormData,
  errors,
}: Props) {
  const [comerciales, setComerciales] = useState<User[]>([]);
  const [selectedComercial, setSelectedComercial] = useState<string>(
    formData.user_id
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [filterValue, setFilterValue] = useState<string>("");

  useEffect(() => {
    const fetchComerciales = async () => {
      setLoading(true);
      if (!userData) {
        return;
      }
      try {
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
        }
      } catch (error) {
        console.error("Error fetching comerciales:", error);
        showCustomToast({
          title: "Error",
          message: "No se han podido cargar los comerciales.",
          icon: CircleX,
          iconColor: "var(--danger-color)",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchComerciales();
  }, [userData]);

  const handleSelectComercial = (
    id: string,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();
    const salesPerson = comerciales.find((comercial) => comercial.id === id);

    if (salesPerson) {
      setSelectedComercial(salesPerson.id);
      setFormData((prevState) => ({
        ...prevState,
        sales_name: salesPerson.name,
        user_id: salesPerson.id,
      }));
    }
  };

  const filteredComerciales = comerciales.filter((comercial) => {
    const { name, email } = comercial;
    const normalizedName = name
      .normalize("NFD")
      .toLowerCase()
      .replace(/[\u0300-\u036f]/g, "");
    const lowerCaseFilterValue = filterValue
      .normalize("NFD")
      .toLowerCase()
      .replace(/[\u0300-\u036f]/g, "");
    return (
      normalizedName.includes(lowerCaseFilterValue) ||
      email.toLowerCase().includes(lowerCaseFilterValue)
    );
  });

  return (
    <>
      {loading ? (
        <LoadingStateModal
          title="Cargando comerciales..."
          description="Espere unos segundos mientras cargamos sus comerciales."
        />
      ) : (
        <>
          <div className="w-full flex justify-between gap-4 items-center mb-4">
            <div className="flex flex-col gap-2 mt-4">
              <h2 className="flex items-start gap-1 text-xl font-bold text-primary-800">
                Selecciona el comercial{" "}
                <span className="text-red-500 text-sm">*</span>
              </h2>
              {errors.sales_name && (
                <span className="text-danger text-sm">{errors.sales_name}</span>
              )}
            </div>
            <Input
              name="search"
              placeholder="Busca por nombre o correo electrónico"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="max-w-sm w-full"
            />
          </div>
          <ScrollArea className="h-full w-full max-h-[300px]">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-center w-full py-2 px-4">
              {filteredComerciales.map((comercial) => (
                <Button
                  size={"card"}
                  variant={"outline"}
                  onClick={(e) => handleSelectComercial(comercial.id, e)}
                  key={comercial.id}
                  className={`w-full justify-start gap-2 border border-gray-100 shadow-md transition-all duration-200 ease-in-out ${
                    selectedComercial === comercial.id
                      ? "shadow-md shadow-primary-700/30 border-primary-100 bg-primary-50"
                      : "hover:bg-gray-50 hover:border-gray-200"
                  }`}
                >
                  <AvatarComponent
                    userData={comercial}
                    className="!rounded-full size-8"
                  />
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-semibold">
                      {comercial.name}
                    </span>
                    <span className="text-xs text-gray-500 text-ellipsis overflow-hidden whitespace-nowrap max-w-52 w-full">
                      {comercial.email}
                    </span>
                  </div>
                </Button>
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </>
  );
}

