import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import type { User } from "@/core/types";
import type { ComercializadoraVM } from "@/comercializadoras/types";
import { FileGrid } from "./FileGrid";

vi.mock("next-view-transitions", () => ({
  Link: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("./UploadFileModal", () => ({
  default: ({ initialFolderPath }: { initialFolderPath?: string }) => (
    <button type="button">Subir archivos ({initialFolderPath})</button>
  ),
}));

vi.mock("./SearchBar", () => ({
  default: () => <div data-testid="search-bar" />,
}));

const admin = {
  id: "admin-1",
  role: "admin",
  organization: { id: "org-1" },
} as User;

const comercial = { ...admin, id: "com-1", role: "2" } as User;

const supplier = (name: string): ComercializadoraVM => ({
  id: `COM-${name}`,
  name,
  active: true,
  logo: null,
  num_tramites: 0,
  num_files: 0,
  total_consumption: 0,
});

describe("FileGrid", () => {
  test("lists supplier folders in their own section before the other folders", () => {
    render(
      <FileGrid
        currentPath=""
        folderPath={[]}
        folders={["Manuales"]}
        supplierFolders={[
          { folderName: "Endesa", supplier: supplier("Endesa"), exists: true },
          {
            folderName: "Iberdrola",
            supplier: supplier("Iberdrola"),
            exists: false,
          },
        ]}
        userData={admin}
      />
    );

    const suppliersSection = screen
      .getByRole("heading", { name: "Comercializadoras" })
      .closest("section") as HTMLElement;
    expect(within(suppliersSection).getByText("Endesa")).toBeInTheDocument();
    expect(within(suppliersSection).getByText("Iberdrola")).toBeInTheDocument();

    const foldersSection = screen
      .getByRole("heading", { name: "Carpetas" })
      .closest("section") as HTMLElement;
    expect(within(foldersSection).getByText("Manuales")).toBeInTheDocument();
    expect(within(foldersSection).queryByText("Endesa")).not.toBeInTheDocument();
  });

  test("shows an empty state with the upload hint inside an empty folder", () => {
    render(
      <FileGrid
        currentPath="Endesa"
        folderPath={["Endesa"]}
        folders={[]}
        files={[]}
        handleBack={vi.fn()}
        userData={admin}
      />
    );

    expect(screen.getByText("Esta carpeta está vacía")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Subir archivos (Endesa)" })
    ).toBeInTheDocument();
  });

  test("keeps commercial users read-only in an empty folder", () => {
    render(
      <FileGrid
        currentPath="Endesa"
        folderPath={["Endesa"]}
        folders={[]}
        files={[]}
        handleBack={vi.fn()}
        userData={comercial}
      />
    );

    expect(
      screen.queryByRole("button", { name: /Subir archivos/ })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/cuando el administrador los comparta/)
    ).toBeInTheDocument();
  });

  test("navigates breadcrumbs through the callback with the full path when embedded", () => {
    const onNavigate = vi.fn();

    render(
      <FileGrid
        currentPath="Endesa/Contratos/2026"
        basePath="Endesa"
        folderPath={["Contratos", "2026"]}
        folders={[]}
        files={[]}
        handleBack={vi.fn()}
        onNavigate={onNavigate}
        userData={admin}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Contratos" }));

    expect(onNavigate).toHaveBeenCalledWith("Endesa/Contratos");
    expect(screen.queryByTestId("search-bar")).not.toBeInTheDocument();
  });
});
