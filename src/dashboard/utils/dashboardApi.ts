/**
 * API endpoints for dashboard data fetching
 * Updated to use new RESTful API structure
 */
export const DASHBOARD_API_ENDPOINTS = {
  // New consolidated endpoint for hero data
  HERO_DATA: "/api/v2/analytics",

  // New unified contract analytics endpoint (maintains POST compatibility)
  CLIENTS_COUNT: "/api/v2/analytics/contracts",
  ACTIVE_PENDING: "/api/v2/analytics/contracts", // Uses PATCH method
  COMISIONES_PENDIENTES: "/api/v2/analytics/contracts",
  MONTHLY_COMISIONES: "/api/v2/analytics/contracts",
  TOTAL_CONSUMPTION: "/api/v2/analytics/contracts",

  // New comparison analytics endpoint
  COMPLETED_COUNT: "/api/v2/analytics/comparisons",

  // Team performance endpoint
  TEAM_TRAMITES: "/api/v2/analytics/team-performance",
} as const;

/**
 * Common headers for API requests
 */
export const API_HEADERS = {
  "Content-Type": "application/json",
} as const;

/**
 * Helper functions for API calls with proper method and parameter handling
 */
export const dashboardAPI = {
  // Dashboard hero data (POST method)
  getHeroData: async (id: string, role: string) => {
    const response = await fetch(DASHBOARD_API_ENDPOINTS.HERO_DATA, {
      method: "POST",
      headers: API_HEADERS,
      body: JSON.stringify({ id, role }),
    });
    return response.json();
  },

  // Contract analytics (GET with query params or POST with body)
  getClientsCount: async (id: string, role: string) => {
    const response = await fetch(
      `${DASHBOARD_API_ENDPOINTS.CLIENTS_COUNT}?metric=clients-count&id=${id}&role=${role}`,
      {
        method: "GET",
        headers: API_HEADERS,
      }
    );
    return response.json();
  },

  getActivePending: async (id: string, role: string) => {
    const response = await fetch(DASHBOARD_API_ENDPOINTS.ACTIVE_PENDING, {
      method: "PATCH",
      headers: API_HEADERS,
      body: JSON.stringify({ id, role }),
    });
    return response.json();
  },

  getPendingCommissions: async (id: string, role: string) => {
    const response = await fetch(
      `${DASHBOARD_API_ENDPOINTS.COMISIONES_PENDIENTES}?metric=comisiones-pendientes&id=${id}&role=${role}`,
      {
        method: "GET",
        headers: API_HEADERS,
      }
    );
    return response.json();
  },

  getTotalConsumption: async (id: string, role: string) => {
    const response = await fetch(
      `${DASHBOARD_API_ENDPOINTS.TOTAL_CONSUMPTION}?metric=total-consumption&id=${id}&role=${role}`,
      {
        method: "GET",
        headers: API_HEADERS,
      }
    );
    return response.json();
  },

  getMonthlyCommissions: async (id: string, role: string) => {
    const response = await fetch(DASHBOARD_API_ENDPOINTS.MONTHLY_COMISIONES, {
      method: "POST",
      headers: API_HEADERS,
      body: JSON.stringify({ id, role }),
    });
    return response.json();
  },

  // Comparison analytics
  getCompletedCount: async (id: string, role: string) => {
    const response = await fetch(DASHBOARD_API_ENDPOINTS.COMPLETED_COUNT, {
      method: "POST",
      headers: API_HEADERS,
      body: JSON.stringify({ id, role }),
    });
    return response.json();
  },

  getConvertedRatio: async (id: string, role: string, month: string) => {
    const response = await fetch(
      `/api/v2/analytics/comparisons?metric=converted-ratio&id=${id}&role=${role}&month=${month}`,
      {
        method: "GET",
        headers: API_HEADERS,
      }
    );
    return response.json();
  },

  getComparativesByStatus: async (id: string, role: string, status: string) => {
    const response = await fetch(
      `/api/v2/analytics/comparisons?metric=by-status&id=${id}&role=${role}&status=${status}`,
      {
        method: "GET",
        headers: API_HEADERS,
      }
    );
    return response.json();
  },

  // Team performance
  getTeamPerformance: async (
    id: string,
    role: string,
    timeRange: string = "all_time"
  ) => {
    const response = await fetch(
      `${DASHBOARD_API_ENDPOINTS.TEAM_TRAMITES}?id=${id}&role=${role}&time_range=${timeRange}`,
      {
        method: "GET",
        headers: API_HEADERS,
      }
    );
    return response.json();
  },
};
