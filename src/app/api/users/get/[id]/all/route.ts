import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/lib/libsql/client";
import { getSubcomerciales } from "@/lib/libsql/users/getSubcomerciales";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { role } = await req.json();

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
      SELECT DISTINCT u.*, o.id as org_id, o.name as org_name, o.logo as org_logo, s.created_at as last_login
      FROM user u 
      INNER JOIN member m ON u.id = m.user_id
      INNER JOIN organization o ON m.organization_id = o.id
      LEFT JOIN session s ON u.id = s.user_id AND s.created_at = (
        SELECT MAX(created_at) FROM session WHERE user_id = u.id
      )
    `;

    const queryParams: (string | number)[] = [];

    if (role === "2") {
      const subcomerciales = await getSubcomerciales(tursoClient, id);
      if (subcomerciales.success && subcomerciales.ids) {
        query += ` WHERE u.id = ? OR u.id IN (${subcomerciales.ids
          .map(() => "?")
          .join(", ")})`;
        queryParams.push(id, ...subcomerciales.ids);
      } else {
        query += ` WHERE u.id = ?`;
        queryParams.push(id);
      }
    }

    const response = await tursoClient.execute({
      sql: query,
      args: queryParams,
    });

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
      company: row.company ? String(row.company) : null,
      last_login: row.last_login as string | null,
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
