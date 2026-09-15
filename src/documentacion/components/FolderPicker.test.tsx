import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { ComercializadoraVM } from "@/comercializadoras/types";
import { buildFolderTree } from "@/documentacion/lib/folder-tree";
import { FolderPicker } from "./FolderPicker";

const supplier = (name: string, logo: string | null = null): ComercializadoraVM => ({
  id: `COM-${name}`,
  name,
  active: true,
  logo,
  num_tramites: 0,
  num_files: 0,
  total_consumption: 0,
});

const tree = buildFolderTree(
  ["Manuales", "Manuales/2026", "Endesa", "Endesa/Contratos"],
  [supplier("Endesa", "endesa.webp"), supplier("Iberdrola")]
);

describe("FolderPicker", () => {
  test("shows suppliers with their logo and virtual folders flagged", () => {
    render(<FolderPicker tree={tree} value="/" onChange={vi.fn()} />);

    expect(screen.getByAltText("Logo de Endesa")).toBeInTheDocument();
    const iberdrola = screen.getByRole("button", { name: /Iberdrola/ });
    expect(within(iberdrola).getByText("sin documentos")).toBeInTheDocument();
    expect(screen.getByText("Comercializadoras")).toBeInTheDocument();
    expect(screen.getByText("Carpetas")).toBeInTheDocument();
  });

  test("marks the selected folder and selects on click", () => {
    const onChange = vi.fn();
    render(<FolderPicker tree={tree} value="/" onChange={onChange} />);

    expect(screen.getByRole("button", { name: /Inicio/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: /Manuales/ }));

    expect(onChange).toHaveBeenCalledWith("Manuales");
  });

  test("keeps the branch of the selected folder expanded", () => {
    render(
      <FolderPicker tree={tree} value="Manuales/2026" onChange={vi.fn()} />
    );

    expect(screen.getByRole("button", { name: /2026/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(
      screen.queryByRole("button", { name: /Contratos/ })
    ).not.toBeInTheDocument();
  });

  test("expands and collapses a folder with the chevron", () => {
    render(<FolderPicker tree={tree} value="/" onChange={vi.fn()} />);

    const expanders = screen.getAllByRole("button", { name: "Expandir" });
    fireEvent.click(expanders[0]);

    expect(screen.getByRole("button", { name: /Contratos/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Contraer" }));

    expect(
      screen.queryByRole("button", { name: /Contratos/ })
    ).not.toBeInTheDocument();
  });

  test("filters the tree by name, expanding the matches", () => {
    render(<FolderPicker tree={tree} value="/" onChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Buscar carpeta"), {
      target: { value: "contra" },
    });

    expect(screen.getByRole("button", { name: /Contratos/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Manuales/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Inicio/ })
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Buscar carpeta"), {
      target: { value: "zzz" },
    });

    expect(screen.getByText(/Ninguna carpeta coincide/)).toBeInTheDocument();
  });
});
