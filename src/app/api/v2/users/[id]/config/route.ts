import { getTursoClient } from "@/core/libsql/client";
import { hashPassword } from "@/core/auth/auth-utils";
import { NextRequest, NextResponse } from "next/server";
import { validateUserSession } from "@/core/auth/session-utils";
import {
  getDefaultCommissions,
  getUserCommissionOverrides,
  mergeCommissions,
} from "@/core/libsql/commissions/companyCommissions";
import { z } from "zod";

const profileSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  super_id: z.string().trim().min(1).nullable().optional(),
  password: z.string().min(1).optional(),
});

const companyCommissionSchema = z.object({
  comercializadora_id: z.string().min(1),
  commission_type: z.enum(["percent", "fixed"]),
  commission_value: z.number().min(0),
});

const targetedNoteSchema = z.object({
  id: z.string().min(1).optional(),
  target: z.enum(["global", "tramites", "comparativas"]),
  note: z.string(),
  delete: z.boolean().optional(),
});

const configUpdateSchema = z.object({
  profile: profileSchema.optional(),
  company_commissions: z.array(companyCommissionSchema).optional(),
  targeted_notes: z.array(targetedNoteSchema).optional(),
});

function isConfigEditor(role: string | null | undefined) {
  return role === "admin";
}

async function requireConfigEditor(request: NextRequest) {
  const authResult = await validateUserSession(request);
  if (!authResult.success || !authResult.user) {
    return {
      error: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }
  if (!isConfigEditor(authResult.user.role)) {
    return {
      error: NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      ),
    };
  }
  return { error: null };
}

async function getConfigData(
  tursoClient: NonNullable<ReturnType<typeof getTursoClient>>,
  userId: string,
) {
  const [overrides, defaults, notesResponse] = await Promise.all([
    getUserCommissionOverrides(tursoClient, userId),
    getDefaultCommissions(tursoClient),
    tursoClient.execute({
      sql: `SELECT id, user_id, target, note, created_at, updated_at
      FROM user_default_notes
      WHERE user_id = ?
      ORDER BY created_at ASC`,
      args: [userId],
    }),
  ]);

  return {
    // Solo los overrides propios del colaborador: lo que el modal edita.
    company_commissions: overrides,
    // Valores heredados de la asesoría, para mostrar qué se aplica si no hay override.
    default_commissions: defaults,
    // Lo que realmente se aplica al calcular comisiones.
    effective_commissions: mergeCommissions(userId, overrides, defaults),
    targeted_notes: notesResponse.rows.map((row) => ({
      id: String(row.id),
      user_id: String(row.user_id),
      target: String(row.target),
      note: String(row.note),
      created_at: row.created_at ? String(row.created_at) : null,
      updated_at: row.updated_at ? String(row.updated_at) : null,
    })),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireConfigEditor(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 },
      );
    }

    const data = await getConfigData(tursoClient, id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching user config:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireConfigEditor(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await request.json();
    const parsed = configUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid parameters" },
        { status: 400 },
      );
    }

    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      return NextResponse.json(
        { success: false, error: "Database client not initialized" },
        { status: 500 },
      );
    }

    const userResponse = await tursoClient.execute({
      sql: "SELECT id FROM user WHERE id = ?",
      args: [id],
    });
    if (userResponse.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    const { profile, company_commissions, targeted_notes } = parsed.data;

    if (profile) {
      const updates: string[] = [];
      const args: (string | number | null)[] = [];

      if (profile.name !== undefined) {
        updates.push("name = ?");
        args.push(profile.name);
      }
      if (profile.email !== undefined) {
        updates.push("email = ?");
        args.push(profile.email);
      }
      if (profile.super_id !== undefined) {
        updates.push("super_id = ?");
        args.push(profile.super_id);
      }
      if (updates.length > 0) {
        updates.push("updated_at = ?");
        args.push(Date.now());
        args.push(id);
        await tursoClient.execute({
          sql: `UPDATE user SET ${updates.join(", ")} WHERE id = ?`,
          args,
        });
      }

      if (profile.password !== undefined) {
        const hashedPassword = await hashPassword(profile.password);
        const passwordResult = await tursoClient.execute({
          sql: `UPDATE account
          SET password = ?, updated_at = ?
          WHERE user_id = ? AND password IS NOT NULL`,
          args: [hashedPassword, Date.now(), id],
        });
        if (passwordResult.rowsAffected === 0) {
          return NextResponse.json(
            { success: false, error: "Password account not found" },
            { status: 400 },
          );
        }
      }
    }

    if (company_commissions !== undefined) {
      // La lista recibida es el conjunto completo de overrides del colaborador:
      // las comercializadoras que no vengan pasan a heredar el valor por defecto
      // de la asesoría.
      await tursoClient.batch(
        [
          {
            sql: "DELETE FROM user_company_commissions WHERE user_id = ?",
            args: [id],
          },
          ...company_commissions.map((commission) => ({
            sql: `INSERT INTO user_company_commissions (
              id,
              user_id,
              comercializadora_id,
              commission_type,
              commission_value,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            args: [
              crypto.randomUUID(),
              id,
              commission.comercializadora_id,
              commission.commission_type,
              commission.commission_value,
            ],
          })),
        ],
        "write",
      );
    }

    if (targeted_notes !== undefined) {
      for (const note of targeted_notes) {
        if (note.delete) {
          if (!note.id) continue;
          await tursoClient.execute({
            sql: "DELETE FROM user_default_notes WHERE id = ? AND user_id = ?",
            args: [note.id, id],
          });
          continue;
        }

        const trimmedNote = note.note.trim();
        if (note.id) {
          await tursoClient.execute({
            sql: `UPDATE user_default_notes
            SET target = ?, note = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?`,
            args: [note.target, trimmedNote, note.id, id],
          });
          continue;
        }

        if (!trimmedNote) continue;
        await tursoClient.execute({
          sql: `INSERT INTO user_default_notes (
            id,
            user_id,
            target,
            note,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          args: [crypto.randomUUID(), id, note.target, trimmedNote],
        });
      }
    }

    const data = await getConfigData(tursoClient, id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error updating user config:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
