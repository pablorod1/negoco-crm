import { NextRequest } from "next/server";
import type { DelayUnit } from "./types";

export const cleanProviderName = (name: string) =>
  name.replace(/\s+/g, " ").trim();

export const normalizeProviderName = (name: string) =>
  cleanProviderName(name).toLowerCase();

export const delayToMinutes = (value: number, unit: DelayUnit) => {
  const safeValue = Math.max(0, Math.trunc(value));

  switch (unit) {
    case "days":
      return safeValue * 24 * 60;
    case "hours":
      return safeValue * 60;
    case "minutes":
      return safeValue;
  }
};

export const minutesToDelayInput = (
  minutes: number,
): { delay_value: number; delay_unit: DelayUnit } => {
  if (minutes > 0 && minutes % 1440 === 0) {
    return { delay_value: minutes / 1440, delay_unit: "days" };
  }

  if (minutes > 0 && minutes % 60 === 0) {
    return { delay_value: minutes / 60, delay_unit: "hours" };
  }

  return { delay_value: minutes, delay_unit: "minutes" };
};

export const addMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60_000);

export const addOneYear = (date: Date) => {
  const nextYear = new Date(date);
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  return nextYear;
};

const getTenantSlugFromHost = (host: string) => {
  const firstSegment = host.split(".")[0]?.replace(/:\d+$/, "").toLowerCase();
  if (!firstSegment || firstSegment.includes("localhost")) return "test";
  return firstSegment;
};

export const getTenantInfoFromRequest = (request: NextRequest) => {
  const host = request.headers.get("host");
  if (!host) {
    throw new Error("No host found in request headers");
  }

  return {
    tenant_slug: getTenantSlugFromHost(host),
    tenant_host: host,
  };
};

export const getOriginFromHost = (host: string) => {
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
};
