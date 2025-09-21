import { Client } from "@libsql/client";
import { formatDateTime } from "@/core/utils/format";

export type ComparativaChangeType =
  | "created"
  | "status_change"
  | "field_update"
  | "client_update"
  | "service_update"
  | "plan_update"
  | "commission_update"
  | "assignment_change"
  | "document_upload"
  | "document_delete"
  | "note_added"
  | "note_deleted"
  | "converted_to_contract"
  | "general_update"
  | "deleted";

export interface ComparativaChange {
  id: string;
  comparativa_id: string;
  user_id: string | null;
  change_type: ComparativaChangeType;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  description: string | null;
  created_at: string;
  user_name?: string;
}

type DBExecutor = Client;

/**
 * Formatea valores para mostrar en las descripciones de cambios
 */
export function formatChangeValue(value: unknown, fieldName?: string): string {
  if (value === null || value === undefined || value === "") {
    const fieldType = fieldName ? getFieldType(fieldName) : "text";
    if (fieldType === "number") return "0";
    if (fieldType === "date") return "Sin fecha";
    return "vacío";
  }

  if (typeof value === "number") {
    return value.toString();
  }

  if (fieldName && getFieldType(fieldName) === "date") {
    return formatDateTime(String(value));
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return String(value);
}

/**
 * Determina el tipo de un campo basado en su nombre
 */
export function getFieldType(fieldName: string): "number" | "date" | "text" {
  const lowerField = fieldName.toLowerCase();

  // Campos de fecha
  if (
    lowerField.includes("fecha") ||
    lowerField.includes("date") ||
    lowerField.includes("created_at") ||
    lowerField.includes("updated_at")
  ) {
    return "date";
  }

  // Campos numéricos
  if (
    lowerField.includes("comision") ||
    lowerField.includes("commission") ||
    lowerField.includes("fijo") ||
    lowerField.includes("indexado") ||
    lowerField.includes("amount") ||
    lowerField.includes("precio") ||
    lowerField.includes("price")
  ) {
    return "number";
  }

  return "text";
}

/**
 * Creates a new comparativa change record in the database
 */
export async function createComparativaChange(
  db: DBExecutor,
  change: Omit<ComparativaChange, "id" | "created_at">
): Promise<boolean> {
  try {
    const changeId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO comparativa_changes (
        id, comparativa_id, user_id, change_type, field_name, 
        old_value, new_value, description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        changeId,
        change.comparativa_id,
        change.user_id,
        change.change_type,
        change.field_name,
        change.old_value,
        change.new_value,
        change.description,
        now,
      ],
    });

    return true;
  } catch (error) {
    console.error("Error creating comparativa change:", error);
    return false;
  }
}

/**
 * Registra la creación de una comparativa
 */
export async function recordComparativaCreation(
  db: DBExecutor,
  comparativa_id: string,
  user_id: string | null,
  description?: string
): Promise<void> {
  await createComparativaChange(db, {
    comparativa_id,
    user_id,
    change_type: "created",
    field_name: null,
    old_value: null,
    new_value: null,
    description: description || "Comparativa creada",
  });
}

/**
 * Registra cambios de estado
 */
export async function recordStatusChange(
  db: DBExecutor,
  comparativa_id: string,
  user_id: string | null,
  old_status: string | null,
  new_status: string
): Promise<void> {
  const oldFormatted = formatChangeValue(old_status, "status");
  const newFormatted = formatChangeValue(new_status, "status");
  const description = `Estado actualizado de ${oldFormatted} a ${newFormatted}`;

  await createComparativaChange(db, {
    comparativa_id,
    user_id,
    change_type: "status_change",
    field_name: "status",
    old_value: old_status,
    new_value: new_status,
    description,
  });
}

/**
 * Registra cambios de cliente
 */
export async function recordClientChange(
  db: DBExecutor,
  comparativa_id: string,
  user_id: string | null,
  old_client: string | null,
  new_client: string
): Promise<void> {
  const oldFormatted = formatChangeValue(old_client, "client");
  const newFormatted = formatChangeValue(new_client, "client");
  const description = `Cliente actualizado de ${oldFormatted} a ${newFormatted}`;

  await createComparativaChange(db, {
    comparativa_id,
    user_id,
    change_type: "client_update",
    field_name: "client",
    old_value: old_client,
    new_value: new_client,
    description,
  });
}

