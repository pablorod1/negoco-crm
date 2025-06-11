// app/api/chatbot/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getFAQResponse } from "@/lib/chatbot/faqEngine";

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "Mensaje y tenantId son requeridos" },
        { status: 400 }
      );
    }

    // Procesar el mensaje con el engine de FAQ
    const response = await getFAQResponse(message);

    return NextResponse.json({
      response: response.answer,
      confidence: response.confidence,
      suggestions: response.suggestions || [],
    });
  } catch (error) {
    console.error("Error en chatbot API:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
