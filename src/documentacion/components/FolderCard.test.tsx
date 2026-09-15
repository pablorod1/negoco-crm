import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import type { User } from "@/core/types";
import { FolderCard } from "./FolderCard";

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

const admin = {
  id: "admin-1",
  role: "admin",
  organization: { id: "org-1" },
} as User;

describe("FolderCard", () => {
  test("renders a plain folder linking to its documentation route", () => {
    render(<FolderCard name="Manuales" currentPath="" userData={admin} />);

    expect(screen.getByRole("link", { name: /Manuales/ })).toHaveAttribute(
      "href",
      "/documentacion/Manuales"
    );
    expect(screen.getByText("Carpeta")).toBeInTheDocument();
  });

  test("renders the supplier logo and label for a supplier folder", () => {
    render(
      <FolderCard
        name="Endesa"
        currentPath=""
        userData={admin}
        supplier={{ name: "Endesa", logo: "endesa.webp", active: true }}
      />
    );

    expect(screen.getByAltText("Logo de Endesa")).toHaveAttribute(
      "src",
      expect.stringContaining("endesa.webp")
    );
    expect(screen.getByText("Comercializadora")).toBeInTheDocument();
    // Carpeta protegida: sin mover, renombrar ni eliminar
    expect(
      screen.queryByRole("button", { name: "Acciones de Endesa" })
    ).not.toBeInTheDocument();
  });

  test("offers move, rename and delete on a regular folder for admins", () => {
    render(<FolderCard name="Manuales" currentPath="" userData={admin} />);

    fireEvent.click(screen.getByRole("button", { name: "Acciones de Manuales" }));

    expect(screen.getByRole("button", { name: "Mover a…" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Renombrar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeInTheDocument();
  });

  test("hides the actions menu from commercial users", () => {
    const comercial = { ...admin, role: "2" } as User;
    render(<FolderCard name="Manuales" currentPath="" userData={comercial} />);

    expect(
      screen.queryByRole("button", { name: "Acciones de Manuales" })
    ).not.toBeInTheDocument();
  });

  test("marks virtual supplier folders and hides the delete menu", () => {
    render(
      <FolderCard
        name="Iberdrola"
        currentPath=""
        userData={admin}
        supplier={{ name: "Iberdrola", logo: null, active: true }}
        exists={false}
      />
    );

    expect(
      screen.getByText("Comercializadora · sin documentos")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  test("navigates through the callback with the full path when embedded", () => {
    const onNavigate = vi.fn();

    render(
      <FolderCard
        name="Contratos"
        currentPath="Endesa"
        userData={admin}
        onNavigate={onNavigate}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /^Contratos/ }));

    expect(onNavigate).toHaveBeenCalledWith("Endesa/Contratos");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
