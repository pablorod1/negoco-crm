// @vitest-environment node
import { describe, expect, test } from "vitest";
import { BACKOFFICE_HEADERS, signBackofficeRequest, verifyBackofficeRequest } from "./backoffice-auth";

const SECRET = "secreto-compartido";
const NOW = Date.parse("2026-10-17T10:00:00Z");
const URL_ = "https://api.comparador.negococloud.es/api/internal/comparador/beenergy/ingests/abc";

function signed({
  body = '{"action":"reject"}',
  reviewer = "pablo@negococloud.es",
  timestamp = String(NOW / 1000),
  method = "POST",
  url = URL_,
  signWith = { body, reviewer, method, path: new URL(url).pathname },
} = {}) {
  const signature = signBackofficeRequest({ secret: SECRET, timestamp, ...signWith });
  return {
    request: new Request(url, {
      method,
      headers: {
        [BACKOFFICE_HEADERS.timestamp]: timestamp,
        [BACKOFFICE_HEADERS.reviewer]: reviewer,
        [BACKOFFICE_HEADERS.signature]: signature,
      },
    }),
    body,
  };
}

describe("backoffice requests", () => {
  test("a request signed with the shared secret says who reviews", () => {
    const { request, body } = signed();
    expect(verifyBackofficeRequest(request, body, { secret: SECRET, now: NOW })).toEqual({ reviewer: "pablo@negococloud.es" });
  });

  test("changing the body, the reviewer, the path or the method breaks the signature", () => {
    const { request } = signed();
    expect(verifyBackofficeRequest(request, '{"action":"approve"}', { secret: SECRET, now: NOW })).toBeNull();
    const otherReviewer = signed({ signWith: { body: '{"action":"reject"}', reviewer: "otro@negococloud.es", method: "POST", path: new URL(URL_).pathname } });
    expect(verifyBackofficeRequest(otherReviewer.request, otherReviewer.body, { secret: SECRET, now: NOW })).toBeNull();
    const otherTenant = signed({ url: URL_.replace("beenergy", "nasertel"), signWith: { body: '{"action":"reject"}', reviewer: "pablo@negococloud.es", method: "POST", path: new URL(URL_).pathname } });
    expect(verifyBackofficeRequest(otherTenant.request, otherTenant.body, { secret: SECRET, now: NOW })).toBeNull();
  });

  test("old signatures, a missing secret or a wrong one are refused", () => {
    const { request, body } = signed({ timestamp: String(NOW / 1000 - 600) });
    expect(verifyBackofficeRequest(request, body, { secret: SECRET, now: NOW })).toBeNull();
    const fresh = signed();
    expect(verifyBackofficeRequest(fresh.request, fresh.body, { secret: "", now: NOW })).toBeNull();
    expect(verifyBackofficeRequest(fresh.request, fresh.body, { secret: "otro", now: NOW })).toBeNull();
  });
});
