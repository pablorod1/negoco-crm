import type React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AbarcaPanel } from "./AbarcaPanel";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: ({
    alt,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

const files = [
  {
    id: "file-1",
    comparativa_id: "comparison-1",
    filename: "Factura enero.pdf",
    size: 100,
    extension: "pdf",
    upload_date: "2026-01-01",
    download_url: "https://files.example/enero.pdf",
    preview_url: null,
  },
  {
    id: "file-2",
    comparativa_id: "comparison-1",
    filename: "Factura febrero.pdf",
    size: 100,
    extension: "pdf",
    upload_date: "2026-02-01",
    download_url: "https://files.example/febrero.pdf",
    preview_url: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockResolvedValue(
    new Response(JSON.stringify({ loginUrl: "about:blank" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
});

describe("AbarcaPanel file contract", () => {
  test("sends the selected file_id without client-controlled URLs or Abarca IDs", async () => {
    render(
      <AbarcaPanel
        comparativaId="comparison-1"
        onStudyCompleted={() => {}}
        files={files}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Estudio con IA" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Factura febrero\.pdf/ }),
    );

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    const requestInit = mocks.fetch.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(requestInit.body))).toEqual({
      comparativa_id: "comparison-1",
      file_id: "file-2",
    });
    expect(
      await screen.findByTitle("Comparador energético con IA"),
    ).toHaveAttribute(
      "sandbox",
      "allow-same-origin allow-scripts allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox",
    );
    expect(
      screen.getByText("Comparador energético con IA"),
    ).toBeVisible();
  });

  test("does not submit a PDF that has no server file ID", async () => {
    render(
      <AbarcaPanel
        comparativaId="comparison-1"
        onStudyCompleted={() => {}}
        files={[{ ...files[0], id: undefined }]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Estudio con IA" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "no tiene un identificador válido",
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  test.each([
    {
      name: "the comparator rejects the request",
      response: () => new Response("upstream error", { status: 502 }),
    },
    {
      name: "the network request fails",
      response: () => Promise.reject(new Error("network unavailable")),
    },
  ])("shows a generic connection error when $name", async ({ response }) => {
    mocks.fetch.mockImplementationOnce(response);

    render(
      <AbarcaPanel
        comparativaId="comparison-1"
        onStudyCompleted={() => {}}
        files={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Estudio con IA" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo conectar con el comparador",
    );
  });
});
