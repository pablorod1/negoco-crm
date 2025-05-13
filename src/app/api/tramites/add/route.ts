import {
  ClientDB,
  ContractDB,
  SignerDB,
  TramiteDB,
  TramiteFile,
  User,
} from "@/lib/core/types";
import { getTursoClient } from "@/lib/libsql/client";
import {
  addClient,
  addContracts,
  addSigner,
  addTramite,
  addTramiteFiles,
} from "@/lib/libsql/tramites/addTramiteHelpers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
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

  try {
    const formData = await req.formData();

    const tramiteString = formData.get("tramite") as string;
    const clientString = formData.get("client") as string;
    const contractsString = formData.get("contracts") as string;
    const documents = formData.get("files") as string;
    const signerString = formData.get("signer") as string;
    const userDataString = formData.get("userData") as string;
    const existingFilesString = formData.get("existingFiles") as string;

    const tramite: TramiteDB = JSON.parse(tramiteString);
    const client: ClientDB = JSON.parse(clientString);
    const contracts: ContractDB[] = JSON.parse(contractsString);
    const signer: SignerDB | null = signerString
      ? JSON.parse(signerString)
      : null;
    const tramiteFiles: TramiteFile[] = JSON.parse(documents);
    const userData: User = JSON.parse(userDataString);
    const existingFiles: TramiteFile[] = JSON.parse(existingFilesString);

    if (!tramite || !client || !userData) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    // 2. Iniciamos la transacción una vez que todos los archivos están subidos
    const tx = await tursoClient.transaction();

    try {
      // Añadir cliente
      const clientResult = await addClient(client, tursoClient);
      if (!clientResult.success) {
        throw new Error(clientResult.error);
      }

      // Añadir firmante si es aplicable
      if (
        (client.type === "Empresa" ||
          client.type === "Comunidad de Propietarios") &&
        signer
      ) {
        const signerResult = await addSigner(signer, tursoClient);
        if (!signerResult.success) {
          throw new Error(signerResult.error);
        }
      }

      // Añadir trámite
      const tramiteResult = await addTramite(tramite, tursoClient);
      if (!tramiteResult.success) {
        throw new Error(tramiteResult.error);
      }

      // Añadir contratos
      if (contracts && contracts.length > 0) {
        const contractsResult = await addContracts(contracts, tursoClient);
        if (!contractsResult.success) {
          throw new Error(contractsResult.error);
        }
      }

      // Añadir metadatos de archivos
      if (tramiteFiles && tramiteFiles.length > 0) {
        const insertResult = await addTramiteFiles(tramiteFiles, tursoClient);
        if (!insertResult.success) {
          throw new Error(insertResult.error);
        }
      }

      if (existingFiles && existingFiles.length > 0) {
        const insertExistingFilesResult = await addTramiteFiles(
          existingFiles,
          tursoClient
        );
        if (!insertExistingFilesResult.success) {
          throw new Error(insertExistingFilesResult.error);
        }
      }

      // Confirmar la transacción
      await tx.commit();

      return NextResponse.json({ success: true });
    } catch (error) {
      // Si hay un error en la base de datos, revertimos la transacción
      // y eliminamos los archivos subidos
      await tx.rollback();

      console.error("Error en la transacción:", error);

      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Error al agregar trámite",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error general:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error inesperado",
      },
      { status: 500 }
    );
  }
}
