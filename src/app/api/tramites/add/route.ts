import {
  ClientDB,
  ContractDB,
  SignerDB,
  TramiteDB,
  TramiteFile,
  User,
} from "@/lib/core/types";
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

    console.log("client on api", client);
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

    const clientResult = await addClient(client, tursoClient);
    if (!clientResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: clientResult.error,
        },
        { status: 400 }
      );
    }

    // Add signer if applicable
    if (
      (client.type === "Empresa" ||
        client.type === "Comunidad de Propietarios") &&
      signer
    ) {
      const signerResult = await addSigner(signer, tursoClient);
      if (!signerResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: signerResult.error,
          },
          { status: 400 }
        );
      }
    }

    // Add tramite
    const tramiteResult = await addTramite(tramite, tursoClient);
    if (!tramiteResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: tramiteResult.error,
        },
        { status: 400 }
      );
    }

    // Add contracts
    if (contracts && contracts.length > 0) {
      const contractsResult = await addContracts(contracts, tursoClient);
      if (!contractsResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: contractsResult.error,
          },
          { status: 400 }
        );
      }
    }

    // Upload files and prepare metadata
    const tramiteFiles: TramiteFile[] = [];

    for (const file of documents) {
      try {
        const { downloadURL, previewURL } = await uploadFile(
          file,
          `${userData.organization.id}/tramites`,
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
        return NextResponse.json(
          {
            success: false,
            error: `Error al subir archivo ${file.name}`,
          },
          { status: 500 }
        );
      }
    }

    // Bulk insert file metadata if any files were successfully uploaded
    if (tramiteFiles.length > 0) {
      const insertResult = await addTramiteFiles(tramiteFiles, tursoClient);
      if (!insertResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: insertResult.error,
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al agregar trámite",
      },
      { status: 500 }
    );
  }
}
