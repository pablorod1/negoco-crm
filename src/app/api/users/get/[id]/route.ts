import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/lib/libsql/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
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

    const response = await tursoClient.execute({
      sql: `SELECT 
        u.*,
        o.id as org_id,
        o.name as org_name,
        o.logo as org_logo,
        o.plan as org_plan,
        COUNT(n.id) as notifications
      FROM user u
      INNER JOIN member m ON u.id = m.user_id
      INNER JOIN organization o ON m.organization_id = o.id
      LEFT JOIN notifications n ON u.id = n.user_id
      WHERE u.id = ?
      GROUP BY u.id, o.id, o.name, o.logo`,
      args: [id],
    });

    if (response.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
        },
        { status: 404 }
      );
    }

    const row = response.rows[0];

    return NextResponse.json({
      success: true,
      data: {
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
        company: row.company ? String(row.company) : null,
        organization: {
          id: row.org_id ? String(row.org_id) : "",
          name: row.org_name ? String(row.org_name) : "",
          logo: row.org_logo ? String(row.org_logo) : null,
          plan: row.org_plan ? String(row.org_plan) : null,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
