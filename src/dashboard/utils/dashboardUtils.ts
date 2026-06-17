/**
 * Utility functions for dashboard operations
 */

/**
 * Calculates the total balance from an array of balance objects
 */
const calculateTotalBalance = (
  balance: Array<{ total: number }>
): number => {
  return balance.reduce((acc: number, { total }) => acc + total, 0);
};

/**
 * Creates a base request body for dashboard API calls
 */
export const createBaseRequestBody = (userData: {
  id: string;
  role: string;
}) => ({
  id: userData.id,
  role: userData.role,
});

/**
 * Handles API response errors consistently
 */
export const handleApiError = (error: unknown, context: string): void => {
  console.error(`Error ${context}:`, error);
};
