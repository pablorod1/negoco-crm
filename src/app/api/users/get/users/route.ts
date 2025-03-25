import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/lib/libsql/client";
import { getSubcomerciales } from "@/lib/libsql/users/getSubcomerciales";

export async function POST(req: NextRequest) {
  try {
    const { id, role } = await req.json();

    if (!role || !id) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);
    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    let query = `
      SELECT DISTINCT u.*, o.id as org_id, o.name as org_name, o.logo as org_logo
      FROM user u
      INNER JOIN member m ON u.id = m.user_id
      INNER JOIN organization o ON m.organization_id = o.id
    `;

    const params: (string | number)[] = [];

    if (role === "2") {
      const subcomerciales = await getSubcomerciales(tursoClient, id);
      if (subcomerciales.success && subcomerciales.ids) {
        query += ` WHERE u.id = ? OR u.id IN (${subcomerciales.ids
          .map(() => "?")
          .join(", ")})`;
        params.push(id, ...subcomerciales.ids);
      } else {
        query += ` AND u.id = ?`;
        params.push(id);
      }
    }

    const response = await tursoClient.execute({ sql: query, args: params });

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

    return NextResponse.json({ success: true, data: mappedData });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error fetching users",
      },
      { status: 500 }
    );
  }
}
