import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import ComparadorPage from "./page";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  replace: vi.fn(),
  userData: undefined as
    | {
        organization: {
          plan: string;
          abarca_user_id?: number | null;
        };
      }
    | undefined,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/core/contexts/UserContext", () => ({
  useUser: () => ({
    userData: mocks.userData,
    loading: false,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.userData = {
    organization: {
      plan: "comparador",
      abarca_user_id: 321,
    },
  };
});

describe("ComparadorPage public copy", () => {
  test("shows the generic missing configuration message", async () => {
    mocks.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "not configured" }), {
        status: 409,
      }),
    );

    render(<ComparadorPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Comparador con IA no configurado",
    );
    expect(mocks.fetch).toHaveBeenCalledOnce();
  });

  test("shows a generic connection error when login fails", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("network unavailable"));

    render(<ComparadorPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo conectar con el comparador",
    );
  });

  test("uses the generic accessible title for the embedded comparator", async () => {
    let resolveLogin!: (response: Response) => void;
    mocks.fetch.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveLogin = resolve;
        }),
    );

    render(<ComparadorPage />);

    expect(screen.getByText("Cargando comparador...")).toBeInTheDocument();
    await act(async () => {
      resolveLogin(
        new Response(JSON.stringify({ loginUrl: "about:blank" }), {
          status: 200,
        }),
      );
    });

    const iframe = await screen.findByTitle("Comparador energético con IA");
    expect(iframe).toHaveAttribute(
      "sandbox",
      "allow-same-origin allow-scripts allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox",
    );
    expect(iframe).toHaveAttribute("referrerpolicy", "no-referrer");
    fireEvent.load(iframe);

    await waitFor(() =>
      expect(
        screen.queryByText("Cargando comparador..."),
      ).not.toBeInTheDocument(),
    );
    expect(mocks.fetch).toHaveBeenCalledWith(
      "/api/v2/integrations/abarca/standalone-login",
      { method: "POST" },
    );
  });

  test("delegates access to the endpoint and redirects forbidden sessions", async () => {
    mocks.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    );

    render(<ComparadorPage />);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/"));
    expect(mocks.fetch).toHaveBeenCalledOnce();
  });

  test("shows a generic error for non-successful login responses", async () => {
    mocks.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "sensitive" }), { status: 502 }),
    );

    render(<ComparadorPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo conectar con el comparador",
    );
    expect(screen.queryByText("Cargando comparador...")).not.toBeInTheDocument();
  });

  test("handles malformed success responses and supports retry", async () => {
    mocks.fetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ loginUrl: null }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ loginUrl: "about:blank" }), {
          status: 200,
        }),
      );

    render(<ComparadorPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo conectar con el comparador",
    );
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(
      await screen.findByTitle("Comparador energético con IA"),
    ).toBeInTheDocument();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
});
