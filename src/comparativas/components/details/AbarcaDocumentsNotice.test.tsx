import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import type { AbarcaWebhookDocument } from "@/comparativas/types";
import { AbarcaDocumentsNotice } from "./AbarcaDocumentsNotice";

function document(
  overrides: Partial<AbarcaWebhookDocument> &
    Pick<AbarcaWebhookDocument, "field" | "status">,
): AbarcaWebhookDocument {
  return {
    download_url: null,
    reason: null,
    size: null,
    ...overrides,
  };
}

describe("AbarcaDocumentsNotice", () => {
  test("renders nothing when every document arrived", () => {
    const { container } = render(
      <AbarcaDocumentsNotice
        documents={[
          document({ field: "comparativa_pdf", status: "stored" }),
          document({ field: "dni_photo_back", status: "stored" }),
        ]}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  test("renders nothing for comparisons without webhook documents", () => {
    const { container } = render(
      <AbarcaDocumentsNotice documents={undefined} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  test("names the document the comparator never sent", () => {
    render(
      <AbarcaDocumentsNotice
        documents={[document({ field: "dni_photo_back", status: "missing" })]}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "DNI (reverso): el comparador no lo envió",
    );
  });

  test("explains an oversized document in megabytes", () => {
    render(
      <AbarcaDocumentsNotice
        documents={[
          document({
            field: "dni_photo_front",
            status: "invalid",
            reason: "inline_too_large:5242880",
          }),
        ]}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "superaba el tamaño máximo (5.0 MB)",
    );
  });

  test("offers the original of a quarantined document", () => {
    render(
      <AbarcaDocumentsNotice
        documents={[
          document({
            field: "justo_titulo",
            status: "quarantined",
            download_url: "https://storage.example/justo_titulo.bin",
          }),
        ]}
      />,
    );

    expect(
      screen.getByRole("link", { name: "descargar el original" }),
    ).toHaveAttribute("href", "https://storage.example/justo_titulo.bin");
  });
});
