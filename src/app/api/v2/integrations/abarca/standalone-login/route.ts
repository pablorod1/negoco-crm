import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { idcm } = await req.json();

  const { ABARCA_API_KEY, ABARCA_TOKEN } = process.env;

  if (!ABARCA_API_KEY || !ABARCA_TOKEN) {
    return NextResponse.json(
      { error: "Missing Environment Variables" },
      { status: 500 },
    );
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
          ide: 100,
          idcm,
          clave: ABARCA_TOKEN,
        }),
      },
    );
  } catch (err) {
    console.error("Network error fetching Abarca standalone login:", err);
    return NextResponse.json(
      { error: "Network error contacting Abarca" },
      { status: 502 },
    );
  }

  const rawText = await response.text();

  if (!response.ok) {
    console.error(
      `Abarca standalone login error (HTTP ${response.status}):`,
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
