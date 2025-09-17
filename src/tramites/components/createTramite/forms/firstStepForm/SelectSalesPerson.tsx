import { User } from "@/core/types";
import { useEffect, useState } from "react";
import { FirstForm, FirstFormError } from "@/core/validation/validation.types";
import AvatarComponent from "@/core/components/AvatarComponent";
import { ScrollArea } from "@/core/components/ui/scroll-area";
import { showCustomToast } from "@/core/components/CustomToast";
import {
  CircleX,
  Search,
  Check,
  UserX,
  AlertCircle,
  User as UserIcon,
} from "lucide-react";
import LoadingStateModal from "@/core/components/LoadingStateModal";
import { Input } from "@/core/components/ui/input";
import { Badge } from "@/core/components/ui/badge";
import { Card, CardContent } from "@/core/components/ui/card";

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
        <div className="space-y-6">
          {/* Step Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-primary-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                Seleccionar comercial
              </h2>
            </div>
            <p className="text-sm text-gray-600">
              Elige el comercial responsable de este trámite
            </p>
          </div>

          {/* Search and Selection */}
          <div className="space-y-4">
            {/* Smart Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                name="search"
                placeholder="Busca por nombre o correo electrónico..."
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="pl-10 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
              />
            </div>

            {/* Selection Grid */}
            <div className="space-y-3">
              {selectedComercial && (
                <div className="p-4 bg-primary-50 rounded-4xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <AvatarComponent
                          userData={
                            comerciales.find((c) => c.id === selectedComercial)!
                          }
                          className="!rounded-full size-10"
                        />
                        <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-1">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {
                            comerciales.find((c) => c.id === selectedComercial)
                              ?.name
                          }
                        </p>
                        <p className="text-sm text-gray-600">
                          {
                            comerciales.find((c) => c.id === selectedComercial)
                              ?.email
                          }
                        </p>
                      </div>
                    </div>
                    <Badge variant="successShadow">Seleccionado</Badge>
                  </div>
                </div>
              )}

              <ScrollArea className="h-full w-full max-h-[280px] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3 p-1">
                  {filteredComerciales.map((comercial) => (
                    <Card
                      key={comercial.id}
                      className={`cursor-pointer transition-all duration-200 ease-in-out hover:shadow-md ${
                        selectedComercial === comercial.id
                          ? "ring-2 ring-primary-200 bg-primary-50 border-primary-200"
                          : "hover:bg-gray-50 hover:border-gray-300"
                      }`}
                      onClick={() =>
                        handleSelectComercial(comercial.id, {
                          preventDefault: () => {},
                        } as React.MouseEvent<HTMLButtonElement>)
                      }
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <AvatarComponent
                            userData={comercial}
                            className="!rounded-full size-8"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {comercial.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {comercial.email}
                            </p>
                          </div>
                          {selectedComercial === comercial.id && (
                            <Check className="h-4 w-4 text-primary-600 flex-shrink-0" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {filteredComerciales.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <UserX className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No se encontraron comerciales</p>
                    <p className="text-xs text-gray-400">
                      Intenta con un término de búsqueda diferente
                    </p>
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Validation Error */}
            {errors.sales_name && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-red-700">
                    {errors.sales_name}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
