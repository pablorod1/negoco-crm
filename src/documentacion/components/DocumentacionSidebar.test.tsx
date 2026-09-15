import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import DocumentacionSidebar from "./DocumentacionSidebar";

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

vi.mock("next/navigation", () => ({
  usePathname: () => "/documentacion/Manuales",
}));

vi.mock("@/core/contexts/UserContext", () => ({
  useUser: () => ({ userData: { id: "u1", organization: { id: "org-1" } } }),
}));

vi.mock("@/documentacion/contexts/DocumentLibrarySuppliersContext", () => ({
  useDocumentLibrarySuppliers: () => ({
    loading: false,
    suppliers: [
      {
        id: "COM-1",
        name: "Endesa",
        active: true,
        logo: "endesa.webp",
        num_tramites: 0,
        num_files: 0,
        total_consumption: 0,
      },
      {
        id: "COM-2",
        name: "Iberdrola",
        active: true,
        logo: null,
        num_tramites: 0,
        num_files: 0,
        total_consumption: 0,
      },
    ],
  }),
}));

vi.mock("@/core/firebase/data/getFolders", () => ({
  getAllFoldersWithPaths: vi.fn().mockResolvedValue({
    success: true,
    data: ["Manuales", "Manuales/2026", "ENDESA"],
  }),
}));

describe("DocumentacionSidebar", () => {
  test("lists supplier folders with their logo, virtual ones included", async () => {
    render(<DocumentacionSidebar />);

    expect(await screen.findByAltText("Logo de Endesa")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ENDESA/ })).toHaveAttribute(
      "href",
      "/documentacion/ENDESA"
    );
    expect(screen.getByRole("link", { name: /Iberdrola/ })).toHaveAttribute(
      "title",
      "Iberdrola · sin documentos"
    );
  });

  test("keeps the other folders in a collapsed section and highlights the current one", async () => {
    render(<DocumentacionSidebar />);

    await screen.findByAltText("Logo de Endesa");
    expect(
      screen.queryByRole("link", { name: /Manuales/ })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Carpetas/ }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Manuales/ })).toHaveClass(
        "font-medium"
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Expandir" }));

    expect(screen.getByRole("link", { name: /2026/ })).toHaveAttribute(
      "href",
      "/documentacion/Manuales/2026"
    );
  });
});
