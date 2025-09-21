import { Client, Transaction } from "@libsql/client";
import {
  TramiteChange,
  TramiteChangeType,
} from "../types/tramite-changes.types";
import { formatDateTime } from "@/core/utils/format";

/**
 * Utility functions for managing tramite changes history
 */

type DBExecutor = Client | Transaction;

/**
 * Format values for display in change descriptions
 */
function formatChangeValue(
  value: string | null,
  fieldType: "number" | "date" | "text" = "text"
): string {
  if (value === null || value === undefined || value === "") {
    return fieldType === "number" ? "0" : "Sin asignar";
  }

  switch (fieldType) {
    case "number":
      // Handle numeric values - convert empty or null to 0
      const numValue = parseFloat(value);
      return isNaN(numValue) ? "0" : value;

    case "date":
      // Handle date values - format them nicely
      try {
        if (value.includes("-") || value.includes("/")) {
          return formatDateTime(value);
        }
        return value;
      } catch {
        return value;
      }

    case "text":
    default:
      return value;
  }
}

/**
 * Determine field type based on field name for proper formatting
 */
function getFieldType(fieldName: string): "number" | "date" | "text" {
  // Date fields
  if (fieldName.includes("date") || fieldName.includes("fecha")) {
    return "date";
  }

  // Number fields
  if (
    fieldName.includes("comision") ||
    fieldName.includes("commission") ||
    fieldName.includes("consumption") ||
    fieldName.includes("pot") ||
    fieldName === "comision" ||
    fieldName === "comision_sales_person"
  ) {
    return "number";
  }

  return "text";
}

/**
 * Creates a new tramite change record in the database
 */
export async function createTramiteChange(
  db: DBExecutor,
  change: Omit<TramiteChange, "id" | "created_at">
): Promise<boolean> {
  try {
    const changeId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO tramite_changes (
        id, tramite_id, user_id, change_type, field_name, 
        old_value, new_value, description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        changeId,
        change.tramite_id,
        change.user_id,
        change.change_type,
        change.field_name || null,
        change.old_value || null,
        change.new_value || null,
        change.description || null,
        now,
      ],
    });

    return true;
  } catch (error) {
    console.error("Error creating tramite change:", error);
    return false;
  }
}

/**
 * Records multiple field changes in a single operation
 */
export async function recordFieldChanges(
  db: DBExecutor,
  tramiteId: string,
  userId: string,
  changes: Array<{
    field_name: string;
    old_value: string | null;
    new_value: string | null;
    description?: string;
  }>
): Promise<boolean> {
  try {
    const promises = changes.map((change) =>
      createTramiteChange(db, {
        tramite_id: tramiteId,
        user_id: userId,
        change_type: "field_update" as TramiteChangeType,
        field_name: change.field_name,
        old_value: change.old_value,
        new_value: change.new_value,
        description:
          change.description || `Campo ${change.field_name} actualizado`,
      })
    );

    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error("Error recording field changes:", error);
    return false;
  }
}

/**
 * Records a status change with special handling
 */
export async function recordStatusChange(
  db: DBExecutor,
  tramiteId: string,
  userId: string,
  oldStatus: string,
  newStatus: string,
  description?: string
): Promise<boolean> {
  return createTramiteChange(db, {
    tramite_id: tramiteId,
    user_id: userId,
    change_type: "status_change",
    field_name: "status",
    old_value: oldStatus,
    new_value: newStatus,
    description:
      description || `Estado cambiado de "${oldStatus}" a "${newStatus}"`,
  });
}

/**
 * Records a document upload/deletion
 */
