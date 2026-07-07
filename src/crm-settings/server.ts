import type { Client } from "@libsql/client";
import type {
  CrmProviderOption,
  CrmSettings,
  ProcessingAutoActivationSettings,
} from "./types";
import {
  cleanProviderName,
  delayToMinutes,
  minutesToDelayInput,
  normalizeProviderName,
} from "./utils";

const SETTINGS_ID = 1;

export interface CrmSettingsPayload {
  providers?: string[];
  processing_auto_activation?: {
    enabled: boolean;
    delay_value: number;
    delay_unit: "minutes" | "hours" | "days";
  };
}

export const normalizeProviderList = (providers: string[]) => {
  const seen = new Set<string>();
  const normalizedProviders: { name: string; normalized_name: string }[] = [];

  for (const provider of providers) {
    const name = cleanProviderName(provider);
    if (!name) continue;

    const normalizedName = normalizeProviderName(name);
    if (seen.has(normalizedName)) continue;

    seen.add(normalizedName);
    normalizedProviders.push({ name, normalized_name: normalizedName });
  }

  return normalizedProviders;
};

export async function ensureCrmSettings(client: Client) {
  await client.execute({
    sql: `INSERT OR IGNORE INTO crm_automation_settings (
      id,
      processing_auto_activate_enabled,
      processing_auto_activate_delay_minutes,
      created_at,
      updated_at
    ) VALUES (?, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    args: [SETTINGS_ID],
  });
}

const mapAutomationSettings = (row: Record<string, unknown>) => {
  const delayMinutes = Number(row.processing_auto_activate_delay_minutes) || 0;
  const displayDelay = minutesToDelayInput(delayMinutes);

  return {
    enabled: Number(row.processing_auto_activate_enabled) === 1,
    delay_minutes: delayMinutes,
    ...displayDelay,
  } satisfies ProcessingAutoActivationSettings;
};

export async function getCrmSettings(client: Client): Promise<CrmSettings> {
  await ensureCrmSettings(client);

  const [providersResponse, settingsResponse] = await Promise.all([
    client.execute({
      sql: `SELECT id, name, normalized_name, sort_order, created_at, updated_at
        FROM crm_provider_options
        ORDER BY sort_order ASC, name ASC`,
      args: [],
    }),
    client.execute({
      sql: `SELECT
          processing_auto_activate_enabled,
          processing_auto_activate_delay_minutes
        FROM crm_automation_settings
        WHERE id = ?`,
      args: [SETTINGS_ID],
    }),
  ]);

  const settingsRow = settingsResponse.rows[0] ?? {
    processing_auto_activate_enabled: 0,
    processing_auto_activate_delay_minutes: 0,
  };

  return {
    providers: providersResponse.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      normalized_name: String(row.normalized_name),
      sort_order: Number(row.sort_order) || 0,
      created_at: row.created_at ? String(row.created_at) : null,
      updated_at: row.updated_at ? String(row.updated_at) : null,
    })),
    processing_auto_activation: mapAutomationSettings(settingsRow),
  };
}

export async function updateCrmSettings(
  client: Client,
  payload: CrmSettingsPayload,
): Promise<CrmSettings> {
  await ensureCrmSettings(client);

  if (payload.providers !== undefined) {
    const providers = normalizeProviderList(payload.providers);
    const tx = await client.transaction();

    try {
      await tx.execute({ sql: "DELETE FROM crm_provider_options", args: [] });

      for (const [index, provider] of providers.entries()) {
        await tx.execute({
          sql: `INSERT INTO crm_provider_options (
              id,
              name,
              normalized_name,
              sort_order,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          args: [
            crypto.randomUUID(),
            provider.name,
            provider.normalized_name,
            index,
          ],
        });
      }

      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  if (payload.processing_auto_activation !== undefined) {
    const delayMinutes = delayToMinutes(
      payload.processing_auto_activation.delay_value,
      payload.processing_auto_activation.delay_unit,
    );

    await client.execute({
      sql: `UPDATE crm_automation_settings
        SET processing_auto_activate_enabled = ?,
            processing_auto_activate_delay_minutes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      args: [
        payload.processing_auto_activation.enabled ? 1 : 0,
        delayMinutes,
        SETTINGS_ID,
      ],
    });
  }

  return getCrmSettings(client);
}

export async function getProviderOptions(client: Client) {
  const settings = await getCrmSettings(client);
  return settings.providers;
}

export function isProviderAllowed(
  providers: CrmProviderOption[],
  providerValue: string | null,
  currentProviderValue?: string | null,
) {
  const normalizedProvider = normalizeProviderName(providerValue || "");
  if (!normalizedProvider) return true;
  if (providers.length === 0) return true;

  const configuredProviderNames = new Set(
    providers.map((provider) => provider.normalized_name),
  );
  if (configuredProviderNames.has(normalizedProvider)) return true;

  if (
    currentProviderValue &&
    normalizeProviderName(currentProviderValue) === normalizedProvider
  ) {
    return true;
  }

  return false;
}
