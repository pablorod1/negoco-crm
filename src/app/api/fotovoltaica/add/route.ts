import { FotovoltaicaDB, FotovoltaicaFile } from "@/lib/core/types";
import { getTursoClient } from "@/lib/libsql/client";
import {
  addFotovoltaica,
  addFotovoltaicaFiles,
} from "@/lib/libsql/fotovoltaica/addFotovoltaicaHelpers";

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const fotovoltaicaString = formData.get("fotovoltaica") as string;
    const documents = formData.get("files") as string;

    const fotovoltaica: FotovoltaicaDB = JSON.parse(fotovoltaicaString);
    const fotovoltaicaFiles: FotovoltaicaFile[] = JSON.parse(documents);

    if (!fotovoltaica || !documents) {
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

    const fotovoltaicaResult = await addFotovoltaica(fotovoltaica, tursoClient);

    if (!fotovoltaicaResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: fotovoltaicaResult.error,
        },
        { status: 400 }
      );
    }

    if (fotovoltaicaFiles.length > 0) {
      const insertFilesResult = await addFotovoltaicaFiles(
        fotovoltaicaFiles,
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
