import {
  ClientDB,
  ContractDB,
  EditTramiteFormData,
  SignerDB,
  TramiteDB,
  TramiteFile,
} from "@/lib/core/types";
import { getTursoClient } from "@/lib/libsql/client";
import { getSubcomerciales } from "@/lib/libsql/users/getSubcomerciales";
import { Client } from "@libsql/client";
import { NextRequest, NextResponse } from "next/server";

// Tipo para los resultados de la consulta de trámite con usuario
interface TramiteQueryResult
  extends Omit<TramiteDB, "notes" | "internal_notes"> {
  notes: string; // En la BD está como string, se convierte a string[] después
  internal_notes: string; // En la BD está como string, se convierte a string[] después
  user_id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  user_image: string | null;
  updated_by_name: string;
  updated_by_email: string;
  updated_by_role: string;
  updated_by_image: string | null;
  updated_by: string;
  updated_at: string;
}

/**
 * Ejecuta una consulta en la base de datos y devuelve los resultados tipados
 */
async function executeQuery<T>(
  query: string,
  args: string[],
  tursoClient: Client
): Promise<T[]> {
  const result = await tursoClient.execute({ sql: query, args });
  return result.rows as T[];
}

export async function POST(req: NextRequest) {
  try {
    const { id, role, user_id } = await req.json();

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    const tursoClient = getTursoClient(req);

    if (!tursoClient) {
      return NextResponse.json(
        {
          success: false,
          error: "Database client not initialized",
        },
        { status: 500 }
      );
    }

    // Construir la consulta base
    let tramiteQuery = `
      SELECT t.*, 
      u.id as user_id, 
      u.name as user_name, 
      u.email as user_email, 
      u.role as user_role, 
      u.image as user_image,
      ub.name as updated_by_name,
      ub.image as updated_by_image,
      ub.email as updated_by_email,
      ub.role as updated_by_role
      FROM tramites t
      INNER JOIN user u ON t.user_id = u.id
      LEFT JOIN user ub ON t.updated_by = ub.id
      WHERE t.id = ?`;

    let queryParams = [id];

    // Aplicar restricciones de acceso según el rol
    if (role === "2") {
      // Obtener subcomerciales si existen
      const subcomercialesRes = await getSubcomerciales(tursoClient, user_id);
      const subcomercialesIds =
        subcomercialesRes.success && subcomercialesRes.ids
          ? subcomercialesRes.ids
          : [];

      // Modificar la consulta según los permisos
      if (subcomercialesIds.length > 0) {
        // Puede acceder a sus trámites y a los de sus subcomerciales
        const placeholders = subcomercialesIds.map(() => "?").join(",");
        tramiteQuery += ` AND (t.user_id = ? OR t.user_id IN (${placeholders}))`;
        queryParams = [...queryParams, user_id, ...subcomercialesIds];
      } else {
        // Solo puede acceder a sus propios trámites
        tramiteQuery += ` AND t.user_id = ?`;
        queryParams = [...queryParams, user_id];
      }
    }

    // Ejecutar todas las consultas en paralelo
    const [
      tramiteResult,
      clientResult,
      contractsResult,
      signerResult,
      filesResult,
    ] = await Promise.all([
      executeQuery<TramiteQueryResult>(tramiteQuery, queryParams, tursoClient),
      executeQuery<ClientDB>(
        `SELECT * FROM clients WHERE id = (SELECT client_id FROM tramites WHERE id = ?)`,
        [id],
        tursoClient
      ),
      executeQuery<ContractDB>(
        `SELECT * FROM contracts WHERE tramite_id = ?`,
        [id],
        tursoClient
      ),
      executeQuery<SignerDB>(
        `SELECT s.* FROM signers s 
             INNER JOIN tramites t ON t.client_id = s.client_id 
             WHERE t.id = ?`,
        [id],
        tursoClient
      ),
      executeQuery<TramiteFile>(
        `SELECT * FROM tramite_files WHERE tramite_id = ?`,
        [id],
        tursoClient
      ),
    ]);

    // Si no se encuentra el trámite o no tiene permiso, devolver un status 403
    // que será manejado por el cliente como una redirección
    if (tramiteResult.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No tienes permiso para acceder a este trámite",
        },
        { status: 403 }
      );
    }

    // Procesamos los datos del trámite separando los campos del usuario
    const tramiteRow = tramiteResult[0];
    const {
      user_name,
      user_email,
      user_role,
      user_image,
      updated_by_name,
      updated_by_email,
      updated_by_role,
      updated_by_image,
      notes: notesString,
      internal_notes: internalNotes,
      ...tramiteData
    } = tramiteRow;

    // Construir el objeto de respuesta conforme a EditTramiteFormData
    const responseData: EditTramiteFormData = {
      tramite: {
        ...tramiteData,
        notes: JSON.parse(notesString), // Convertir de string a array
        internal_notes: JSON.parse(internalNotes) || [], // Asegurar que sea un array
        user: {
          id: tramiteData.user_id,
          name: user_name,
          email: user_email,
          role: user_role,
          image: user_image,
        },
        updated_by: updated_by_name
          ? {
              name: updated_by_name,
              email: updated_by_email,
              role: updated_by_role,
              image: updated_by_image,
            }
          : null,
        updated_at: tramiteData.updated_at,
      },
      client: clientResult[0],
      contracts: contractsResult,
      signer: signerResult[0],
      files: filesResult,
    };

    // Devolver respuesta exitosa
    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Error fetching tramite by id:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error fetching tramite by id",
      },
      { status: 500 }
    );
  }
}
