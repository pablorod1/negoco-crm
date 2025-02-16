import { UpdatedFields } from "@/hooks/track-tramite-changes";
import {
  ClientDB,
  ContractDB,
  SignerDB,
  TramiteDB,
  TramiteFile,
} from "@/lib/types";
import { tursoClient } from "../client";
import { uploadFile } from "@/lib/firebase/data/uploadFiles";
import { addTramiteFiles } from "./addData";

const updateTramite = async (
  tramite: Partial<TramiteDB>,
  tramite_id: string
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
      if (tramite.status === "Verificado") {
        tramite.tramitation_date = new Date().toISOString(); // Asigna la fecha actual
      } else if (tramite.status === "Activo") {
        tramite.activation_date = new Date().toISOString(); // Asigna la fecha actual
        const oneYearLater = new Date();
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 1); // Asigna un año después
        tramite.renovation_date = oneYearLater.toISOString();
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
    await tursoClient().execute({ sql, args: [...values, tramite_id] });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const updateClient = async (
  client: Partial<ClientDB>,
  client_id: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const entries = Object.entries(client);

    if (entries.length === 0) {
      return { success: false, error: "No data provided to update" };
    }

    const setClause = entries.map(([key]) => `${key} = ?`).join(", "); // Usamos `?`

    const values = entries.map(([, value]) => value);

    const sql = `UPDATE clients SET ${setClause} WHERE id = ?`;

    // Ejecutamos la consulta con los parámetros correctamente
    await tursoClient().execute({ sql, args: [...values, client_id] });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const updateSigner = async (
  signer: Partial<SignerDB>,
  signer_id: string
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
    await tursoClient().execute({ sql, args: [...values, signer_id] });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const updateContract = async (
  contract: Partial<ContractDB>,
  contract_id: string
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
    await tursoClient().execute({ sql, args: [...values, contract_id] });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error as string,
    };
  }
};

export const updateTramiteComplete = async (
  changes: UpdatedFields,
  tramite_id?: string,
  client_id?: string,
  signer_id?: string,
  contract_ids?: string[],
  files?: File[]
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { tramite, client, signer, contracts } = changes;

    if (tramite && tramite_id) {
      const tramiteResult = await updateTramite(tramite, tramite_id);
      if (!tramiteResult.success) {
        return {
          success: false,
          error: tramiteResult.error,
        };
      }
    }

    if (client && client_id) {
      const clientResult = await updateClient(client, client_id);
      if (!clientResult.success) {
        return {
          success: false,
          error: clientResult.error,
        };
      }
    }

    if (signer && signer_id) {
      const signerResult = await updateSigner(signer, signer_id);
      if (!signerResult.success) {
        return {
          success: false,
          error: signerResult.error,
        };
      }
    }

    if (contracts && contract_ids) {
      contracts.forEach(async (contract, index) => {
        const contractResult = await updateContract(
          contract,
          contract_ids[index]
        );

        if (!contractResult.success) {
          return {
            success: false,
            error: contractResult.error,
          };
        }
      });
    }

    if (files && tramite_id) {
      const tramiteFiles: TramiteFile[] = [];
      for (const file of files) {
        try {
          const { downloadURL, previewURL } = await uploadFile(
            file,
            tramite_id
          );

          tramiteFiles.push({
            id: crypto.randomUUID(),
            tramite_id,
            filename: file.name,
            size: file.size,
            extension: file.name.split(".").pop() || "",
            upload_date: new Date().toISOString(),
            download_url: downloadURL,
            preview_url: previewURL || null,
          });
        } catch (error) {
          console.error(`Error uploading file ${file.name}:`, error);
          // Continúa con los siguientes archivos incluso si uno falla
        }
      }

      // Bulk insert file metadata if any files were successfully uploaded
      if (tramiteFiles.length > 0) {
        const insertResult = await addTramiteFiles(tramiteFiles);
        if (!insertResult.success) {
          throw new Error(
            `Error al guardar metadatos de archivos: ${insertResult.error}`
          );
        }
      }
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error as string,
    };
  }
};
