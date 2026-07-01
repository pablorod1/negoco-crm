import { describe, expect, test, vi } from "vitest";
import {
  findContractByIntegrationRef,
  getSelectedImaginaRate,
  recordWebhookEvent,
  upsertContractIntegrationRef,
} from "./persistence";
import { IMAGINA_PROVIDER } from "./config";

const resultSet = (rows: unknown[] = []) => ({
  columns: [],
  columnTypes: [],
  rows,
  rowsAffected: rows.length,
  lastInsertRowid: undefined,
  toJSON() {
    return this;
  },
});

type ExecuteInput = { sql: string; args: unknown[] };

describe("Imagina webhook persistence", () => {
  test("deduplicates webhook events by request_id", async () => {
    const events: Array<{ id: string; event_type: string; request_id: string }> =
      [];
    const db = {
      execute: vi.fn(async ({ sql, args }: ExecuteInput) => {
        if (String(sql).includes("SELECT id FROM imagina_webhook_events")) {
          const existing = events.find(
            (event) =>
              event.event_type === args[0] && event.request_id === args[2],
          );
          return resultSet(existing ? [{ id: existing.id }] : []);
        }
        if (String(sql).includes("INSERT INTO imagina_webhook_events")) {
          events.push({
            id: String(args[0]),
            event_type: String(args[1]),
            request_id: String(args[2]),
          });
        }
        return resultSet();
      }),
    };

    const first = await recordWebhookEvent(db as never, {
      eventType: "contratacion",
      requestId: 123,
      payload: { request_id: 123 },
      publicUrl:
        "https://tenant.negoco.test/api/webhooks/imagina-energia/contratacion",
    });
    const second = await recordWebhookEvent(db as never, {
      eventType: "contratacion",
      requestId: 123,
      payload: { request_id: 123 },
      publicUrl:
        "https://tenant.negoco.test/api/webhooks/imagina-energia/contratacion",
    });

    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    expect(events).toHaveLength(1);
  });

  test("deduplicates contract change events by notification_id", async () => {
    const events: Array<{
      id: string;
      event_type: string;
      notification_id: string;
    }> = [];
    const db = {
      execute: vi.fn(async ({ sql, args }: ExecuteInput) => {
        if (String(sql).includes("SELECT id FROM imagina_webhook_events")) {
          const existing = events.find(
            (event) =>
              event.event_type === args[0] && event.notification_id === args[4],
          );
          return resultSet(existing ? [{ id: existing.id }] : []);
        }
        if (String(sql).includes("INSERT INTO imagina_webhook_events")) {
          events.push({
            id: String(args[0]),
            event_type: String(args[1]),
            notification_id: String(args[3]),
          });
        }
        return resultSet();
      }),
    };

    const first = await recordWebhookEvent(db as never, {
      eventType: "contratos",
      notificationId: 5,
      payload: { _metadata: { notification_id: 5 } },
      publicUrl:
        "https://tenant.negoco.test/api/webhooks/imagina-energia/contratos",
    });
    const second = await recordWebhookEvent(db as never, {
      eventType: "contratos",
      notificationId: 5,
      payload: { _metadata: { notification_id: 5 } },
      publicUrl:
        "https://tenant.negoco.test/api/webhooks/imagina-energia/contratos",
    });

    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    expect(events).toHaveLength(1);
  });
});

describe("Imagina contract integration refs", () => {
  test("upserts provider-scoped external references", async () => {
    const statements: ExecuteInput[] = [];
    const db = {
      execute: vi.fn(async (statement: ExecuteInput) => {
        statements.push(statement);
        return resultSet();
      }),
    };

    await upsertContractIntegrationRef(db as never, {
      provider: IMAGINA_PROVIDER,
      tramiteId: "TR-1",
      contractId: "CTR-1",
      externalContractId: 123,
      externalContractCode: "IM-123",
      externalReference: "NEG-1",
      requestId: "REQ-1",
      status: "Activa",
      substatus: "OK",
    });

    expect(statements).toHaveLength(2);
    expect(String(statements[0].sql)).toContain(
      "INSERT INTO contract_integration_refs",
    );
    expect(String(statements[1].sql)).toContain(
      "WHERE provider = ? AND contract_id = ?",
    );
    expect(statements[1].args.at(-2)).toBe(IMAGINA_PROVIDER);
    expect(statements[1].args.at(-1)).toBe("CTR-1");
  });

  test("finds local contract by provider-scoped external id or code", async () => {
    const db = {
      execute: vi.fn(async ({ sql, args }: ExecuteInput) => {
        expect(String(sql)).toContain("contract_integration_refs ref");
        expect(args[0]).toBe(IMAGINA_PROVIDER);
        return resultSet([{ id: "CTR-1", tramite_id: "TR-1" }]);
      }),
    };

    const result = await findContractByIntegrationRef(
      db as never,
      IMAGINA_PROVIDER,
      {
        externalContractId: 123,
        externalContractCode: "IM-123",
      },
    );

    expect(result).toEqual({ id: "CTR-1", tramite_id: "TR-1" });
  });

  test("requires Imagina provider and enabled tariff when selecting a rate", async () => {
    const db = {
      execute: vi.fn(async ({ sql, args }: ExecuteInput) => {
        expect(String(sql)).toContain("provider = ?");
        expect(String(sql)).toContain("enabled = 1");
        expect(args).toEqual([IMAGINA_PROVIDER, "rate-1", "rate-1"]);
        return resultSet([
          {
            id: "rate-1",
            provider: IMAGINA_PROVIDER,
            external_rate_id: "11001",
            enabled: 1,
          },
        ]);
      }),
    };

    const rate = await getSelectedImaginaRate(db as never, {
      rate_id: "rate-1",
    } as never);

    expect(rate?.external_rate_id).toBe("11001");
  });
});
