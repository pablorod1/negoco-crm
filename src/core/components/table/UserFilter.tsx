import { showCustomToast } from "@/core/components/CustomToast";
import { Label } from "@/core/components/ui/label";
import { Switch } from "@/core/components/ui/switch";
import MultipleSelector, { Option } from "@/core/components/ui/multiselect";
import { User } from "@/core/types";
import { CircleX } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "../ui/skeleton";

interface Props {
  userFilter: string[] | undefined;
  setUserFilter: (value: string[] | undefined) => void;
  isComercial: boolean;
  userData: User;
  excludeUser?: boolean;
  setExcludeUser?: (value: boolean) => void;
}

// Helper functions for converting between formats
const convertToOptions = (users: UserOption[]): Option[] => {
  return users.map((user) => ({
    value: user.value,
    label: user.label,
    icon: user.icon,
  }));
};

const convertFromOptions = (options: Option[]): string[] => {
  return options.map((option) => option.value);
};

const getSelectedOptions = (
  selectedValues: string[] | undefined,
  allUsers: UserOption[]
): Option[] => {
  if (!selectedValues) return [];
  return allUsers
    .filter((user) => selectedValues.includes(user.value))
    .map((user) => ({
      value: user.value,
      label: user.label,
      icon: user.icon,
    }));
};

interface UserOption {
  value: string;
  label: string;
  icon?: string;
}

export default function UserFilter({
  userFilter,
  setUserFilter,
  isComercial,
  userData,
  excludeUser,
  setExcludeUser,
}: Props) {
  const [comerciales, setComerciales] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const fetchComerciales = useCallback(async () => {
    setLoading(true);
    if (isComercial || !userData) {
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

      const options = data.map((user: User) => ({
        value: user.id,
        label: user.name,
        icon: user.image || undefined,
      }));
      setComerciales(options);
    } catch (error) {
      console.error("Error al obtener comerciales:", error);
      showCustomToast({
        title: "Error",
        message: "Error al obtener comerciales",
        icon: CircleX,
        iconColor: "var(--danger-color)",
        iconSize: 24,
      });
    } finally {
      setLoading(false);
    }
  }, [isComercial, userData]);

  // Fetch comerciales when the component mounts or when isComercial changes
  useEffect(() => {
    fetchComerciales();
  }, [fetchComerciales]);

  const handleSearch = async (searchTerm: string) => {
    if (searchTerm.trim() === "") {
      return convertToOptions(comerciales);
    }

    const filtered = comerciales.filter((user) =>
      user.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return convertToOptions(filtered);
  };

  if (loading) {
    return <Skeleton className="h-10 w-full rounded-4xl" />;
  }
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-700">Comercial</Label>

      <MultipleSelector
        value={getSelectedOptions(userFilter, comerciales)}
        defaultOptions={convertToOptions(comerciales)}
        onChange={(options) => setUserFilter(convertFromOptions(options))}
        placeholder="Seleccionar comercial"
        hidePlaceholderWhenSelected
        onSearch={handleSearch}
        emptyIndicator={
          <p className="text-center text-sm text-gray-500">
            No se encontraron comerciales
          </p>
        }
      />
      {userFilter && userFilter.length > 0 && setExcludeUser && (
        <div className="flex items-center gap-2">
          <Switch
            id="exclude-user"
            checked={excludeUser}
            onCheckedChange={setExcludeUser}
          />
          <Label
            htmlFor="exclude-user"
            className="text-xs text-gray-500 cursor-pointer"
          >
            Excluir comerciales seleccionados
          </Label>
        </div>
      )}
    </div>
  );
}
