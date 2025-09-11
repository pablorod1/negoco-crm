/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { LayoutGrid, List } from "lucide-react";
import { User } from "@/core/types";
import { formatTimestamp } from "@/core/utils/format";
import { Button } from "@/core/components/ui/button";
import {
  ROLES,
  SELECT_ROLES,
} from "@/colaboradores/constants/colaborador.constants";
import AvatarComponent from "@/core/components/AvatarComponent";
import DeleteUserConfirmationModal from "./BanUserConfirmationModal";
import { useUser } from "@/core/contexts/UserContext";
import UnbanUserConfirmationModal from "./UnbanUserConfirmationModal";
import MultipleSelector, { Option } from "@/core/components/ui/multiselect";
import { useMultipleSelector } from "@/core/hooks/use-multiple-selector";
import { Input } from "@/core/components/ui/input";
import LoaderComponent from "@/core/components/LoaderComponent";

const columnHelper = createColumnHelper<User>();

function UsersGridTable({
  users,
  loading,
}: {
  users: User[];
  loading: boolean;
}) {
  const { userData } = useUser();
  const { convertToOptions, convertFromOptions } = useMultipleSelector();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [isGridView, setIsGridView] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);

  useEffect(() => {
    if (users.length > 0) {
      setFilteredUsers(users);
    }
  }, [users]);

  // Variable para verificar si el usuario actual es administrador
  const isAdmin = userData?.role === "admin";
  const isBackoffice = userData?.role === "1";

  // Columnas base que siempre se muestran - MINIMALISTA
  const baseColumns: ColumnDef<User, any>[] = [
    columnHelper.accessor("name", {
      cell: (info) => (
        <div className="flex items-center gap-3">
          <AvatarComponent
            userData={info.row.original}
            className="size-10 !rounded-full"
            textSize="text-sm"
          />
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-gray-900 truncate">
              {info.getValue()}
            </span>
            <span className="text-sm text-gray-500 truncate">
              {info.row.original.email}
            </span>
          </div>
        </div>
      ),
      header: "Usuario",
    }),

    columnHelper.accessor("role", {
      cell: (info) => (
        <span className="text-sm text-gray-600">
          {info.getValue() === "admin"
            ? "Dirección"
            : ROLES[parseInt(info.getValue())]}
        </span>
      ),
      header: "Rol",
    }),

    columnHelper.accessor("banned", {
      cell: (info) => (
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              info.getValue() ? "bg-red-400" : "bg-green-400"
            }`}
          />
          <span className="text-sm text-gray-600">
            {info.getValue() ? "Inactivo" : "Activo"}
          </span>
        </div>
      ),
      header: "Estado",
    }),

    columnHelper.accessor("organization", {
      cell: (info) =>
        info.getValue() ? (
          <div className="flex items-center gap-2 min-w-0">
            <Image
              src={(info.getValue().logo as string) || "/logo_200x200.png"}
              alt={`Logo ${info.row.original.organization.name}`}
              width={24}
              height={24}
              className="rounded-full flex-shrink-0"
            />
            <span className="text-sm text-gray-600 truncate">
              {info.row.original.company || info.row.original.organization.name}
            </span>
          </div>
        ) : (
          <span className="text-sm text-gray-400">Sin organización</span>
        ),
      header: "Organización",
    }),

    columnHelper.accessor("last_login", {
      cell: (info) => (
        <span className="text-xs text-gray-400">
          {info.getValue() ? formatTimestamp(info.getValue()) : "Nunca"}
        </span>
      ),
      header: "Último acceso",
    }),
  ];

  // Columna de acciones que solo se muestra para administradores
  const actionColumn: ColumnDef<User, string> = columnHelper.accessor("id", {
    cell: (info) => {
      if (info.row.original.banned) {
        return (
          <UnbanUserConfirmationModal
            userName={info.row.original.name}
            user_id={info.row.original.id}
          />
        );
      } else {
        return (
          <DeleteUserConfirmationModal
            userName={info.row.original.name}
            user_id={info.row.original.id}
          />
        );
      }
    },
    header: "Acciones",
  });

  // Combinamos las columnas según el rol
  const columns: ColumnDef<User, string>[] = isAdmin
    ? [...baseColumns, actionColumn]
    : baseColumns;

  const table = useReactTable({
    data: filteredUsers,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleRoleFilterChange = (selectedOptions: Option[]) => {
    const selectedRoles = convertFromOptions(selectedOptions);
    if (selectedRoles.length === 0) {
      setFilteredUsers(users);
      return;
    }
    const filtered = users.filter((user) => selectedRoles.includes(user.role));
    setFilteredUsers(filtered);
  };

  const handleNameFilterChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value.toLowerCase();

    const filtered = users.filter(
      (user) =>
        user.name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .includes(value) ||
        user.email.toLowerCase().includes(value) ||
        user.company?.toLowerCase().includes(value)
    );
    setFilteredUsers(filtered);
  };

  return (
    <div className="bg-white">
      {loading ? (
        <LoaderComponent
          title="Cargando usuarios..."
          description="Espere unos segundos mientras se cargan los datos de los usuarios."
        />
      ) : (
        <div className="space-y-6">
          {/* Controles minimalistas */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {(isAdmin || isBackoffice) && (
                <>
                  <Input
                    type="text"
                    name="name"
                    onChange={handleNameFilterChange}
                    placeholder="Buscar usuarios..."
                    className="w-80 h-9 border-gray-200 text-sm"
                  />
                  <MultipleSelector
                    options={convertToOptions(SELECT_ROLES)}
                    onChange={handleRoleFilterChange}
                    className="min-w-48"
                    placeholder="Filtrar por rol"
                  />
                </>
              )}
            </div>
            <Button
              onClick={() => setIsGridView(!isGridView)}
              size="sm"
              variant="outline"
              className="h-9 px-3 border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300"
            >
              {isGridView ? <List size={16} /> : <LayoutGrid size={16} />}
            </Button>
          </div>

          {/* Contenido */}
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-2xl text-gray-400">👥</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay usuarios
              </h3>
              <p className="text-sm text-gray-500">
                No se encontraron usuarios que coincidan con los filtros
                aplicados.
              </p>
            </div>
          ) : isGridView ? (
            <GridView users={filteredUsers} isAdmin={isAdmin} />
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full bg-white">
                <thead className="bg-gray-50 border-b border-gray-200">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <div className="flex items-center gap-1">
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            <span className="text-gray-400">
                              {{
                                asc: "↑",
                                desc: "↓",
                              }[header.column.getIsSorted() as string] ?? null}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="px-6 py-4 whitespace-nowrap"
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Vista Grid minimalista y elegante
function GridView({ users, isAdmin }: { users: User[]; isAdmin: boolean }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
      {users.map((user) => (
        <div
          key={user.id}
          className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all duration-200"
        >
          {/* Header con acciones */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <AvatarComponent
                userData={user}
                className="size-12 !rounded-full"
                textSize="text-lg"
              />
              <div className="min-w-0">
                <h3 className="font-medium text-gray-900 truncate">
                  {user.name}
                </h3>
                <p className="text-sm text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
            {isAdmin && (
              <div className="flex-shrink-0">
                {user.banned ? (
                  <UnbanUserConfirmationModal
                    userName={user.name}
                    user_id={user.id}
                  />
                ) : (
                  <DeleteUserConfirmationModal
                    userName={user.name}
                    user_id={user.id}
                  />
                )}
              </div>
            )}
          </div>

          {/* Información principal */}
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Rol</span>
              <span className="text-sm text-gray-700">
                {user.role === "admin"
                  ? "Dirección"
                  : ROLES[parseInt(user.role)]}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Estado</span>
              <div className="flex items-center gap-1">
                <div
                  className={`w-2 h-2 rounded-full ${
                    user.banned ? "bg-red-400" : "bg-green-400"
                  }`}
                />
                <span className="text-sm text-gray-700">
                  {user.banned ? "Inactivo" : "Activo"}
                </span>
              </div>
            </div>
          </div>

          {/* Organización */}
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <Image
                src={user.organization.logo || "/logo_200x200.png"}
                alt={`Logo ${user.organization.name}`}
                width={20}
                height={20}
                className="rounded-full flex-shrink-0"
              />
              <span className="text-xs text-gray-600 truncate">
                {user.company || user.organization.name}
              </span>
            </div>
            {user.last_login && (
              <p className="text-xs text-gray-400 mt-1">
                Último acceso: {formatTimestamp(user.last_login)}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default UsersGridTable;