/**
 * Registra cambios de servicio
 */
export async function recordServiceChange(
  db: DBExecutor,
  comparativa_id: string,
  user_id: string | null,
  old_service: string | null,
  new_service: string
): Promise<void> {
  const oldFormatted = formatChangeValue(old_service, "service");
  const newFormatted = formatChangeValue(new_service, "service");
  const description = `Servicio actualizado de ${oldFormatted} a ${newFormatted}`;

  await createComparativaChange(db, {
    comparativa_id,
    user_id,
    change_type: "service_update",
    field_name: "service",
    old_value: old_service,
    new_value: new_service,
    description,
  });
}

/**
 * Registra cambios de plan
 */
export async function recordPlanChange(
  db: DBExecutor,
  comparativa_id: string,
  user_id: string | null,
  old_plan: string[] | null,
  new_plan: string[]
): Promise<void> {
  const oldFormatted = formatChangeValue(old_plan, "plan");
  const newFormatted = formatChangeValue(new_plan, "plan");
  const description = `Plan actualizado de ${oldFormatted} a ${newFormatted}`;

  await createComparativaChange(db, {
    comparativa_id,
    user_id,
    change_type: "plan_update",
    field_name: "plan",
    old_value: old_plan ? JSON.stringify(old_plan) : null,
    new_value: JSON.stringify(new_plan),
    description,
  });
}

/**
 * Registra cambios de comisiones
 */
export async function recordCommissionChange(
  db: DBExecutor,
  comparativa_id: string,
  user_id: string | null,
  field_name: string,
  old_value: number | null,
  new_value: number
): Promise<void> {
  const oldFormatted = formatChangeValue(old_value, field_name);
  const newFormatted = formatChangeValue(new_value, field_name);
  const description = `${getFieldDisplayName(field_name)} actualizada de ${oldFormatted} a ${newFormatted}`;

  await createComparativaChange(db, {
    comparativa_id,
    user_id,
    change_type: "commission_update",
    field_name,
    old_value: old_value?.toString() || null,
    new_value: new_value.toString(),
    description,
  });
}

/**
 * Registra cambios de asignación
 */
export async function recordAssignmentChange(
  db: DBExecutor,
  comparativa_id: string,
  user_id: string | null,
  old_user_id: string | null,
  new_user_id: string,
  old_user_name?: string,
  new_user_name?: string
): Promise<void> {
  const oldFormatted =
    old_user_name || formatChangeValue(old_user_id, "assignment");
  const newFormatted =
    new_user_name || formatChangeValue(new_user_id, "assignment");
  const description = `Asignación actualizada de ${oldFormatted} a ${newFormatted}`;

  await createComparativaChange(db, {
    comparativa_id,
    user_id,
    change_type: "assignment_change",
    field_name: "user_id",
    old_value: old_user_id,
    new_value: new_user_id,
    description,
  });
}

/**
 * Registra subida de documentos
 */
export async function recordDocumentUpload(
  db: DBExecutor,
  comparativa_id: string,
  user_id: string | null,
  filename: string
): Promise<void> {
  await createComparativaChange(db, {
    comparativa_id,
    user_id,
    change_type: "document_upload",
    field_name: "filename",
    old_value: null,
    new_value: filename,
    description: `Documento subido: ${filename}`,
  });
}

/**
 * Registra eliminación de documentos
 */
export async function recordDocumentDelete(
  db: DBExecutor,
  comparativa_id: string,
  user_id: string | null,
  filename: string
): Promise<void> {
  await createComparativaChange(db, {
    comparativa_id,
    user_id,
    change_type: "document_delete",
    field_name: "filename",
    old_value: filename,
    new_value: null,
    description: `Documento eliminado: ${filename}`,
  });
}

/**
 * Registra adición de notas
 */
export async function recordNoteAdded(
  db: DBExecutor,
  comparativa_id: string,
  user_id: string | null,
  note_content: string
): Promise<void> {
  const shortNote =
    note_content.length > 50
      ? note_content.substring(0, 50) + "..."
      : note_content;

  await createComparativaChange(db, {
    comparativa_id,
    user_id,
    change_type: "note_added",
    field_name: "note",
    old_value: null,
    new_value: note_content,
    description: `Nota añadida: "${shortNote}"`,
  });
}

/**
 * Registra eliminación de notas
 */
