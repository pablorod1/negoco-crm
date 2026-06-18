import { describe, expect, test, vi } from "vitest";
import { recordWebhookEvent } from "./persistence";

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
