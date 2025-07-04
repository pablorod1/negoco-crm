/**
 * API endpoints for dashboard data fetching
 */
export const DASHBOARD_API_ENDPOINTS = {
  // Consolidated endpoint for hero data
  HERO_DATA: "/api/dashboard/get/hero-data",

  // Legacy endpoints (kept for backward compatibility)
  CLIENTS_COUNT: "/api/tramites/get/clients-count",
  ACTIVE_PENDING: "/api/tramites/get/active-pending",
  COMISIONES_PENDIENTES: "/api/tramites/get/comisiones-pendientes",
  MONTHLY_COMISIONES: "/api/tramites/get/monthly-comisiones",
  COMPLETED_COUNT: "/api/comparativas/get/completed-count",
} as const;

/**
 * Common headers for API requests
 */
export const API_HEADERS = {
  "Content-Type": "application/json",
} as const;
