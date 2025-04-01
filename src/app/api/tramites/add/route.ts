import {
  ClientDB,
  ContractDB,
  SignerDB,
  TramiteDB,
  TramiteFile,
  User,
} from "@/lib/core/types";
import { deleteFiles } from "@/lib/firebase/data/deleteFile";
import { uploadFile } from "@/lib/firebase/data/uploadFiles";
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

  // Array para almacenar las rutas de archivos subidos (para eliminarlos en caso de error)
  const uploadedFilePaths: string[] = [];

  try {
    const formData = await req.formData();

    const tramiteString = formData.get("tramite") as string;
    const clientString = formData.get("client") as string;
    const contractsString = formData.get("contracts") as string;
    const documents = formData.getAll("files") as File[];
    const signerString = formData.get("signer") as string;
    const userDataString = formData.get("userData") as string;

    const tramite: TramiteDB = JSON.parse(tramiteString);
    const client: ClientDB = JSON.parse(clientString);
    const contracts: ContractDB[] = JSON.parse(contractsString);
    const signer: SignerDB | null = signerString
      ? JSON.parse(signerString)
      : null;
    const userData: User = JSON.parse(userDataString);

    if (!tramite || !client) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing parameters",
        },
        { status: 400 }
      );
    }

    // 1. Primero subimos todos los archivos
    // Si hay algún error durante la subida, no se realizará ningún cambio en la base de datos
    const tramiteFiles: TramiteFile[] = [];

    for (const file of documents) {
      try {
        const { downloadURL, previewURL, file_path } = await uploadFile(
          file,
          `${userData.organization.id}/tramites`,
          tramite.id
        );

        // Guardar la ruta del archivo para posible eliminación en caso de error
        uploadedFilePaths.push(file_path as string);

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
        // Si falla la subida de cualquier archivo, eliminamos todos los que ya se subieron
        if (uploadedFilePaths.length > 0) {
          await deleteFiles(uploadedFilePaths);
        }

        console.error(`Error uploading file ${file.name}:`, error);
        return NextResponse.json(
          {
            success: false,
            error: `Error al subir archivo ${file.name}`,
          },
          { status: 500 }
        );
      }
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
      if (tramiteFiles.length > 0) {
        const insertResult = await addTramiteFiles(tramiteFiles, tursoClient);
        if (!insertResult.success) {
          throw new Error(insertResult.error);
        }
      }

      // Confirmar la transacción
      await tx.commit();

      return NextResponse.json({ success: true });
    } catch (error) {
      // Si hay un error en la base de datos, revertimos la transacción
      // y eliminamos los archivos subidos
      await tx.rollback();

      if (uploadedFilePaths.length > 0) {
        await deleteFiles(uploadedFilePaths);
      }

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
    // Si hay un error general, aseguramos que se eliminen los archivos subidos
    if (uploadedFilePaths.length > 0) {
      await deleteFiles(uploadedFilePaths);
    }

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