export async function recordDocumentChange(
  db: DBExecutor,
  tramiteId: string,
  userId: string,
  action: "upload" | "delete",
  fileName: string,
  fileType?: string
): Promise<boolean> {
  return createTramiteChange(db, {
    tramite_id: tramiteId,
    user_id: userId,
    change_type: action === "upload" ? "document_upload" : "document_delete",
    field_name: "documents",
    old_value: action === "delete" ? fileName : null,
    new_value: action === "upload" ? fileName : null,
    description:
      action === "upload"
        ? `Documento "${fileName}" subido${fileType ? ` (${fileType})` : ""}`
        : `Documento "${fileName}" eliminado`,
  });
}

/**
 * Records a note addition
 */
export async function recordNoteChange(
  db: DBExecutor,
  tramiteId: string,
  userId: string,
  noteContent: string,
  noteType: "public" | "internal" = "public"
): Promise<boolean> {
  return createTramiteChange(db, {
    tramite_id: tramiteId,
    user_id: userId,
    change_type: "note_added",
    field_name: noteType === "internal" ? "internal_notes" : "notes",
    old_value: null,
    new_value: noteContent,
    description: `Nota ${noteType === "internal" ? "interna" : "pública"} añadida`,
  });
}

/**
 * Records the creation of a tramite
 */
export async function recordTramiteCreation(
  db: DBExecutor,
  tramiteId: string,
  userId: string,
  description?: string
): Promise<boolean> {
  return createTramiteChange(db, {
    tramite_id: tramiteId,
    user_id: userId,
    change_type: "created",
    field_name: null,
    old_value: null,
    new_value: null,
    description: description || "Trámite creado",
  });
}

/**
 * Records assignment changes
 */
export async function recordAssignmentChange(
  db: DBExecutor,
  tramiteId: string,
  userId: string,
  oldAssigneeId: string | null,
  newAssigneeId: string,
  oldAssigneeName?: string,
  newAssigneeName?: string
): Promise<boolean> {
  return createTramiteChange(db, {
    tramite_id: tramiteId,
    user_id: userId,
    change_type: "assignment_change",
    field_name: "user_id",
    old_value: oldAssigneeId,
    new_value: newAssigneeId,
    description: `Asignación cambiada${oldAssigneeName ? ` de ${oldAssigneeName}` : ""}${newAssigneeName ? ` a ${newAssigneeName}` : ""}`,
  });
}

/**
 * Utility function to compare two objects and get the differences
 */
function getObjectDifferences(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  excludeFields: string[] = ["id", "created_at", "updated_at"]
): Array<{
  field_name: string;
  old_value: string | null;
  new_value: string | null;
}> {
  const differences: Array<{
    field_name: string;
    old_value: string | null;
    new_value: string | null;
  }> = [];

  // Get all unique keys from both objects
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    // Skip excluded fields
    if (excludeFields.includes(key)) continue;

    const oldValue = oldObj[key];
    const newValue = newObj[key];

    // Convert values to strings for comparison, handling null/undefined
    const oldStr =
      oldValue === null || oldValue === undefined ? null : String(oldValue);
    const newStr =
      newValue === null || newValue === undefined ? null : String(newValue);

    // Only record if values are different
    if (oldStr !== newStr) {
      differences.push({
        field_name: key,
        old_value: oldStr,
        new_value: newStr,
      });
    }
  }

  return differences;
}

/**
 * Records contract-related changes with granular field tracking
 */
