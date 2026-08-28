import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateUserSession } from "@/core/auth/session-utils";
import { getTursoClient } from "@/core/libsql/client";
import { getSubcomerciales } from "@/core/libsql/users/getSubcomerciales";
import { ComparativaPlan } from "@/comparativas/types";
import type { Client, Transaction } from "@libsql/client";
import { deleteFolderFromStorage } from "@/core/firebase/data/deleteFolder";
import { createComparativaChange } from "@/comparativas/utils/comparativaChangesHelpers";
import {
  AbarcaEstudio,
  AbarcaWebhookDocument,
} from "@/comparativas/types/abarca.types";
import { parseAbarcaApoloSipsSummary } from "@/comparativas/utils/abarca-apolo-sips";
import { parseAbarcaComisiones } from "@/comparativas/utils/abarca-comisiones";
import { parseAbarcaDocuments } from "@/comparativas/utils/abarca-documents";

/**
 * Database row interfaces for type safety
 */
interface ComparativaRow extends Record<string, unknown> {
  id: string;
  client: string;
  service: string;
  plan: string;
  status: string;
  comision_fijo: number;
  comision_indexado: number;
  comision_sales_person_fijo: number;
  comision_sales_person_indexado: number;
  notes: string;
  creation_date: string;
  tramite_id: string | null;
  user_id: string;
  email: string;
  name: string;
  image: string | null;
  company_id?: string; // ID reference to comercializadoras table
  has_permanencia?: number;
  has_renovacion?: number;
}

interface ComparativaFileRow extends Record<string, unknown> {
  id: string;
  comparativa_id: string;
  filename: string;
  size: number;
  extension: string;
  upload_date: string;
  download_url: string;
  preview_url: string | null;
}

const SafeResourceIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

const ComparisonPatchSchema = z
  .strictObject({
    client: z.string().min(1).optional(),
    service: z.enum(["Luz", "Gas"]).optional(),
    plan: z
      .array(z.enum(["fijo", "indexado"]))
      .min(1)
      .refine((plans) => new Set(plans).size === plans.length)
      .optional(),
    notes: z.array(z.string()).optional(),
  })
  .refine((updates) =>
    Object.values(updates).some((value) => value !== undefined),
  );

type QueryClient = Pick<Client, "execute">;
type WriteTransaction = Pick<
  Transaction,
  "execute" | "commit" | "rollback"
>;

/**
 * Response interface for comparison by ID
 */
interface ComparisonByIdResponse {
  success: boolean;
  data?: {
    id: string;
    client: string;
    service: "Luz" | "Gas";
    plan: ComparativaPlan[];
    status: string;
    comision: {
      fijo: number;
      indexado: number;
    };
    comision_sales_person: {
      fijo: number;
      indexado: number;
    };
    notes: string[];
    user: {
      id: string;
      email: string;
      name: string;
      image: string | null;
    };
    creation_date: string;
    tramite_id: string | null;
    company_id?: string; // ID reference to comercializadoras table
    has_permanencia: boolean;
    has_renovacion: boolean;
    abarca_estudio?: AbarcaEstudio;
    abarca_documents?: AbarcaWebhookDocument[];
    files: Array<{
      id: string;
      filename: string;
      size: number;
      extension: string;
      upload_date: string;
      download_url: string;
      preview_url: string | null;
    }>;
  };
  error?: string;
}

/**
 * Database query execution with error handling and performance monitoring
 */
async function executeQuery<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  client: QueryClient,
  sql: string,
  args: (string | number)[],
  queryName: string,
): Promise<{ success: boolean; data?: T[]; error?: string }> {
  const startTime = performance.now();

  try {
    const result = await client.execute({ sql, args });

    return {
      success: true,
      data: result.rows as unknown as T[],
    };
  } catch (error) {
    const endTime = performance.now();
    console.error(
      `[DB Query Error] ${queryName} failed after ${(endTime - startTime).toFixed(2)}ms:`,
      error,
    );

    return {
      success: false,
      error: `Database query failed: ${queryName}`,
    };
  }
}

/**
 * Fetch comparison data with user authorization
 */
