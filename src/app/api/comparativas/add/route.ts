import { ComparativaDB, ComparativaFile } from "@/lib/core/types";
import { uploadFile } from "@/lib/firebase/data/uploadFiles";
import { getTursoClient } from "@/lib/libsql/client";
import {
  addComparativa,
  addComparativaFiles,
} from "@/lib/libsql/comparativas/addComparativaHelpers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const organization_id = formData.get("organization_id") as string;
    const comparativaString = formData.get("comparativa") as string;
    const documents = formData.getAll("files") as File[];

    const comparativa: ComparativaDB = JSON.parse(comparativaString);

    if (!comparativa || !documents) {
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

    const comparativaResult = await addComparativa(comparativa, tursoClient);

    if (!comparativaResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: comparativaResult.error,
        },
        { status: 400 }
      );
    }

    const comparativaFiles: ComparativaFile[] = [];

    for (const file of documents) {
      try {
        const { downloadURL, previewURL } = await uploadFile(
          file,
          `${organization_id}/comparativas`,
          comparativa.id
        );

        comparativaFiles.push({
          id: crypto.randomUUID(),
          comparativa_id: comparativa.id,
          filename: file.name,
          size: file.size,
          extension: file.name.split(".").pop() || "",
          upload_date: new Date().toISOString(),
          download_url: downloadURL,
          preview_url: previewURL || null,
        });
      } catch (error) {
        console.error("Error uploading file:", error);
        return NextResponse.json(
          {
            success: false,
            error: "Error uploading file",
          },
          { status: 500 }
        );
      }
    }

    if (comparativaFiles.length > 0) {
      const insertFilesResult = await addComparativaFiles(
        comparativaFiles,
        tursoClient
      );
      if (!insertFilesResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: insertFilesResult.error,
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
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