export async function recordContractChange(
  db: DBExecutor,
  tramiteId: string,
  userId: string,
  action: "created" | "updated" | "deleted",
  contractData?: {
    oldContract?: Record<string, unknown>;
    newContract?: Record<string, unknown>;
    contractId?: string;
  }
): Promise<boolean> {
  try {
    if (
      action === "updated" &&
      contractData?.oldContract &&
      contractData?.newContract
    ) {
      // For updates, track individual field changes
      const differences = getObjectDifferences(
        contractData.oldContract,
        contractData.newContract
      );

      if (differences.length === 0) {
        // No changes detected
        return true;
      }

      // Record each field change individually
      const changePromises = differences.map((diff) => {
        const fieldType = getFieldType(diff.field_name);
        const formattedOldValue = formatChangeValue(diff.old_value, fieldType);
        const formattedNewValue = formatChangeValue(diff.new_value, fieldType);

        return createTramiteChange(db, {
          tramite_id: tramiteId,
          user_id: userId,
          change_type: "contract_updated",
          field_name: `contract.${diff.field_name}`,
          old_value: diff.old_value,
          new_value: diff.new_value,
          description: `Campo del contrato "${diff.field_name}" actualizado de ${formattedOldValue} a ${formattedNewValue}`,
        });
      });

      await Promise.all(changePromises);
      return true;
    } else {
      // For created/deleted, record single change
      const contractInfo =
        contractData?.contractId ||
        (typeof contractData?.newContract === "object" &&
        contractData.newContract !== null &&
        "id" in contractData.newContract
          ? String(contractData.newContract.id)
          : null) ||
        (typeof contractData?.oldContract === "object" &&
        contractData.oldContract !== null &&
        "id" in contractData.oldContract
          ? String(contractData.oldContract.id)
          : null) ||
        "Contrato";

      return createTramiteChange(db, {
        tramite_id: tramiteId,
        user_id: userId,
        change_type:
          action === "created" ? "contract_created" : "contract_deleted",
        field_name: "contracts",
        old_value: action === "deleted" ? contractInfo : null,
        new_value: action === "created" ? contractInfo : null,
        description:
          action === "created" ? "Contrato creado" : "Contrato eliminado",
      });
    }
  } catch (error) {
    console.error("Error recording contract change:", error);
    return false;
  }
}

/**
 * Records commission changes
 */
export async function recordCommissionChange(
  db: DBExecutor,
  tramiteId: string,
  userId: string,
  field: "comision" | "comision_sales_person",
  oldValue: number | null,
  newValue: number | null
): Promise<boolean> {
  const fieldName = field === "comision" ? "Comisión" : "Comisión vendedor";
  const formattedOldValue = formatChangeValue(
    oldValue?.toString() || null,
    "number"
  );
  const formattedNewValue = formatChangeValue(
    newValue?.toString() || null,
    "number"
  );

  return createTramiteChange(db, {
    tramite_id: tramiteId,
    user_id: userId,
    change_type: "field_update",
    field_name: field,
    old_value: oldValue?.toString() || null,
    new_value: newValue?.toString() || null,
    description: `${fieldName} actualizada de ${formattedOldValue} a ${formattedNewValue}`,
  });
}

/**
 * Records date changes
 */
export async function recordDateChange(
  db: DBExecutor,
  tramiteId: string,
  userId: string,
  dateField: string,
  oldDate: string | null,
  newDate: string | null
): Promise<boolean> {
  const fieldNames: Record<string, string> = {
    activation_date: "Fecha de activación",
    tramitation_date: "Fecha de tramitación",
    renovation_date: "Fecha de renovación",
    collection_date: "Fecha de cobro",
    payment_date: "Fecha de pago",
  };

  const displayName = fieldNames[dateField] || dateField;
  const formattedOldDate = formatChangeValue(oldDate, "date");
  const formattedNewDate = formatChangeValue(newDate, "date");

  let description = `${displayName} actualizada`;
  if (oldDate && newDate) {
    description += ` de ${formattedOldDate} a ${formattedNewDate}`;
  } else if (!oldDate && newDate) {
    description += ` a ${formattedNewDate}`;
  } else if (oldDate && !newDate) {
    description += ` (eliminada desde ${formattedOldDate})`;
  }

  return createTramiteChange(db, {
    tramite_id: tramiteId,
    user_id: userId,
    change_type: "field_update",
    field_name: dateField,
    old_value: oldDate,
    new_value: newDate,
    description,
  });
}

/**
 * Records client information changes
 */