export async function recordNoteDeleted(
  db: DBExecutor,
  comparativa_id: string,
  user_id: string | null,
  note_content: string
): Promise<void> {
  const shortNote =
    note_content.length > 50
      ? note_content.substring(0, 50) + "..."
      : note_content;

  await createComparativaChange(db, {
    comparativa_id,
    user_id,
    change_type: "note_deleted",
    field_name: "note",
    old_value: note_content,
    new_value: null,
    description: `Nota eliminada: "${shortNote}"`,
  });
}

/**
 * Registra conversión a trámite
 */
export async function recordConvertedToContract(
  db: DBExecutor,
  comparativa_id: string,
  user_id: string | null,
  tramite_id: string
): Promise<void> {
  await createComparativaChange(db, {
    comparativa_id,
    user_id,
    change_type: "converted_to_contract",
    field_name: "tramite_id",
    old_value: null,
    new_value: tramite_id,
    description: `Comparativa convertida a trámite: ${tramite_id}`,
  });
}

/**
 * Registra actualizaciones generales con múltiples campos
 */
export async function recordGeneralUpdate(
  db: DBExecutor,
  comparativa_id: string,
  user_id: string | null,
  changes: Record<string, { old: unknown; new: unknown }>
): Promise<void> {
  // Crear un registro para cada campo cambiado
  for (const [fieldName, change] of Object.entries(changes)) {
    const oldFormatted = formatChangeValue(change.old, fieldName);
    const newFormatted = formatChangeValue(change.new, fieldName);
    const description = `${getFieldDisplayName(fieldName)} actualizado de ${oldFormatted} a ${newFormatted}`;

    await createComparativaChange(db, {
      comparativa_id,
      user_id,
      change_type: "general_update",
      field_name: fieldName,
      old_value:
        typeof change.old === "object"
          ? JSON.stringify(change.old)
          : String(change.old || ""),
      new_value:
        typeof change.new === "object"
          ? JSON.stringify(change.new)
          : String(change.new),
      description,
    });
  }
}

/**
 * Registra eliminación de comparativa
 */
export async function recordComparativaDeleted(
  db: DBExecutor,
  comparativa_id: string,
  user_id: string | null,
  description?: string
): Promise<void> {
  await createComparativaChange(db, {
    comparativa_id,
    user_id,
    change_type: "deleted",
    field_name: null,
    old_value: null,
    new_value: null,
    description: description || "Comparativa eliminada",
  });
}

/**
 * Obtiene el historial de cambios de una comparativa
 */
export async function getComparativaChanges(
  db: DBExecutor,
  comparativa_id: string
): Promise<ComparativaChange[]> {
  try {
    const result = await db.execute({
      sql: `SELECT cc.*, u.name as user_name 
            FROM comparativa_changes cc
            LEFT JOIN user u ON cc.user_id = u.id
            WHERE cc.comparativa_id = ?
            ORDER BY cc.created_at DESC`,
      args: [comparativa_id],
    });

    return result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      comparativa_id: row.comparativa_id as string,
      user_id: row.user_id as string | null,
      change_type: row.change_type as ComparativaChangeType,
      field_name: row.field_name as string | null,
      old_value: row.old_value as string | null,
      new_value: row.new_value as string | null,
      description: row.description as string | null,
      created_at: row.created_at as string,
      user_name: row.user_name as string | undefined,
    }));
  } catch (error) {
    console.error("Error obteniendo cambios de comparativa:", error);
    return [];
  }
}

/**
 * Convierte nombres de campo técnicos a nombres amigables para el usuario
 */
export function getFieldDisplayName(fieldName: string): string {
  const fieldMap: Record<string, string> = {
    // Campos básicos
    client: "Cliente",
    service: "Servicio",
    plan: "Plan",
    status: "Estado",
    user_id: "Asignado a",

    // Comisiones
    comision_fijo: "Comisión fija",
    comision_indexado: "Comisión indexada",
    comision_sales_person_fijo: "Comisión comercial fija",
    comision_sales_person_indexado: "Comisión comercial indexada",

    // Documentos y notas
    filename: "Archivo",
    note: "Nota",
    tramite_id: "Trámite",

    // Fechas
    creation_date: "Fecha de creación",
    created_at: "Creado en",
    updated_at: "Actualizado en",
  };

  return fieldMap[fieldName] || fieldName;
}
