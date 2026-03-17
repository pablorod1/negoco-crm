import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { ide, idcm, comparativa_id } = await req.json();

  const { ABARCA_API_KEY, ABARCA_TOKEN } = process.env;

  if (!ABARCA_API_KEY || !ABARCA_TOKEN) {
    return NextResponse.json(
      { error: "Missing Environment Variables" },
      { status: 500 },
    );
  }

  const response = await fetch(
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
      }),
    },
  );

  if (!response.ok) {
    console.error("Error fetching Abarca login token:", await response.text());
    return NextResponse.json(
      { error: "Error fetching Abarca login token" },
      { status: 500 },
    );
  }

  const data = await response.json();

  return NextResponse.json({ loginUrl: data.login_url });
}