export async function recordClientChange(
  db: DBExecutor,
  tramiteId: string,
  userId: string,
  changes: Array<{
    field: string;
    oldValue: string | null;
    newValue: string | null;
  }>
): Promise<boolean> {
  const fieldNames: Record<string, string> = {
    name: "Nombre",
    last_name: "Apellidos",
    email: "Email",
    phone: "Teléfono",
    address: "Dirección",
    postal_code: "Código postal",
    province: "Provincia",
    city: "Ciudad",
    document_number: "Número de documento",
    document_type: "Tipo de documento",
    IBAN: "IBAN",
    type: "Tipo de cliente",
  };

  try {
    const promises = changes.map((change) => {
      const displayName = fieldNames[change.field] || change.field;
      const fieldType = getFieldType(change.field);
      const formattedOldValue = formatChangeValue(change.oldValue, fieldType);
      const formattedNewValue = formatChangeValue(change.newValue, fieldType);

      return createTramiteChange(db, {
        tramite_id: tramiteId,
        user_id: userId,
        change_type: "client_update",
        field_name: `client.${change.field}`,
        old_value: change.oldValue,
        new_value: change.newValue,
        description: `${displayName} del cliente actualizado de ${formattedOldValue} a ${formattedNewValue}`,
      });
    });

    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error("Error recording client changes:", error);
    return false;
  }
}

/**
 * Records signer information changes
 */
export async function recordSignerChange(
  db: DBExecutor,
  tramiteId: string,
  userId: string,
  changes: Array<{
    field: string;
    oldValue: string | null;
    newValue: string | null;
  }>
): Promise<boolean> {
  const fieldNames: Record<string, string> = {
    name: "Nombre del firmante",
    last_name: "Apellidos del firmante",
    email: "Email del firmante",
    phone: "Teléfono del firmante",
    document_number: "Documento del firmante",
    document_type: "Tipo de documento del firmante",
  };

  try {
    const promises = changes.map((change) => {
      const displayName = fieldNames[change.field] || change.field;
      const fieldType = getFieldType(change.field);
      const formattedOldValue = formatChangeValue(change.oldValue, fieldType);
      const formattedNewValue = formatChangeValue(change.newValue, fieldType);

      return createTramiteChange(db, {
        tramite_id: tramiteId,
        user_id: userId,
        change_type: "signer_update",
        field_name: `signer.${change.field}`,
        old_value: change.oldValue,
        new_value: change.newValue,
        description: `${displayName} actualizado de ${formattedOldValue} a ${formattedNewValue}`,
      });
    });

    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error("Error recording signer changes:", error);
    return false;
  }
}

/**
 * Gets the change history for a tramite
 */
export async function getTramiteChanges(
  db: DBExecutor,
  tramiteId: string,
  limit?: number
): Promise<TramiteChange[]> {
  try {
    const sql = limit
      ? `SELECT tc.*, u.name as user_name
         FROM tramite_changes tc
         LEFT JOIN user u ON tc.user_id = u.id
         WHERE tc.tramite_id = ?
         ORDER BY tc.created_at DESC
         LIMIT ?`
      : `SELECT tc.*, u.name as user_name
         FROM tramite_changes tc
         LEFT JOIN user u ON tc.user_id = u.id
         WHERE tc.tramite_id = ?
         ORDER BY tc.created_at DESC`;

    const args = limit ? [tramiteId, limit] : [tramiteId];

    const result = await db.execute({
      sql,
      args,
    });

    return result.rows.map((row) => ({
      id: row.id as string,
      tramite_id: row.tramite_id as string,
      user_id: row.user_id as string,
      change_type: row.change_type as TramiteChangeType,
      field_name: row.field_name as string | null,
      old_value: row.old_value as string | null,
      new_value: row.new_value as string | null,
      description: row.description as string | null,
      created_at: row.created_at as string,
      user_name: row.user_name as string | null,
    }));
  } catch (error) {
    console.error("Error getting tramite changes:", error);
    return [];
  }
}
