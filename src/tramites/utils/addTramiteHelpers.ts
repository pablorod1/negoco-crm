import {
  ClientDB,
  ContractDB,
  SignerDB,
  TramiteDB,
  TramiteFile,
} from "@/tramites/types";
import { Client } from "@libsql/client";

export const addClient = async (
  client: ClientDB,
  tursoClient: Client
): Promise<{ success: boolean; error?: string }> => {
  try {
    const clientExists = await checkClientExists(
      client.id,
      client.document_number,
      tursoClient
    );

    if (clientExists) {
      return {
        success: true,
      };
    }

    // Construimos la dirección completa para geocodificar
    const direccionCompleta = `${client.address}, ${client.postal_code}, ${client.province}, España`;

    // Obtenemos las coordenadas desde OpenCage
    const openCageKey = process.env.GEOCODE_API_KEY;
    const geoRes = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(
        direccionCompleta
      )}&key=${openCageKey}`
    );
    const geoData = await geoRes.json();
    let coordinates: [number, number] | null = null;

    if (geoData.results.length > 0) {
      const { lat, lng } = geoData.results[0].geometry;
      coordinates = [lat, lng];
    }

    const query = `
      INSERT INTO clients (id, name, last_name, email, phone, address, document_number, document_type, type, IBAN, postal_code, province, city, coordinates)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Ejecutamos la consulta
    await tursoClient.execute({
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
        client.postal_code,
        client.province,
        client.city,
        coordinates ? JSON.stringify(coordinates) : null,
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

const checkClientExists = async (
  id: string,
  DNI: string,
  tursoClient: Client
) => {
  try {
    const res = await tursoClient.execute({
      sql: `SELECT * FROM clients WHERE id = ? AND document_number = ?`,
      args: [id, DNI],
    });

    return res.rows.length > 0;
  } catch (error) {
    console.error("Error al verificar si el cliente existe:", error);
    return false;
  }
};

export const addSigner = async (
  signer: SignerDB,
  tursoClient: Client
): Promise<{ success: boolean; error?: string }> => {
  try {
    const signerExists = await checkSignerExists(signer.id, tursoClient);

    if (signerExists) {
      return {
        success: true,
      };
    }

    const query = `
      INSERT INTO signers (id, name, last_name, email, phone, document_number, cargo, client_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Ejecutamos la consulta
    await tursoClient.execute({
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

const checkSignerExists = async (id: string, tursoClient: Client) => {
  try {
    const res = await tursoClient.execute({
      sql: `SELECT * FROM signers WHERE id = ?`,
      args: [id],
    });

    return res.rows.length > 0;
  } catch (error) {
    console.error("Error al verificar si el firmante existe:", error);
    return false;
  }
};

export const addTramite = async (
  tramite: TramiteDB,
  tursoClient: Client
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Preparamos la consulta SQL
    const query = `
      INSERT INTO tramites (id, creation_date, tramitation_date, activation_date, renovation_date, sales_name, comision, comision_sales_person, status, liquidez_status, notes, internal_notes, client_id, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Ejecutamos la consulta
    await tursoClient.execute({
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
        JSON.stringify(tramite.internal_notes),
        tramite.client_id,
        tramite.user_id,
      ],
    });

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

export const addContracts = async (
  contracts: ContractDB[],
  tursoClient: Client
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Construimos la consulta para inserción múltiple
    const placeholders = contracts
      .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .join(", ");

    const query = `
      INSERT INTO contracts (
        id, type, province, city, address, postal_code, 
        old_company, new_company, plan, consumption, CUPS, 
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
      contract.old_company,
      contract.new_company,
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
    await tursoClient.execute({
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
  tramite_id: string,
  tursoClient: Client
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Preparamos la consulta SQL

    const query = `
      INSERT INTO contracts (
        id, type, province, city, address, postal_code, 
        old_company, new_company, plan, consumption, CUPS, 
        pot1, pot2, pot3, pot4, pot5, pot6, 
        description, tramite_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Ejecutamos la consulta
    await tursoClient.execute({
      sql: query,
      args: [
        contract.id,
        contract.type,
        contract.province,
        contract.city,
        contract.address,
        contract.postal_code,
        contract.old_company,
        contract.new_company,
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
  files: TramiteFile[],
  tursoClient: Client
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

    await tursoClient.execute({
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