async function fetchComparisonData(
  client: QueryClient,
  id: string,
  user_id: string,
  user_role: string,
): Promise<{ success: boolean; data?: ComparativaRow[]; error?: string }> {
  const queryParams: (string | number)[] = [id];

  let comparativaQuery = `
    SELECT 
      c.id,
      c.client,
      c.service,
      c.plan,
      c.status,
      c.comision_fijo,
      c.comision_indexado,
      c.comision_sales_person_fijo,
      c.comision_sales_person_indexado,
      c.notes,
      c.creation_date,
      c.tramite_id,
      c.company_id,
      c.has_permanencia,
      c.has_renovacion,
      u.id as user_id,
      u.email,
      u.name,
      u.image
    FROM comparativas c
    INNER JOIN user u ON c.user_id = u.id
    WHERE c.id = ?
  `;

  // Apply role-based filtering for managers (role "2")
  if (user_role === "2") {
    const subcomerciales = await getSubcomerciales(client, user_id);
    const idsToInclude = [user_id];

    if (subcomerciales.success && subcomerciales.ids.length > 0) {
      idsToInclude.push(...subcomerciales.ids);
    }

    const placeholders = idsToInclude.map(() => "?").join(", ");
    comparativaQuery += ` AND u.id IN (${placeholders})`;
    queryParams.push(...idsToInclude);
  }

  return executeQuery<ComparativaRow>(
    client,
    comparativaQuery,
    queryParams,
    "fetch-comparison-data",
  );
}

/**
 * Fetch comparison files
 */
async function fetchComparisonFiles(
  client: QueryClient,
  comparativaId: string,
): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    filename: string;
    size: number;
    extension: string;
    upload_date: string;
    download_url: string;
    preview_url: string | null;
  }>;
  error?: string;
}> {
  const filesQuery = `
    SELECT 
      id,
      comparativa_id,
      filename,
      size,
      extension,
      upload_date,
      download_url,
      preview_url
    FROM comparativa_files 
    WHERE comparativa_id = ?
    ORDER BY upload_date DESC
  `;

  const result = await executeQuery<ComparativaFileRow>(
    client,
    filesQuery,
    [comparativaId],
    "fetch-comparison-files",
  );

  if (!result.success) {
    return result;
  }

  const files = result.data!.map((row: ComparativaFileRow) => ({
    id: String(row.id),
    filename: String(row.filename),
    size: Number(row.size),
    extension: String(row.extension),
    upload_date: row.upload_date as string,
    download_url: String(row.download_url),
    preview_url: row.preview_url ? String(row.preview_url) : null,
  }));

  return {
    success: true,
    data: files,
  };
}

/**
 * Transform raw database data to response format
 */
