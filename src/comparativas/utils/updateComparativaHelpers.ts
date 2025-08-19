import { Client } from "@libsql/client";

export const updateComparativaStatus = async (
  tursoClient: Client,
  comparativa_id: string,
  status: string,
  tramite_id?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // SQL dinámico según si se proporciona tramite_id
    let query = `
      UPDATE comparativas
      SET status = ?
    `;

    // Array de argumentos para la consulta
    const args: string[] = [status];

    // Si tramite_id está presente, añadirlo a la actualización
    if (tramite_id) {
      query += `, tramite_id = ?`;
      args.push(tramite_id);
    }

    // Completar la consulta con la condición WHERE
    query += ` WHERE id = ?`;
    args.push(comparativa_id);

    const response = await tursoClient.execute({
      sql: query,
      args: args,
    });
    if (response.rowsAffected === 0) {
      return {
        success: false,
        error: "Comparativa no encontrada",
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error al actualizar comparativa:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
};

export const updateComparativaComissions = async (
  tursoClient: Client,
  comparativa_id: string,
  comision_fijo: number | undefined,
  comision_indexado: number | undefined,
  comision_sales_person_fijo: number | undefined,
  comision_sales_person_indexado: number | undefined
) => {
  try {
    let query = `
      UPDATE comparativas
      SET`;
    const params: (number | string)[] = [];
    const updates: string[] = [];

    if (comision_fijo !== undefined) {
      updates.push(`comision_fijo = ?`);
      params.push(comision_fijo);
    }

    if (comision_indexado !== undefined) {
      updates.push(`comision_indexado = ?`);
      params.push(comision_indexado);
    }

    if (comision_sales_person_fijo !== undefined) {
      updates.push(`comision_sales_person_fijo = ?`);
      params.push(comision_sales_person_fijo);
    }

    if (comision_sales_person_indexado !== undefined) {
      updates.push(`comision_sales_person_indexado = ?`);
      params.push(comision_sales_person_indexado);
    }

    query += ` ${updates.length === 0 ? "" : updates.join(", ")} WHERE id = ?`;
    params.push(comparativa_id);
    const response = await tursoClient.execute({
      sql: query,
      args: params,
    });

    if (response.rowsAffected === 0) {
      return {
        success: false,
        error: "Comparativa no encontrada",
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error al actualizar comisiones:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
};

/**
 * Comprehensive comparison update function for general updates
 * Supports updating any field of a comparison with proper validation
 */
export const updateComparativaGeneral = async (
  tursoClient: Client,
  comparativa_id: string,
  updates: {
    client?: string;
    service?: "Luz" | "Gas";
    plan?: string; // JSON stringified array
    status?: string;
    tramite_id?: string | null;
    comision_fijo?: number;
    comision_indexado?: number;
    comision_sales_person_fijo?: number;
    comision_sales_person_indexado?: number;
    notes?: string; // JSON stringified array
    user_id?: string;
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const updateFields: string[] = [];
    const params: (string | number | null)[] = [];

    // Build dynamic query based on provided fields
    Object.entries(updates).forEach(([field, value]) => {
      if (value !== undefined) {
        updateFields.push(`${field} = ?`);
        params.push(value);
      }
    });

    if (updateFields.length === 0) {
      return {
        success: false,
        error: "No fields to update provided",
      };
    }

    const query = `
      UPDATE comparativas
      SET ${updateFields.join(", ")}
      WHERE id = ?
    `;
    params.push(comparativa_id);

    const response = await tursoClient.execute({
      sql: query,
      args: params,
    });

    if (response.rowsAffected === 0) {
      return {
        success: false,
        error: "Comparativa no encontrada",
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error al actualizar comparativa:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
};
