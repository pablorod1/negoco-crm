import { tursoClient } from "../../client";

export const getOrganizationAndRole = async (user_id: string) => {
  const roleResponse = await tursoClient.execute({
    sql: `SELECT role, organization_id FROM member WHERE user_id = ?`,
    args: [user_id],
  });
  if (roleResponse.rows.length === 0) {
    return { success: false };
  }

  const organizationResponse = await tursoClient.execute({
    sql: `SELECT * FROM organization WHERE id = ?`,
    args: [roleResponse.rows[0].organization_id],
  });

  if (organizationResponse.rows.length === 0) {
    return { success: false };
  }

  return {
    success: true,
    organization: {
      id: organizationResponse.rows[0].id,
      name: organizationResponse.rows[0].name,
      logo: organizationResponse.rows[0].logo,
    },
    role: roleResponse.rows[0].role,
  };
};
