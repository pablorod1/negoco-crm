/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import { useState } from "react";
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
import { User } from "@/lib/core/types";
import { formatTimestamp } from "@/lib/core/format";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { ROLES } from "@/lib/core/const";
import AvatarComponent from "../core/AvatarComponent";
import DeleteUserConfirmationModal from "./BanUserConfirmationModal";
import { useUser } from "@/lib/contexts/UserContext";
import UnbanUserConfirmationModal from "./UnbanUserConfirmationModal";
import SpinnerComponent from "../core/SpinnerComponent";

const columnHelper = createColumnHelper<User>();

function UsersGridTable({
  users,
  loading,
}: {
  users: User[];
  loading: boolean;
}) {
  const { userData } = useUser();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [isGridView, setIsGridView] = useState(false);

  // Variable para verificar si el usuario actual es administrador
  const isAdmin = userData?.role === "admin";

  // Columnas base que siempre se muestran
  const baseColumns: ColumnDef<User, any>[] = [
    columnHelper.accessor("name", {
      cell: (info) =>
        info.getValue() ? (
          <div className="flex items-center gap-4">
            <AvatarComponent
              userData={info.row.original}
              className="size-12 !rounded-full"
              textSize="text-lg"
            />
            <div className="flex flex-col">
              <span>{info.getValue()}</span>
              <span className="text-gray-500 text-sm">
                {info.row.original.email}
              </span>
            </div>
          </div>
        ) : (
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-gray-500 text-xl">
              {info.row.original.name.charAt(0)}
            </span>
          </div>
        ),
      header: "Usuario",
    }),

    columnHelper.accessor("role", {
      cell: (info) =>
        info.getValue() === "admin"
          ? "Dirección"
          : ROLES[parseInt(info.getValue())],
      header: "Rol",
    }),
    columnHelper.accessor("created_at", {
      cell: (info) => formatTimestamp(info.getValue()),
      header: "Fecha de Creación",
    }),
    columnHelper.accessor("banned", {
      cell: (info) => (info.getValue() ? "Inactivo" : "Activo"),
      header: "Estado",
    }),
    columnHelper.accessor("organization", {
      cell: (info) =>
        info.getValue() ? (
          <div className="flex items-center gap-4">
            <Image
              src={(info.getValue().logo as string) || "/logo_sin_letras.webp"}
              alt={`Avatar for ${info.row.original.name}`}
              width={32}
              height={32}
              className="rounded-full"
            />
            <span>{info.row.original.organization.name}</span>
          </div>
        ) : (
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-gray-500 text-xl">
              {info.row.original.name.charAt(0)}
            </span>
          </div>
        ),
      header: "Organización",
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
    data: users,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <section className="relative">
      {loading ? (
        <div className="w-full h-44 flex items-center justify-center">
          <SpinnerComponent userData={userData as User} />
        </div>
      ) : (
        <>
          <div className="flex justify-end mb-4">
            <Button
              onPress={() => setIsGridView(!isGridView)}
              isIconOnly
              variant="ghost"
              color="primary"
            >
              {isGridView ? <List size={18} /> : <LayoutGrid size={18} />}
            </Button>
          </div>
          {isGridView ? (
            <GridView users={users} isAdmin={isAdmin} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-300">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="bg-gray-100">
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="py-2 px-4 text-left text-sm font-semibold text-gray-600 cursor-pointer"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {{
                            asc: " 🔼",
                            desc: " 🔽",
                          }[header.column.getIsSorted() as string] ?? null}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-gray-200 hover:bg-gray-50"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="p-4 text-sm text-gray-800">
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
        </>
      )}
    </section>
  );
}

// Actualizamos GridView para recibir la bandera isAdmin en lugar de todo el userData
function GridView({ users, isAdmin }: { users: User[]; isAdmin: boolean }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {users.map((user) => (
        <div
          key={user.id}
          className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-100"
        >
          {/* Header con color de fondo según el rol */}
          <div
            className={`h-3 w-full ${
              user.role === "admin" ? "bg-purple-500" : "bg-blue-500"
            }`}
          ></div>

          <div className="p-6 relative">
            {/* Botón de eliminar, solo visible para administradores */}
            {isAdmin && (
              <div className="absolute top-0 right-1">
                <DeleteUserConfirmationModal
                  userName={user.name}
                  user_id={user.id}
                />
              </div>
            )}

            <div className="flex flex-col items-center text-center mb-4">
              {/* Avatar con borde */}
              <div className="mb-4 p-1 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full">
                <AvatarComponent
                  userData={user}
                  className="size-20 !rounded-full shadow-sm border-2 border-white"
                  textSize="text-3xl"
                />
              </div>

              {/* Nombre y correo */}
              <h3 className="text-lg font-semibold mb-1 text-gray-800">
                {user.name}
              </h3>
              <p className="text-sm text-gray-600 mb-2">{user.email}</p>

              {/* Badge del rol */}
              <div className="flex justify-center items-center gap-2 w-full">
                <Chip
                  size="sm"
                  variant="flat"
                  color={
                    user.role === "admin" || user.role === "backoffice"
                      ? "secondary"
                      : "primary"
                  }
                  className="font-bold"
                >
                  {user.role === "admin"
                    ? "Dirección"
                    : ROLES[parseInt(user.role)]}
                </Chip>
                <Chip
                  size="sm"
                  variant="dot"
                  color={user.banned ? "danger" : "success"}
                  className="font-bold"
                >
                  {user.banned ? "Inactivo" : "Activo"}
                </Chip>
              </div>
            </div>

            {/* Línea divisoria */}
            <div className="border-t border-gray-100 my-3"></div>

            {/* Información de la organización */}
            <div className="flex items-center gap-3 mt-3">
              <div className="bg-gray-50 p-1 rounded-full">
                <Image
                  src={user.organization.logo || "/logo_sin_letras.webp"}
                  alt={`Logo de ${user.organization.name}`}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">
                  {user.organization.name}
                </p>
              </div>
            </div>

            {/* Fechas */}
            <div className="mt-4 text-xs text-gray-500 flex justify-between">
              <div>
                <p>Creado: {formatTimestamp(user.created_at)}</p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default UsersGridTable;
