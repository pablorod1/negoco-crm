import { NextResponse } from "next/server";
import { getTursoClientByTenant } from "@/core/libsql/client";
import { AbarcaWebhookSchema } from "@/comparativas/types/abarca.types";
import { uploadBase64File } from "@/core/firebase/data/uploadBase64File";
import {
  recordStatusChange,
  recordDocumentUpload,
} from "@/comparativas/utils/comparativaChangesHelpers";

export async function POST(req: Request) {
  // 1. Auth: solo x-api-key
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.ABARCA_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Tenant
  const tenant = req.headers.get("x-tenant");
  if (!tenant) {
    return NextResponse.json({ error: "Missing tenant" }, { status: 400 });
  }

  let db;
  try {
    db = getTursoClientByTenant(tenant);
  } catch {
    return NextResponse.json({ error: "Invalid tenant" }, { status: 400 });
  }

  // 3. Parse + validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = AbarcaWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const payload = parsed.data;

  // 4. Verify organization.abarca_user_id matches crm_id
  const orgResult = await db.execute(
    "SELECT id, abarca_user_id FROM organization LIMIT 1",
  );
  if (orgResult.rows.length === 0) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 },
    );
  }
  const org = orgResult.rows[0];
  if (Number(org.abarca_user_id) !== payload.crm_id) {
    return NextResponse.json(
      { error: "crm_id does not match organization" },
      { status: 403 },
    );
  }
  const organizationId = org.id as string;

  // 5. Resolve comparativa directly from payload
  const comparativaId = payload.comparativa_id;

  // 6. Verify comparativa exists
  const compResult = await db.execute({
    sql: "SELECT id, status FROM comparativas WHERE id = ?",
    args: [comparativaId],
  });
  if (compResult.rows.length === 0) {
    return NextResponse.json(
      { error: "Comparativa not found" },
      { status: 404 },
    );
  }
  const currentStatus = compResult.rows[0].status as string;

  // 7. Upload files to Firebase
  const storagePath = `${organizationId}/comparativas/${comparativaId}`;
  const uploadedFiles: {
    filename: string;
    downloadURL: string;
    size: number;
    extension: string;
  }[] = [];

  // Estudio PDF (obligatorio si se incluye)
  if (payload.comparativa_pdf) {
    const result = await uploadBase64File(
      payload.comparativa_pdf,
      `${storagePath}/estudio_${payload.empresa}.pdf`,
      "application/pdf",
    );
    uploadedFiles.push({
      filename: `estudio_${payload.empresa}.pdf`,
      downloadURL: result.downloadURL,
      size: Buffer.from(payload.comparativa_pdf, "base64").length,
      extension: "pdf",
    });
  }

  // DNI frontal
  if (payload.dni_photo_front) {
    const result = await uploadBase64File(
      payload.dni_photo_front,
      `${storagePath}/dni_frontal.jpg`,
      "image/jpeg",
    );
    uploadedFiles.push({
      filename: "dni_frontal.jpg",
      downloadURL: result.downloadURL,
      size: Buffer.from(payload.dni_photo_front, "base64").length,
      extension: "jpg",
    });
  }

  // DNI reverso
  if (payload.dni_photo_back) {
    const result = await uploadBase64File(
      payload.dni_photo_back,
      `${storagePath}/dni_reverso.jpg`,
      "image/jpeg",
    );
    uploadedFiles.push({
      filename: "dni_reverso.jpg",
      downloadURL: result.downloadURL,
      size: Buffer.from(payload.dni_photo_back, "base64").length,
      extension: "jpg",
    });
  }

  // Justo título
  if (payload.justo_titulo) {
    const result = await uploadBase64File(
      payload.justo_titulo,
      `${storagePath}/justo_titulo.pdf`,
      "application/pdf",
    );
    uploadedFiles.push({
      filename: "justo_titulo.pdf",
      downloadURL: result.downloadURL,
      size: Buffer.from(payload.justo_titulo, "base64").length,
      extension: "pdf",
    });
  }

  // 8. Insert comparativa_files
  const now = new Date().toISOString();
  for (const file of uploadedFiles) {
    const fileId = crypto.randomUUID();
    await db.execute({
      sql: `INSERT INTO comparativa_files (id, comparativa_id, filename, size, extension, upload_date, download_url, preview_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        fileId,
        comparativaId,
        file.filename,
        file.size,
        file.extension,
        now,
        file.downloadURL,
        null,
      ],
    });
    await recordDocumentUpload(db, comparativaId, "system", file.filename);
  }

  // 9. Insert abarca_estudios
  const estudioId = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO abarca_estudios (
      id, comparativa_id, crm_id, ide,
      cups, tipo_tarifa, potencia_contratada, potencia_contratada_p2, potencia_contratada_p3, potencia_contratada_p4, potencia_contratada_p5, potencia_contratada_p6,
      consumo_p1, consumo_p2, consumo_p3, consumo_p4, consumo_p5, consumo_p6,
      empresa_cliente, empresa,
      nombre_completo, titular, ape1, ape2, dni, nif_empresa, autonomo,
      calle, numero, codpostal, localidad,
      calle_cups, numero_cups, codpostal_cups, localidad_cups,
      email, movil, iban,
      cambio_titularidad, tiene_placas,
      observaciones, servicios, permanencia,
      raw_payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      estudioId,
      comparativaId,
      payload.crm_id,
      payload.ide,
      payload.cups,
      payload.tipo_tarifa ?? null,
      payload.potencia_contratada ?? null,
      payload.potencia_contratada_p2 ?? null,
      payload.potencia_contratada_p3 ?? null,
      payload.potencia_contratada_p4 ?? null,
      payload.potencia_contratada_p5 ?? null,
      payload.potencia_contratada_p6 ?? null,
      payload.consumo_p1 ?? null,
      payload.consumo_p2 ?? null,
      payload.consumo_p3 ?? null,
      payload.consumo_p4 ?? null,
      payload.consumo_p5 ?? null,
      payload.consumo_p6 ?? null,
      payload.empresa_cliente ?? null,
      payload.empresa ?? null,
      payload.nombre_completo ?? null,
      payload.titular ?? null,
      payload.ape1 ?? null,
      payload.ape2 ?? null,
      payload.dni ?? null,
      payload.nif_empresa ? 1 : 0,
      payload.autonomo ? 1 : 0,
      payload.calle ?? null,
      payload.numero ?? null,
      payload.codpostal ?? null,
      payload.localidad ?? null,
      payload.calle_cups ?? null,
      payload.numero_cups ?? null,
      payload.codpostal_cups ?? null,
      payload.localidad_cups ?? null,
      payload.email ?? null,
      payload.movil ?? null,
      payload.iban ?? null,
      payload.cambio_titularidad ? 1 : 0,
      payload.tiene_placas ? 1 : 0,
      payload.observaciones ?? null,
      payload.servicios ?? null,
      payload.permanencia ?? 0,
      JSON.stringify(body),
    ],
  });

  // 10. Update comparativa status → awaiting_review (admin must assign company + commissions)
  await db.execute({
    sql: "UPDATE comparativas SET status = 'awaiting_review' WHERE id = ?",
    args: [comparativaId],
  });
  await recordStatusChange(
    db,
    comparativaId,
    "system",
    currentStatus,
    "awaiting_review",
  );

  // 11. Mark any pending sessions for this comparativa as completed
  await db.execute({
    sql: `UPDATE abarca_sessions SET status = 'completed'
          WHERE tenant = ? AND comparativa_id = ? AND status = 'pending'`,
    args: [tenant, comparativaId],
  });

  return NextResponse.json({ success: true });
}
