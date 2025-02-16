import {
  ClientDB,
  ContractDB,
  SignerDB,
  TramiteDB,
  TramiteFile,
} from "@/lib/types";
import { tursoClient } from "../client";
import { uploadFile } from "@/lib/firebase/data/uploadFiles";

const addClient = async (
  client: ClientDB
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Preparamos la consulta SQL
    const query = `
      INSERT INTO clients (id, name, last_name, email, phone, address, document_number, document_type, type, IBAN)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Ejecutamos la consulta
    await tursoClient().execute({
      sql: query,
      args: [
        client.id,
        client.name,
        client.last_name,
        client.email,
        client.phone,
        client.address,
        client.document_number,
        client.document_type,
        client.type,
        client.IBAN,
      ],
    });

    // Obtenemos el ID del cliente insertado

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error al añadir cliente:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
};

const addSigner = async (
  signer: SignerDB
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Preparamos la consulta SQL
    const query = `
      INSERT INTO signers (id, name, last_name, email, phone, document_number, cargo, client_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Ejecutamos la consulta
    await tursoClient().execute({
      sql: query,
      args: [
        signer.id,
        signer.name,
        signer.last_name,
        signer.email,
        signer.phone,
        signer.document_number,
        signer.cargo || null,
        signer.client_id,
      ],
    });

    // Obtenemos el ID del firmante insertado

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error al añadir firmante:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
};

const addTramite = async (
  tramite: TramiteDB
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Preparamos la consulta SQL
    const query = `
      INSERT INTO tramites (id, creation_date, tramitation_date, activation_date, renovation_date, sales_name, comision, comision_sales_person, status, liquidez_status, notes, client_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Ejecutamos la consulta
    await tursoClient().execute({
      sql: query,
      args: [
        tramite.id,
        tramite.creation_date,
        tramite.tramitation_date,
        tramite.activation_date,
        tramite.renovation_date,
        tramite.sales_name,
        tramite.comision,
        tramite.comision_sales_person,
        tramite.status,
        tramite.liquidez_status || null,
        JSON.stringify(tramite.notes),
        tramite.client_id,
      ],
    });

    // Obtenemos el ID del trámite insertado

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error al añadir trámite:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
};

const addContracts = async (
  contracts: ContractDB[]
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Construimos la consulta para inserción múltiple
    const placeholders = contracts
      .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .join(", ");

    const query = `
      INSERT INTO contracts (
        id, type, province, city, address, postal_code, 
        company, plan, consumption, CUPS, 
        pot1, pot2, pot3, pot4, pot5, pot6, 
        description, tramite_id
      )
      VALUES ${placeholders}
    `;

    // Aplanamos los valores de todos los contratos en un solo array
    const values = contracts.flatMap((contract) => [
      contract.id,
      contract.type,
      contract.province,
      contract.city,
      contract.address,
      contract.postal_code,
      contract.company,
      contract.plan,
      contract.consumption,
      contract.CUPS,
      contract.pot1,
      contract.pot2,
      contract.pot3,
      contract.pot4,
      contract.pot5,
      contract.pot6,
      contract.description,
      contract.tramite_id,
    ]);

    // Ejecutamos la consulta
    await tursoClient().execute({
      sql: query,
      args: values,
    });

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error al añadir contratos:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
};

export const addContract = async (
  contract: ContractDB,
  tramite_id: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Preparamos la consulta SQL

    const query = `
      INSERT INTO contracts (
        id, type, province, city, address, postal_code, 
        company, plan, consumption, CUPS, 
        pot1, pot2, pot3, pot4, pot5, pot6, 
        description, tramite_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Ejecutamos la consulta
    await tursoClient().execute({
      sql: query,
      args: [
        contract.id,
        contract.type,
        contract.province,
        contract.city,
        contract.address,
        contract.postal_code,
        contract.company,
        contract.plan,
        contract.consumption,
        contract.CUPS,
        contract.pot1,
        contract.pot2,
        contract.pot3,
        contract.pot4,
        contract.pot5,
        contract.pot6,
        contract.description,
        tramite_id,
      ],
    });

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error al añadir contrato:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
};

export const addTramiteFiles = async (
  files: TramiteFile[]
): Promise<{ success: boolean; error?: string }> => {
  try {
    const query = `
      INSERT INTO tramite_files (id, tramite_id, filename, size, extension, upload_date, download_url, preview_url)
      VALUES ${files.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
    `;

    const params = files.flatMap((file) => [
      file.id,
      file.tramite_id,
      file.filename,
      file.size,
      file.extension,
      file.upload_date,
      file.download_url,
      file.preview_url || null,
    ]);

    await tursoClient().execute({
      sql: query,
      args: params,
    });

    return { success: true };
  } catch (error) {
    console.error("Error bulk inserting tramite files:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown insert error",
    };
  }
};

export const addCompleteTramite = async (
  tramite: TramiteDB,
  client: ClientDB,
  signer: SignerDB | null,
  contracts: ContractDB[],
  documents: File[]
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Add client
    const clientResult = await addClient(client);
    if (!clientResult.success) {
      throw new Error(`Error al añadir cliente: ${clientResult.error}`);
    }

    // Add signer if applicable
    if (
      (client.type === "Empresa" ||
        client.type === "Comunidad de Propietarios") &&
      signer
    ) {
      const signerResult = await addSigner(signer);
      if (!signerResult.success) {
        throw new Error(`Error al añadir firmante: ${signerResult.error}`);
      }
    }

    // Add tramite
    const tramiteResult = await addTramite(tramite);
    if (!tramiteResult.success) {
      throw new Error(`Error al añadir trámite: ${tramiteResult.error}`);
    }

    // Add contracts
    if (contracts && contracts.length > 0) {
      const contractsResult = await addContracts(contracts);
      if (!contractsResult.success) {
        throw new Error(`Error al añadir contratos: ${contractsResult.error}`);
      }
    }

    // Upload files and prepare metadata
    const tramiteFiles: TramiteFile[] = [];

    for (const file of documents) {
      try {
        const { downloadURL, previewURL } = await uploadFile(
          file,
          "tramites",
          tramite.id
        );

        tramiteFiles.push({
          id: crypto.randomUUID(),
          tramite_id: tramite.id,
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

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error al añadir trámite completo:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
};
