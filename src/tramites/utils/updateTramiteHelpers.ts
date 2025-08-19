import { NOW_DATE, RENOVATION_DATE } from "@/dashboard/constants";
import { ClientDB, ContractDB, SignerDB, TramiteDB } from "@/tramites/types";
import { Client } from "@libsql/client";

export const updateTramite = async (
  tramite: Partial<TramiteDB>,
  tramite_id: string,
  tursoClient: Client
): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const entries = Object.entries(tramite);

    if (entries.length === 0) {
      return { success: false, error: "No data provided to update" };
    }

    // Verificar si el estado se actualiza y asignar las fechas correspondientes
    if (tramite.status) {
      if (
        tramite.tramitation_date === "" &&
        (tramite.status === "Verificado" ||
          tramite.status === "Procesando" ||
          tramite.status === "Pendiente de Firma" ||
          tramite.status === "Activo")
      ) {
        tramite.tramitation_date = new Date().toISOString(); // Asigna la fecha actual
      }

      if (tramite.status === "Activo") {
        tramite.activation_date = NOW_DATE.toISOString(); // Asigna la fecha actual
        tramite.renovation_date = RENOVATION_DATE.toISOString();
        tramite.liquidez_status = "Pendiente de Cobro";
      }
    }

    // Generar la cláusula SET con las columnas y valores a actualizar
    const setClause = Object.entries(tramite)
      .map(([key]) => `${key} = ?`)
      .join(", ");

    // Asegurarse de que los valores sean adecuados
    const values = Object.entries(tramite).map(([, value]) =>
      Array.isArray(value) ? JSON.stringify(value) : value
    );

    const sql = `UPDATE tramites SET ${setClause} WHERE id = ?`;

    // Ejecutar la consulta con los valores correctos
    await tursoClient.execute({ sql, args: [...values, tramite_id] });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export const updateClient = async (
  client: Partial<ClientDB>,
  client_id: string,
  tursoClient: Client
): Promise<{ success: boolean; error?: string }> => {
  try {
    const entries = Object.entries(client);

    if (entries.length === 0) {
      return { success: false, error: "No data provided to update" };
    }

    const setClause = entries.map(([key]) => `${key} = ?`).join(", "); // Usamos `?`

    const values = entries.map(([, value]) =>
      typeof value === "string" ? value : JSON.stringify(value)
    );

    const sql = `UPDATE clients SET ${setClause} WHERE id = ?`;

    // Ejecutamos la consulta con los parámetros correctamente
    await tursoClient.execute({ sql, args: [...values, client_id] });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export const updateSigner = async (
  signer: Partial<SignerDB>,
  signer_id: string,
  tursoClient: Client
): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const entries = Object.entries(signer);

    if (entries.length === 0) {
      return { success: false, error: "No data provided to update" };
    }

    const setClause = entries.map(([key]) => `${key} = ?`).join(", "); // Usamos `?`

    const values = entries.map(([, value]) => value);

    const sql = `UPDATE signers SET ${setClause} WHERE id = ?`;

    // Ejecutamos la consulta con los parámetros correctamente
    await tursoClient.execute({ sql, args: [...values, signer_id] });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export const updateContract = async (
  contract: Partial<ContractDB>,
  contract_id: string,
  tursoClient: Client
): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const entries = Object.entries(contract);

    if (entries.length === 0) {
      return { success: false, error: "No data provided to update" };
    }

    const setClause = entries.map(([key]) => `${key} = ?`).join(", "); // Usamos `?`

    const values = entries.map(([, value]) => value);

    const sql = `UPDATE contracts SET ${setClause} WHERE id = ?`;
    // Ejecutamos la consulta con los parámetros correctamente
    await tursoClient.execute({ sql, args: [...values, contract_id] });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
