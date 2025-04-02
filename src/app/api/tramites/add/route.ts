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

  // Array for storing uploaded file paths (to delete them in case of error)
  const uploadedFilePaths: string[] = [];

  try {
    const formData = await req.formData();

    // Retrieve and parse form data
    const parseFormField = <T>(fieldName: string): T | null => {
      const data = formData.get(fieldName);
      return data ? JSON.parse(data as string) : null;
    };

    const tramite: TramiteDB = parseFormField("tramite") as TramiteDB;
    const client: ClientDB = parseFormField("client") as ClientDB;
    const contracts: ContractDB[] = parseFormField("contracts") || [];
    const signer: SignerDB | null = parseFormField("signer");
    const userData: User = parseFormField("userData") as User;
    const documents = formData.getAll("files") as File[];

    // Validate required fields
    if (!tramite || !client || !userData) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameters",
        },
        { status: 400 }
      );
    }

    // Upload files in parallel
    const tramiteFiles: TramiteFile[] = await Promise.all(
      documents.map(async (file) => {
        try {
          const { downloadURL, previewURL, file_path } = await uploadFile(
            file,
            `${userData.organization.id}/tramites`,
            tramite.id
          );

          if (file_path) uploadedFilePaths.push(file_path);

          return {
            id: crypto.randomUUID(),
            tramite_id: tramite.id,
            filename: file.name,
            size: file.size,
            extension: file.name.split(".").pop() || "",
            upload_date: new Date().toISOString(),
            download_url: downloadURL,
            preview_url: previewURL || null,
          };
        } catch (error) {
          console.error(`Error uploading file ${file.name}:`, error);
          throw new Error(`Failed to upload file ${file.name}`);
        }
      })
    );

    // Start database transaction
    const tx = await tursoClient.transaction();

    try {
      // Execute database operations
      const operations = [];

      // Add client
      operations.push(addClient(client, tursoClient));

      // Add signer if applicable
      if (
        (client.type === "Empresa" ||
          client.type === "Comunidad de Propietarios") &&
        signer
      ) {
        operations.push(addSigner(signer, tursoClient));
      }

      // Add tramite
      operations.push(addTramite(tramite, tursoClient));

      // Add contracts if any
      if (contracts.length > 0) {
        operations.push(addContracts(contracts, tursoClient));
      }

      // Add file metadata if any
      if (tramiteFiles.length > 0) {
        operations.push(addTramiteFiles(tramiteFiles, tursoClient));
      }

      // Execute all database operations in parallel
      const results = await Promise.all(operations);

      // Check for any failures
      const failedOperation = results.find((result) => !result.success);
      if (failedOperation) {
        throw new Error(failedOperation.error);
      }

      // Commit the transaction
      await tx.commit();

      return NextResponse.json({
        success: true,
        tramiteId: tramite.id,
        filesCount: tramiteFiles.length,
      });
    } catch (error) {
      // Rollback transaction on database error
      await tx.rollback();
      throw error; // Re-throw to be caught by the outer catch block
    }
  } catch (error) {
    // Clean up uploaded files on any error
    if (uploadedFilePaths.length > 0) {
      try {
        await deleteFiles(uploadedFilePaths);
      } catch (deleteError) {
        console.error(
          "Error deleting files during error cleanup:",
          deleteError
        );
      }
    }

    console.error("Error processing request:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unexpected error",
      },
      { status: 500 }
    );
  }
}
