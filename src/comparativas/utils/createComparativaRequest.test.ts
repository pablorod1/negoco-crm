import { describe, expect, test, vi } from "vitest";
import { createComparativaRequest } from "./createComparativaRequest";

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("createComparativaRequest", () => {
  test("retries a network failure and returns the eventual success", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("network unavailable"))
      .mockResolvedValueOnce(jsonResponse({ success: true }, 200));
    const wait = vi.fn().mockResolvedValue(undefined);

    const result = await createComparativaRequest(new FormData(), {
      fetcher,
      wait,
    });

    expect(result).toEqual({ success: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledOnce();
  });

  test("retries a server failure with the same FormData instance", async () => {
    const formData = new FormData();
    formData.append("comparativa", JSON.stringify({ id: "CMP-1" }));
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ success: false, error: "Temporary failure" }, 503),
      )
      .mockResolvedValueOnce(jsonResponse({ success: true }, 200));

    const result = await createComparativaRequest(formData, {
      fetcher,
      wait: vi.fn().mockResolvedValue(undefined),
    });

    expect(result).toEqual({ success: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][1]?.body).toBe(formData);
    expect(fetcher.mock.calls[1][1]?.body).toBe(formData);
  });

  test("does not retry a permanent client error", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ success: false, error: "Invalid data format" }, 400),
      );
    const wait = vi.fn().mockResolvedValue(undefined);

    const result = await createComparativaRequest(new FormData(), {
      fetcher,
      wait,
    });

    expect(result).toEqual({
      success: false,
      error: "Invalid data format",
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(wait).not.toHaveBeenCalled();
  });

  test("returns the final server error after exhausting retries", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ success: false, error: "Failure 1" }, 500),
      )
      .mockResolvedValueOnce(
        jsonResponse({ success: false, error: "Failure 2" }, 500),
      )
      .mockResolvedValueOnce(
        jsonResponse({ success: false, error: "Failure 3" }, 500),
      );
    const wait = vi.fn().mockResolvedValue(undefined);

    const result = await createComparativaRequest(new FormData(), {
      fetcher,
      wait,
    });

    expect(result).toEqual({ success: false, error: "Failure 3" });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  test("retries an invalid transient response body", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("upstream error", { status: 502 }))
      .mockResolvedValueOnce(jsonResponse({ success: true }, 200));

    const result = await createComparativaRequest(new FormData(), {
      fetcher,
      wait: vi.fn().mockResolvedValue(undefined),
    });

    expect(result).toEqual({ success: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
