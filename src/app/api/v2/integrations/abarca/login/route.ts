import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { ide, idcm, comparativa_id, file_url } = await req.json();

  const { ABARCA_API_KEY, ABARCA_TOKEN } = process.env;

  if (!ABARCA_API_KEY || !ABARCA_TOKEN) {
    return NextResponse.json(
      { error: "Missing Environment Variables" },
      { status: 500 },
    );
  }

  let pdfBase64: string | undefined;
  if (file_url) {
    let fileResponse: Response;
    try {
      fileResponse = await fetch(file_url as string);
    } catch (err) {
      console.error("Error downloading file for Abarca:", err);
      return NextResponse.json(
        { error: "Error downloading file" },
        { status: 502 },
      );
    }
    if (!fileResponse.ok) {
      console.error(`File download failed (HTTP ${fileResponse.status})`);
      return NextResponse.json(
        { error: "Failed to download file" },
        { status: 502 },
      );
    }
    const fileBuffer = await fileResponse.arrayBuffer();
    pdfBase64 = Buffer.from(fileBuffer).toString("base64");
  }

  let response: Response;
  try {
    response = await fetch(
      "https://abarcaia.com/comparar/api/generate-login-token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ABARCA_API_KEY,
        },
        body: JSON.stringify({
          ide,
          idcm,
          clave: ABARCA_TOKEN,
          comparativa_id,
          ...(pdfBase64 ? { pdf_base64: pdfBase64 } : {}),
        }),
      },
    );
  } catch (err) {
    console.error("Network error fetching Abarca login token:", err);
    return NextResponse.json(
      { error: "Network error contacting Abarca" },
      { status: 502 },
    );
  }

  const rawText = await response.text();

  if (!response.ok) {
    console.error(
      `Abarca login token error (HTTP ${response.status}):`,
      rawText,
    );
    return NextResponse.json(
      { error: "Error fetching Abarca login token" },
      { status: response.status === 404 ? 404 : 502 },
    );
  }

  let data: { login_url: string };
  try {
    data = JSON.parse(rawText);
  } catch {
    console.error("Abarca returned non-JSON response:", rawText);
    return NextResponse.json(
      { error: "Invalid response from Abarca" },
      { status: 502 },
    );
  }

  return NextResponse.json({ loginUrl: data.login_url });
}