function transformComparisonData(
  comparativa: ComparativaRow,
  files: Array<{
    id: string;
    filename: string;
    size: number;
    extension: string;
    upload_date: string;
    download_url: string;
    preview_url: string | null;
  }>,
  abarcaEstudio?: AbarcaEstudio,
  abarcaDocuments?: AbarcaWebhookDocument[],
): ComparisonByIdResponse["data"] {
  return {
    id: String(comparativa.id),
    client: String(comparativa.client),
    service: String(comparativa.service) as "Luz" | "Gas",
    plan: JSON.parse(comparativa.plan as string) as ComparativaPlan[],
    status: String(comparativa.status),
    comision: {
      fijo: Number(comparativa.comision_fijo),
      indexado: Number(comparativa.comision_indexado),
    },
    comision_sales_person: {
      fijo: Number(comparativa.comision_sales_person_fijo),
      indexado: Number(comparativa.comision_sales_person_indexado),
    },
    notes: JSON.parse(comparativa.notes as string) as string[],
    user: {
      id: String(comparativa.user_id),
      email: String(comparativa.email),
      name: String(comparativa.name),
      image: comparativa.image ? String(comparativa.image) : null,
    },
    creation_date: comparativa.creation_date as string,
    tramite_id: comparativa.tramite_id ? String(comparativa.tramite_id) : null,
    company_id: comparativa.company_id
      ? String(comparativa.company_id)
      : undefined,
    has_permanencia: comparativa.has_permanencia === 1,
    has_renovacion: comparativa.has_renovacion === 1,
    abarca_estudio: abarcaEstudio,
    abarca_documents: abarcaDocuments,
    files,
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ComparisonByIdResponse>> {
  try {
    const authResult = await validateUserSession(req);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const authenticatedUser = authResult.user;
    const { id: rawComparisonId } = await params;
    const idValidation = SafeResourceIdSchema.safeParse(rawComparisonId);
    if (!idValidation.success) {
      return NextResponse.json(
        { success: false, error: "Invalid parameters" },
        { status: 400 },
      );
    }
    const comparisonId = idValidation.data;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid parameters" },
        { status: 400 },
      );
    }

    const validation = ComparisonPatchSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Invalid parameters" },
        { status: 400 },
      );
    }
    const updates = validation.data;

    if (
      updates.plan !== undefined &&
      authenticatedUser.role !== "admin" &&
      authenticatedUser.role !== "1"
    ) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const tursoClient = getTursoClient(req);
    if (!tursoClient) {
      console.error("[comparison-patch] database client not initialized");
      return NextResponse.json(
        { success: false, error: "Internal server error" },
        { status: 500 },
      );
    }

    if (
      authenticatedUser.role !== "admin" &&
      authenticatedUser.role !== "1" &&
      authenticatedUser.role !== "2"
    ) {
      return NextResponse.json(
        { success: false, error: "Comparativa not found" },
        { status: 404 },
      );
    }

    const transaction: WriteTransaction =
      await tursoClient.transaction("write");
    try {
      const existingComparison = await fetchComparisonData(
        transaction,
        comparisonId,
        authenticatedUser.id,
        authenticatedUser.role,
      );
      if (!existingComparison.success) {
        throw new Error("Comparison lookup failed");
      }
      if (
        !existingComparison.data ||
        existingComparison.data.length === 0
      ) {
        await transaction.rollback();
        return NextResponse.json(
          { success: false, error: "Comparativa not found" },
          { status: 404 },
        );
      }

      const previousData = existingComparison.data[0];
      if (
        updates.plan !== undefined &&
        previousData.status !== "completed"
      ) {
        await transaction.rollback();
        return NextResponse.json(
          {
            success: false,
            error: "Comparison status changed",
          },
          { status: 409 },
        );
      }

      const updateFields: string[] = [];
      const updateArgs: string[] = [];
      if (updates.client !== undefined) {
        updateFields.push("client = ?");
        updateArgs.push(updates.client);
      }
      if (updates.service !== undefined) {
        updateFields.push("service = ?");
        updateArgs.push(updates.service);
      }
      if (updates.plan !== undefined) {
        updateFields.push("plan = ?");
        updateArgs.push(JSON.stringify(updates.plan));
      }
      if (updates.notes !== undefined) {
        updateFields.push("notes = ?");
        updateArgs.push(JSON.stringify(updates.notes));
      }

      let updateSql = `UPDATE comparativas
        SET ${updateFields.join(", ")}
        WHERE id = ?`;
      updateArgs.push(comparisonId);
      if (authenticatedUser.role === "2") {
        const subcomerciales = await getSubcomerciales(
          transaction,
          authenticatedUser.id,
        );
        const allowedUserIds = [authenticatedUser.id];
        if (subcomerciales.success) {
          allowedUserIds.push(...subcomerciales.ids);
        }
        updateSql += ` AND user_id IN (${allowedUserIds
          .map(() => "?")
          .join(", ")})`;
        updateArgs.push(...allowedUserIds);
      }

      const updateResult = await transaction.execute({
        sql: updateSql,
        args: updateArgs,
      });
      if (updateResult.rowsAffected === 0) {
        await transaction.rollback();
        return NextResponse.json(
          { success: false, error: "Comparativa not found" },
          { status: 404 },
        );
      }

      const auditChanges = [];
      if (
        updates.client !== undefined &&
        updates.client !== previousData.client
      ) {
        auditChanges.push({
          change_type: "client_update" as const,
          field_name: "client",
          old_value: previousData.client,
          new_value: updates.client,
          description: `Cliente actualizado de "${previousData.client}" a "${updates.client}"`,
        });
      }
      if (
        updates.service !== undefined &&
        updates.service !== previousData.service
      ) {
        auditChanges.push({
          change_type: "service_update" as const,
          field_name: "service",
          old_value: previousData.service,
          new_value: updates.service,
          description: `Servicio actualizado de "${previousData.service}" a "${updates.service}"`,
        });
      }
      if (updates.plan !== undefined) {
        const previousPlan = JSON.parse(
          String(previousData.plan),
        ) as string[];
        if (JSON.stringify(previousPlan) !== JSON.stringify(updates.plan)) {
          auditChanges.push({
            change_type: "plan_update" as const,
            field_name: "plan",
            old_value: JSON.stringify(previousPlan),
            new_value: JSON.stringify(updates.plan),
            description: `Plan actualizado de [${previousPlan.join(", ")}] a [${updates.plan.join(", ")}]`,
          });
        }
      }
      if (updates.notes !== undefined) {
        const previousNotes = JSON.parse(
          String(previousData.notes),
        ) as string[];
        if (
          JSON.stringify(previousNotes) !== JSON.stringify(updates.notes)
        ) {
          auditChanges.push({
            change_type: "general_update" as const,
            field_name: "notes",
            old_value: JSON.stringify(previousNotes),
            new_value: JSON.stringify(updates.notes),
            description: "Notas actualizadas",
          });
        }
      }

      for (const change of auditChanges) {
        const auditRecorded = await createComparativaChange(transaction, {
          comparativa_id: comparisonId,
          user_id: authenticatedUser.id,
          ...change,
        });
        if (!auditRecorded) {
          throw new Error("Comparison audit could not be recorded");
        }
      }

      const updatedComparison = await fetchComparisonData(
        transaction,
        comparisonId,
        authenticatedUser.id,
        authenticatedUser.role,
      );
      if (
        !updatedComparison.success ||
        !updatedComparison.data ||
        updatedComparison.data.length === 0
      ) {
        throw new Error("Updated comparison lookup failed");
      }

      const filesResult = await fetchComparisonFiles(
        transaction,
        comparisonId,
      );
      if (!filesResult.success) {
        throw new Error("Comparison files lookup failed");
      }

      const responseData = transformComparisonData(
        updatedComparison.data[0],
        filesResult.data || [],
      );
      await transaction.commit();

      return NextResponse.json({
        success: true,
        data: responseData,
      });
    } catch (error) {
      await transaction.rollback();
      console.error("[comparison-patch] transaction failed", error);
      return NextResponse.json(
        { success: false, error: "Internal server error" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("[comparison-patch] unexpected error", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ComparisonByIdResponse>> {
  const startTime = performance.now();

  try {
    const authResult = await validateUserSession(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // Identity always comes from the session; the request body is ignored.
    const { id: user_id, role: user_role } = authResult.user;

    const { id: rawComparisonId } = await params;
    const idValidation = SafeResourceIdSchema.safeParse(rawComparisonId);

    if (!idValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid parameters",
        },
        { status: 400 },
      );
    }

    const id = idValidation.data;

    if (user_role !== "admin" && user_role !== "1" && user_role !== "2") {
      return NextResponse.json(
        {
          success: false,
          error: "Comparativa not found",
        },
        { status: 404 },
      );
    }

    // Initialize database client
    const tursoClient = getTursoClient(request);
    if (!tursoClient) {
      console.error("[Database Error] Failed to initialize Turso client");
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 },
      );
    }

    // Fetch comparison data with authorization
    const comparisonResult = await fetchComparisonData(
      tursoClient,
      id,
      user_id,
      user_role,
    );

    if (!comparisonResult.success) {
      console.error(
        "[Database Error] Failed to fetch comparison:",
        comparisonResult.error,
      );
      return NextResponse.json(
        {
          success: false,
          error: comparisonResult.error,
        },
        { status: 500 },
      );
    }

    if (!comparisonResult.data || comparisonResult.data.length === 0) {
      console.warn(
        `[Authorization] Comparison not found or access denied: ${id} for user: ${user_id}`,
      );
      return NextResponse.json(
        {
          success: false,
          error: "Comparativa not found",
        },
        { status: 404 },
      );
    }

    const comparativa = comparisonResult.data[0];

    // Fetch associated files
    const filesResult = await fetchComparisonFiles(tursoClient, id);

    if (!filesResult.success) {
      console.error(
        "[Database Error] Failed to fetch comparison files:",
        filesResult.error,
      );
      return NextResponse.json(
        {
          success: false,
          error: filesResult.error,
        },
        { status: 500 },
      );
    }

    const files = filesResult.data || [];

    // Fetch Abarca estudio data if exists
    let abarcaEstudio: AbarcaEstudio | undefined;
    try {
      const abarcaResult = await tursoClient.execute({
        sql: "SELECT * FROM abarca_estudios WHERE comparativa_id = ? LIMIT 1",
        args: [id],
      });
      if (abarcaResult.rows.length > 0) {
        const row = abarcaResult.rows[0];
        const rawPayload = String(row.raw_payload);
        abarcaEstudio = {
          id: String(row.id),
          comparativa_id: String(row.comparativa_id),
          crm_id: Number(row.crm_id),
          ide: Number(row.ide),
          cups: String(row.cups),
          tipo_tarifa: row.tipo_tarifa ? String(row.tipo_tarifa) : null,
          potencia_contratada: toNullableNumber(row.potencia_contratada),
          potencia_contratada_p2: toNullableNumber(row.potencia_contratada_p2),
          potencia_contratada_p3: toNullableNumber(row.potencia_contratada_p3),
          potencia_contratada_p4: toNullableNumber(row.potencia_contratada_p4),
          potencia_contratada_p5: toNullableNumber(row.potencia_contratada_p5),
          potencia_contratada_p6: toNullableNumber(row.potencia_contratada_p6),
          consumo_p1: toNullableNumber(row.consumo_p1),
          consumo_p2: toNullableNumber(row.consumo_p2),
          consumo_p3: toNullableNumber(row.consumo_p3),
          consumo_p4: toNullableNumber(row.consumo_p4),
          consumo_p5: toNullableNumber(row.consumo_p5),
          consumo_p6: toNullableNumber(row.consumo_p6),
          empresa_cliente: row.empresa_cliente
            ? String(row.empresa_cliente)
            : null,
          empresa: row.empresa ? String(row.empresa) : null,
          nombre_completo: row.nombre_completo
            ? String(row.nombre_completo)
            : null,
          titular: row.titular ? String(row.titular) : null,
          ape1: row.ape1 ? String(row.ape1) : null,
          ape2: row.ape2 ? String(row.ape2) : null,
          dni: row.dni ? String(row.dni) : null,
          nif_empresa: Boolean(row.nif_empresa),
          autonomo: Boolean(row.autonomo),
          calle: row.calle ? String(row.calle) : null,
          numero: row.numero ? String(row.numero) : null,
          codpostal: row.codpostal ? String(row.codpostal) : null,
          localidad: row.localidad ? String(row.localidad) : null,
          calle_cups: row.calle_cups ? String(row.calle_cups) : null,
          numero_cups: row.numero_cups ? String(row.numero_cups) : null,
          codpostal_cups: row.codpostal_cups
            ? String(row.codpostal_cups)
            : null,
          localidad_cups: row.localidad_cups
            ? String(row.localidad_cups)
            : null,
          email: row.email ? String(row.email) : null,
          movil: row.movil ? String(row.movil) : null,
          iban: row.iban ? String(row.iban) : null,
          cambio_titularidad: Boolean(row.cambio_titularidad),
          tiene_placas: Boolean(row.tiene_placas),
          observaciones: row.observaciones ? String(row.observaciones) : null,
          servicios: row.servicios ? String(row.servicios) : null,
          permanencia: Number(row.permanencia ?? 0),
          apolo_sips: parseAbarcaApoloSipsSummary(rawPayload),
          comisiones: parseAbarcaComisiones(rawPayload),
          raw_payload: rawPayload,
          created_at: String(row.created_at),
        };
      }
    } catch {
      // abarca_estudios table may not exist yet, ignore
    }

    // Estado de los documentos del webhook de Abarca (qué falta y por qué),
    // guardado dentro del propio raw_payload junto al resumen de SIPS.
    const parsedDocuments = abarcaEstudio
      ? parseAbarcaDocuments(abarcaEstudio.raw_payload)
      : [];
    const abarcaDocuments =
      parsedDocuments.length > 0 ? parsedDocuments : undefined;

    // Transform and return data
    const responseData = transformComparisonData(
      comparativa,
      files,
      abarcaEstudio,
      abarcaDocuments,
    );

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    const endTime = performance.now();
    console.error(
      `[API Error] Failed to retrieve comparison after ${(endTime - startTime).toFixed(2)}ms:`,
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Error getting comparativa",
      },
      { status: 500 },
    );
  }
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

// ==================== DELETE METHOD ====================

/**
 * Request body schema for deleting comparison
 */
const DeleteComparisonSchema = z.object({
  organization_id: z.string().min(1, "Organization ID is required"),
});

/**
 * Response interface for deletion operation
 */
interface DeleteComparisonResponse {
  success?: boolean;
  error?: string;
  metrics?: DeleteMetrics;
}

/**
 * Performance metrics interface for deletion
 */
interface DeleteMetrics {
  operationTime: number;
  recordsDeleted: number;
  filesDeleted: number;
  optimizationApplied: string[];
}

/**
 * Executes database query with performance monitoring and error handling
 * @param tursoClient - Database client instance
 * @param query - SQL query string
 * @param params - Query parameters
 * @param operation - Operation name for logging
 * @returns Promise with query result and metrics
 */
async function executeDeleteQuery(
  tursoClient: Client,
  query: string,
  params: (string | number)[],
  operation: string,
): Promise<{
  result: { rows: Record<string, unknown>[]; rowsAffected: number };
  metrics: Partial<DeleteMetrics>;
}> {
  const startTime = performance.now();

  try {
    const result = await tursoClient.execute({
      sql: query,
      args: params,
    });

    const queryTime = performance.now() - startTime;

    return {
      result,
      metrics: {
        operationTime: queryTime,
        recordsDeleted: result.rowsAffected,
        optimizationApplied: ["PREPARED_STATEMENT", "PERFORMANCE_MONITORING"],
      },
    };
  } catch (error) {
    const queryTime = performance.now() - startTime;
    console.error(
      `[ERROR] ${operation} failed after ${queryTime.toFixed(2)}ms:`,
      error,
    );
    throw error;
  }
}

/**
 * Validates comparison existence and retrieves metadata for optimization
 * @param tursoClient - Database client instance
 * @param comparisonId - Comparison ID to validate
 * @returns Promise with validation result and metadata
 */
async function validateComparisonExists(
  tursoClient: Client,
  comparisonId: string,
): Promise<{ exists: boolean; fileCount: number }> {
  const { result } = await executeDeleteQuery(
    tursoClient,
    `SELECT 
       (SELECT COUNT(*) FROM comparativas WHERE id = ?) as comparison_exists,
       (SELECT COUNT(*) FROM comparativa_files WHERE comparativa_id = ?) as file_count`,
    [comparisonId, comparisonId],
    "validate_comparison_existence",
  );

  const row = result.rows[0] as Record<string, unknown>;
  const exists = Number(row.comparison_exists) > 0;
  const fileCount = Number(row.file_count) || 0;

  return { exists, fileCount };
}

/**
 * Deletes comparison with cascading operations optimized for performance
 * @param tursoClient - Database client instance
 * @param comparisonId - Comparison ID to delete
 * @returns Promise with deletion result and metrics
 */
async function deleteComparisonOptimized(
  tursoClient: Client,
  comparisonId: string,
): Promise<{
  success: boolean;
  error?: string;
  metrics: Partial<DeleteMetrics>;
}> {
  const startTime = performance.now();

  try {
    // Execute deletion with CASCADE to automatically handle related records
    const { result } = await executeDeleteQuery(
      tursoClient,
      `DELETE FROM comparativas WHERE id = ?`,
      [comparisonId],
      "delete_comparison",
    );

    const totalTime = performance.now() - startTime;

    if (result.rowsAffected === 0) {
      return {
        success: false,
        error: "Comparativa not found",
        metrics: {
          operationTime: totalTime,
          recordsDeleted: 0,
          optimizationApplied: ["EARLY_VALIDATION", "CASCADE_DELETE"],
        },
      };
    }

    return {
      success: true,
      metrics: {
        operationTime: totalTime,
        recordsDeleted: result.rowsAffected,
        optimizationApplied: [
          "CASCADE_DELETE",
          "PERFORMANCE_MONITORING",
          "PREPARED_STATEMENT",
        ],
      },
    };
  } catch (error) {
    const totalTime = performance.now() - startTime;
    console.error(
      `[ERROR] Delete comparison failed after ${totalTime.toFixed(2)}ms:`,
      error,
    );
    return {
      success: false,
      error: "Internal Server Error",
      metrics: {
        operationTime: totalTime,
        recordsDeleted: 0,
        optimizationApplied: ["ERROR_HANDLING"],
      },
    };
  }
}

/**
 * Deletes a comparison and all associated files
 *
 * Refactored from: /api/comparativas/delete/[id]
 * New endpoint: /new_api/comparisons/[id] (DELETE method)
 *
 * This endpoint handles the complete deletion of a comparison including:
 * - Database record deletion (with CASCADE for related files)
 * - Firebase Storage folder deletion
 * - Performance monitoring and optimization
 *
 * @param request - Next.js request object containing organization_id
 * @param params - Route parameters containing comparison ID
 * @returns Promise<NextResponse<DeleteComparisonResponse>>
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<DeleteComparisonResponse>> {
  const startTime = performance.now();

  try {
    // ==================== AUTHENTICATION ====================

    const authResult = await validateUserSession(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Deleting a comparison is an admin-only action, as it is in the UI.
    if (authResult.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ==================== PARAMETER VALIDATION ====================

    const { id: comparisonId } = await params;

    if (!comparisonId) {
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 },
      );
    }

    // ==================== REQUEST BODY VALIDATION ====================

    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    // Validate request body using Zod schema
    const validation = DeleteComparisonSchema.safeParse(requestBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 },
      );
    }

    const { organization_id } = validation.data;

    // ==================== DATABASE CONNECTION ====================

    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        { error: "Database client not initialized" },
        { status: 500 },
      );
    }

    // ==================== BUSINESS LOGIC VALIDATION ====================

    // Validate that the comparison exists and get file count for optimization
    const { exists: comparisonExists } = await validateComparisonExists(
      tursoClient,
      comparisonId,
    );

    if (!comparisonExists) {
      // Return consistent error format (backward compatibility)
      return NextResponse.json(
        { error: "Comparativa not found" },
        { status: 500 },
      );
    }

    // ==================== CORE DELETION OPERATION ====================

    // Step 1: Delete from database (CASCADE will handle related files table)
    const dbDeletionResult = await deleteComparisonOptimized(
      tursoClient,
      comparisonId,
    );

    if (!dbDeletionResult.success) {
      const totalRequestTime = performance.now() - startTime;
      console.error(
        `[ERROR] Database deletion failed for comparison ${comparisonId} after ${totalRequestTime.toFixed(2)}ms: ${dbDeletionResult.error}`,
      );

      return NextResponse.json(
        { error: dbDeletionResult.error },
        { status: 500 },
      );
    }

    // Step 2: Delete files from Firebase Storage
    const storageDeleteResult = await deleteFolderFromStorage(
      "comparativas",
      comparisonId,
      organization_id,
    );

    if (!storageDeleteResult.success) {
      const totalRequestTime = performance.now() - startTime;
      console.error(
        `[ERROR] Storage deletion failed for comparison ${comparisonId} after ${totalRequestTime.toFixed(2)}ms: ${storageDeleteResult.errors}`,
      );

      // Note: Database deletion already succeeded, so we have partial failure
      // Return exact error format for backward compatibility
      return NextResponse.json(
        { error: storageDeleteResult.errors },
        { status: 500 },
      );
    }

    // ==================== SUCCESS RESPONSE ====================

    // Return exact response format for backward compatibility
    return NextResponse.json({ success: true });
  } catch (error) {
    // ==================== ERROR HANDLING ====================

    const totalRequestTime = performance.now() - startTime;

    console.error(
      `[ERROR] Deletion operation failed after ${totalRequestTime.toFixed(2)}ms:`,
      error,
    );

    // Return exact error format for backward compatibility
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
