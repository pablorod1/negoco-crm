import { ComparativaDB, ComparativaFile } from "@/lib/core/types";
import { getTursoClient } from "@/lib/libsql/client";
import {
  addComparativa,
  addComparativaFiles,
} from "@/lib/libsql/comparativas/addComparativaHelpers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const comparativaString = formData.get("comparativa") as string;
    const documents = formData.get("files") as string;

    const comparativa: ComparativaDB = JSON.parse(comparativaString);
    const comparativaFiles: ComparativaFile[] = JSON.parse(documents);

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
