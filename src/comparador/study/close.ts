import type { Client, InValue, Transaction } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { acceptedProposalsError } from "./accepted";
import type { StudyClientData } from "./client-data";
import { OPEN_STATUSES } from "./comparativa";
import { proposalFileName, type ProposalRecord } from "./proposals";
import type { StudyRecord } from "./repository";
import { StudyError } from "./service";

/** Sube el PDF elegido a Storage y devuelve su enlace. */
export type ProposalUploader = (input: {
  path: string;
  data: Uint8Array;
  /** Por defecto, PDF. */
  contentType?: string;
}) => Promise<{ downloadUrl: string; remove: () => Promise<void> }>;

type Executor = Pick<Transaction, "execute">;

async function audit(
  db: Executor,
  comparativaId: string,
  userId: string,
  change: { type: string; field: string | null; oldValue: InValue; newValue: InValue; description: string },
) {
  await db.execute({
    sql: `INSERT INTO comparativa_changes
      (id, comparativa_id, user_id, change_type, field_name, old_value, new_value, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      randomUUID(),
      comparativaId,
      userId,
      change.type,
      change.field,
      change.oldValue === null ? null : String(change.oldValue),
      change.newValue === null ? null : String(change.newValue),
      change.description,
      new Date().toISOString(),
    ],
  });
}

const planOf = (proposal: ProposalRecord) => (proposal.document.offer.pricing === "indexed" ? "indexado" : "fijo");

/**
 * Completa el estudio con las propuestas que acepta el cliente: una fija, una
 * indexada, una de cada o de 2 a 3 fijas (comparativa múltiple). Sus PDFs
 * pasan a los documentos de la comparativa y la comparativa queda «Pendiente
 * de revisión» con la comercializadora de la principal (la primera), los
 * planes y la comisión de agencia de cada plan, la de su primera propuesta;
 * como cuando llega un estudio de Abarca. El reparto con el comercial lo
 * calcula la revisión con las reglas de siempre.
 *
 * Los PDFs se suben antes de la transacción; si la transacción falla, se borran.
 */
export async function closeStudy({
  client,
  study,
  accepted,
  userId,
  upload,
  clientData = null,
}: {
  client: Pick<Client, "execute" | "transaction">;
  study: StudyRecord;
  /** Las propuestas aceptadas con su PDF; la primera es la principal. */
  accepted: readonly { proposal: ProposalRecord; pdf: Uint8Array }[];
  userId: string;
  upload: ProposalUploader;
  /** Datos del cliente apuntados al completar; rellenan el trámite. */
  clientData?: StudyClientData | null;
}): Promise<{ fileIds: string[] }> {
  if (study.status === "closed") throw new StudyError("Este estudio ya está completado.", 409);
  if (accepted.some(({ proposal }) => proposal.studyId !== study.id)) {
    throw new StudyError("Esa propuesta no es de este estudio.", 404);
  }
  if (new Set(accepted.map(({ proposal }) => proposal.id)).size !== accepted.length) {
    throw new StudyError("Hay una propuesta repetida.", 400);
  }
  const invalid = acceptedProposalsError(accepted.map(({ proposal }) => (planOf(proposal) === "indexado" ? "indexed" : "fixed")));
  if (invalid) throw new StudyError(invalid, 400);
  const proposal = accepted[0].proposal;

  const subject = await client.execute({
    sql: "SELECT status FROM comparativas WHERE id = ? LIMIT 1",
    args: [study.comparativaId],
  });
  if (!OPEN_STATUSES.includes(String(subject.rows[0]?.status))) {
    throw new StudyError("La comparativa ya no está pendiente de estudio.", 409);
  }

  const organization = await client.execute("SELECT id FROM organization LIMIT 1");
  const organizationId = String(organization.rows[0]?.id ?? "");
  if (!organizationId) throw new Error("Tenant without organization");

  const files: { proposal: ProposalRecord; fileId: string; fileName: string; size: number; downloadUrl: string; remove: () => Promise<void> }[] = [];
  const removeUploaded = () =>
    Promise.all(files.map(({ remove }) => remove().catch((cause) => console.error("[comparador] orphan proposal PDF", cause))));
  try {
    for (const { proposal: item, pdf } of accepted) {
      const fileName = proposalFileName(item);
      const fileId = randomUUID();
      const stored = await upload({
        path: `${organizationId}/comparativas/${study.comparativaId}/${fileId}-${fileName}`,
        data: pdf,
      });
      files.push({ proposal: item, fileId, fileName, size: pdf.byteLength, ...stored });
    }
  } catch (error) {
    await removeUploaded();
    throw error;
  }

  const transaction = await client.transaction("write");
  try {
    const { rows } = await transaction.execute({
      sql: `SELECT status, plan, company_id, commission_segment, comision_fijo, comision_indexado
        FROM comparativas WHERE id = ? LIMIT 1`,
      args: [study.comparativaId],
    });
    const comparativa = rows[0];
    if (!comparativa || !OPEN_STATUSES.includes(String(comparativa.status))) {
      throw new StudyError("La comparativa ya no está pendiente de estudio.", 409);
    }
    const claimed = await transaction.execute({
      sql: "UPDATE comparison_studies SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'closed'",
      args: [study.id],
    });
    if (claimed.rowsAffected === 0) throw new StudyError("Este estudio ya está completado.", 409);

    const now = new Date().toISOString();
    for (const file of files) {
      await transaction.execute({
        sql: `INSERT INTO comparativa_files
          (id, comparativa_id, filename, size, extension, upload_date, download_url, preview_url)
          VALUES (?, ?, ?, ?, 'pdf', ?, ?, NULL)`,
        args: [file.fileId, study.comparativaId, file.fileName, file.size, now, file.downloadUrl],
      });
      await audit(transaction, study.comparativaId, userId, {
        type: "document_upload",
        field: "filename",
        oldValue: null,
        newValue: file.fileName,
        description: `Documento subido: ${file.fileName}`,
      });
    }

    // Los planes de las ofertas aceptadas: fijo, indexado o los dos.
    const plans = JSON.parse(String(comparativa.plan ?? "[]")) as string[];
    const missingPlans = [...new Set(accepted.map(({ proposal: item }) => planOf(item)))].filter((plan) => !plans.includes(plan));
    if (missingPlans.length > 0) {
      const next = JSON.stringify([...plans, ...missingPlans]);
      await transaction.execute({ sql: "UPDATE comparativas SET plan = ? WHERE id = ?", args: [next, study.comparativaId] });
      await audit(transaction, study.comparativaId, userId, {
        type: "plan_update",
        field: "plan",
        oldValue: JSON.stringify(plans),
        newValue: next,
        description: "Plan actualizado por el estudio Negoco Cloud",
      });
    }

    if (comparativa.company_id !== proposal.comercializadoraId) {
      await transaction.execute({
        sql: "UPDATE comparativas SET company_id = ? WHERE id = ?",
        args: [proposal.comercializadoraId, study.comparativaId],
      });
      await audit(transaction, study.comparativaId, userId, {
        type: "field_update",
        field: "company_id",
        oldValue: comparativa.company_id === null ? null : String(comparativa.company_id),
        newValue: proposal.comercializadoraId,
        description: `Comercializadora del estudio Negoco Cloud: ${proposal.comercializadoraName}`,
      });
    }

    if (comparativa.commission_segment === null) {
      await transaction.execute({
        sql: "UPDATE comparativas SET commission_segment = ?, commission_segment_origin = 'tariff' WHERE id = ?",
        args: [study.supply?.energy === "gas" ? "gas" : "luz_20td", study.comparativaId],
      });
    }

    // La comisión de cada plan, la de su primera propuesta (en una múltiple
    // de fijas, la principal). Como con Abarca: una comisión que ya estaba
    // puesta no se pisa; la revisión decide.
    for (const plan of ["fijo", "indexado"] as const) {
      const first = accepted.find(({ proposal: item }) => planOf(item) === plan)?.proposal;
      const commissionField = plan === "indexado" ? "comision_indexado" : "comision_fijo";
      if (!first || first.commission === null || comparativa[commissionField] !== null) continue;
      await transaction.execute({
        sql: `UPDATE comparativas SET ${commissionField} = ? WHERE id = ?`,
        args: [first.commission, study.comparativaId],
      });
      await audit(transaction, study.comparativaId, userId, {
        type: "commission_update",
        field: commissionField,
        oldValue: null,
        newValue: first.commission,
        description: `Comisión de agencia (${plan}) del estudio Negoco Cloud`,
      });
    }

    await transaction.execute({
      sql: "UPDATE comparativas SET status = 'awaiting_review' WHERE id = ?",
      args: [study.comparativaId],
    });
    await audit(transaction, study.comparativaId, userId, {
      type: "status_change",
      field: "status",
      oldValue: String(comparativa.status),
      newValue: "awaiting_review",
      description:
        accepted.length === 1
          ? "Estudio Negoco Cloud completado: pendiente de revisión"
          : `Estudio Negoco Cloud completado con ${accepted.length} propuestas aceptadas (${accepted
              .map(({ proposal: item }) => `${item.comercializadoraName} · ${item.productName}, ${planOf(item)}`)
              .join("; ")}): pendiente de revisión`,
    });

    for (const file of files) {
      await transaction.execute({
        sql: "UPDATE comparison_study_proposals SET chosen_at = ?, comparativa_file_id = ? WHERE id = ?",
        args: [now, file.fileId, file.proposal.id],
      });
    }
    await transaction.execute({
      sql: `UPDATE comparison_studies SET chosen_offer = ?, current_total = ?, chosen_total = ?,
          savings = ?, commission = ?, client_data = ?
        WHERE id = ?`,
      args: [
        JSON.stringify({
          proposalId: proposal.id,
          number: proposal.number,
          key: proposal.offerKey,
          comercializadoraId: proposal.comercializadoraId,
          comercializadoraName: proposal.comercializadoraName,
          productName: proposal.productName,
          feeEnergyPerMwh: proposal.feeEnergyPerMwh,
          ...(accepted.length > 1 ? { alsoAccepted: accepted.slice(1).map(({ proposal: item }) => item.id) } : {}),
        }),
        proposal.document.current?.cost.total ?? null,
        proposal.annualTotal,
        proposal.savings,
        proposal.commission,
        clientData ? JSON.stringify(clientData) : null,
        study.id,
      ],
    });
    await transaction.commit();
    return { fileIds: files.map(({ fileId }) => fileId) };
  } catch (error) {
    await transaction.rollback().catch(() => undefined);
    await removeUploaded();
    throw error;
  } finally {
    transaction.close();
  }
}
