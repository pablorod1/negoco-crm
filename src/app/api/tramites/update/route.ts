import { UpdatedFields } from "@/hooks/track-tramite-changes";
import { ACTIVATION_DATE, RENOVATION_DATE } from "@/lib/core/const";
import { TramiteFile, User } from "@/lib/core/types";
import { uploadFile } from "@/lib/firebase/data/uploadFiles";
import { getTursoClient } from "@/lib/libsql/client";
import { addTramiteFiles } from "@/lib/libsql/tramites/addTramiteHelpers";
import {
  updateClient,
  updateContract,
  updateSigner,
  updateTramite,
} from "@/lib/libsql/tramites/updateTramiteHelpers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const tramite_id = formData.get("tramite_id") as string | null;
    const client_id = formData.get("client_id") as string | null;
    const signer_id = formData.get("signer_id") as string | null;
    const contract_ids = formData.getAll("contract_ids") as string[] | null;
    const files = formData.getAll("files") as File[];
    const userData = JSON.parse(formData.get("userData") as string) as User;
    const changes = JSON.parse(
      formData.get("changes") as string
    ) as UpdatedFields;

    const { tramite, client, signer, contracts } = changes;

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

    if (tramite && tramite_id) {
      if (tramite.status === "Activo") {
        tramite.activation_date = ACTIVATION_DATE.toISOString();
        tramite.renovation_date = RENOVATION_DATE.toISOString();
        tramite.liquidez_status = "Pendiente de Cobro";
      }

      if (
        (tramite.status === "Pendiente de Firma" ||
          tramite.status === "Procesando" ||
          tramite.status === "Verificado" ||
          tramite.status === "Activo") &&
        tramite.tramitation_date === ""
      ) {
        tramite.tramitation_date = new Date().toISOString();
      }

      if (
        tramite.status === "Baja" &&
        tramite.comision &&
        tramite.comision_sales_person
      ) {
        tramite.liquidez_status = "Cobrado por Comercializadora";
        tramite.comision = -tramite.comision;
        tramite.comision_sales_person = -tramite.comision_sales_person;
      }

      const tramiteResult = await updateTramite(
        tramite,
        tramite_id,
        tursoClient
      );
      if (!tramiteResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: tramiteResult.error,
          },
          { status: 500 }
        );
      }
    }

    if (client && client_id) {
      const clientResult = await updateClient(client, client_id, tursoClient);
      if (!clientResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: clientResult.error,
          },
          { status: 500 }
        );
      }
    }

    if (signer && signer_id) {
      const signerResult = await updateSigner(signer, signer_id, tursoClient);
      if (!signerResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: signerResult.error,
          },
          { status: 500 }
        );
      }
    }

    if (contracts && contract_ids) {
      contracts.forEach(async (contract, index) => {
        const contractResult = await updateContract(
          contract,
          contract_ids[index],
          tursoClient
        );

        if (!contractResult.success) {
          return NextResponse.json(
            {
              success: false,
              error: contractResult.error,
            },
            { status: 500 }
          );
        }
      });
    }

    if (files && tramite_id) {
      const tramiteFiles: TramiteFile[] = [];
      for (const file of files) {
        try {
          const { downloadURL, previewURL } = await uploadFile(
            file,
            `${userData.organization.id}/tramites`,
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
          return NextResponse.json(
            {
              success: false,
              error: `Error subiendo archivo ${file.name}`,
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
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        success: false,
        error: "Error actualizando tramite",
      },
      { status: 500 }
    );
  }
}
