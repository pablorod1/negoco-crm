import { User } from "@/lib/core/types";
import { tursoClient } from "../../client";
import { checkIfComercialHasSubcomerciales } from "../tramites/getTramites";

export const getUsers = async (
  userData: User | null
): Promise<{
  success: boolean;
  data: User[];
}> => {
  // Si no hay userData, retornamos array vacío
  if (!userData) {
    return {
      success: true,
      data: [],
    };
  }

  let query = `SELECT DISTINCT
        u.*,
        o.id as org_id,
        o.name as org_name,
        o.logo as org_logo
      FROM user u
      INNER JOIN member m ON u.id = m.user_id
      INNER JOIN organization o ON m.organization_id = o.id`;

  const params: (string | number)[] = [];

  // Verificamos explícitamente que el rol sea "2"
  if (userData.role && userData.role === "2") {
    const subcomerciales = await checkIfComercialHasSubcomerciales(userData);

    // Siempre incluimos el ID del usuario actual
    const idsToInclude = [userData.id];
    if (subcomerciales.success && subcomerciales.ids) {
      idsToInclude.push(...subcomerciales.ids);
    }

    // Agregamos la condición WHERE usando los IDs
    query += ` WHERE u.id IN (${idsToInclude.map(() => "?").join(", ")})`;
    params.push(...idsToInclude);
  }

  const response = await tursoClient.execute({
    sql: query,
    args: params,
  });

  if (response.rows.length === 0) {
    return {
      success: false,
      data: [],
    };
  }

  const mappedData = response.rows.map((row) => ({
    id: String(row.id),
    email: String(row.email),
    email_verified: Boolean(row.email_verified),
    name: String(row.name),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    image: row.image ? String(row.image) : null,
    role: String(row.role),
    banned: Boolean(row.banned),
    ban_reason: row.ban_reason ? String(row.ban_reason) : null,
    ban_expires: row.ban_expires as string | null,
    super_id: row.super_id ? String(row.super_id) : null,
    should_reset_password: Boolean(row.should_reset_password),
    organization: {
      id: row.org_id ? String(row.org_id) : "",
      name: row.org_name ? String(row.org_name) : "",
      logo: row.org_logo ? String(row.org_logo) : null,
    },
  }));

  return {
    success: true,
    data: mappedData,
  };
};

export const getUserById = async (user_id: string): Promise<User | null> => {
  const response = await tursoClient.execute({
    sql: `
      SELECT 
        u.*,
        o.id as org_id,
        o.name as org_name,
        o.logo as org_logo,
        COUNT(n.id) as notifications
      FROM user u
      INNER JOIN member m ON u.id = m.user_id
      INNER JOIN organization o ON m.organization_id = o.id
      LEFT JOIN notifications n ON u.id = n.user_id
      WHERE u.id = ?
      GROUP BY u.id, o.id, o.name, o.logo
    `,
    args: [user_id],
  });

  if (!response) {
    return null;
  }

  const row = response.rows[0];

  return {
    id: String(row.id),
    email: String(row.email),
    email_verified: Boolean(row.email_verified),
    name: String(row.name),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    banned: Boolean(row.banned),
    image: row.image ? String(row.image) : null,
    role: String(row.role),
    super_id: row.super_id ? String(row.super_id) : null,
    should_reset_password: Boolean(row.should_reset_password),
    notifications: row.notifications as number,
    organization: {
      id: row.org_id ? String(row.org_id) : "",
      name: row.org_name ? String(row.org_name) : "",
      logo: row.org_logo ? String(row.org_logo) : null,
    },
  };
};

export const getOrganizationId = async (user_id: string): Promise<string> => {
  const response = await tursoClient.execute({
    sql: `
    SELECT organization_id
    FROM member
    WHERE user_id = ?
  `,
    args: [user_id],
  });

  if (response.rows.length === 0) {
    return "";
  }

  return response.rows[0].organization_id as string;
};
