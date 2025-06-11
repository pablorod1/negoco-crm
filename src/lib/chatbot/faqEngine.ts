// lib/chatbot/faqEngine.ts
import { faqData } from "./faqData";

export interface FAQResponse {
  answer: string;
  confidence: number;
  suggestions?: string[];
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  category: string;
}

// Función para calcular similitud simple basada en palabras clave
function calculateSimilarity(userMessage: string, faq: FAQ): number {
  const userWords = userMessage.toLowerCase().split(" ");
  const matchingKeywords = faq.keywords.filter((keyword) =>
    userWords.some(
      (word) =>
        word.includes(keyword.toLowerCase()) ||
        keyword.toLowerCase().includes(word)
    )
  );

  // También verificar similitud con la pregunta
  const questionWords = faq.question.toLowerCase().split(" ");
  const questionMatches = questionWords.filter((word) =>
    userWords.some(
      (userWord) => userWord.includes(word) || word.includes(userWord)
    )
  );

  const keywordScore = matchingKeywords.length / faq.keywords.length;
  const questionScore = questionMatches.length / questionWords.length;

  return Math.max(keywordScore, questionScore);
}

export async function getFAQResponse(
  userMessage: string
): Promise<FAQResponse> {
  try {
    // Calcular puntuaciones para todas las FAQs
    const scores = faqData.map((faq) => ({
      faq,
      score: calculateSimilarity(userMessage, faq),
    }));

    // Ordenar por puntuación descendente
    scores.sort((a, b) => b.score - a.score);

    const bestMatch = scores[0];

    // Si la confianza es muy baja, devolver respuesta genérica
    if (bestMatch.score < 0.1) {
      return {
        answer:
          "Lo siento, no pude encontrar una respuesta específica a tu consulta. ¿Podrías reformular tu pregunta o ser más específico sobre el tema energético que te interesa?",
        confidence: 0,
        suggestions: [
          "Certificado energético",
          "Auditoría energética",
          "Subvenciones energéticas",
          "Eficiencia energética",
        ],
      };
    }

    // Obtener sugerencias relacionadas de la misma categoría
    const suggestions = faqData
      .filter(
        (faq) =>
          faq.category === bestMatch.faq.category && faq.id !== bestMatch.faq.id
      )
      .slice(0, 3)
      .map((faq) => faq.question);

    return {
      answer: bestMatch.faq.answer,
      confidence: bestMatch.score,
      suggestions,
    };
  } catch (error) {
    console.error("Error en getFAQResponse:", error);
    return {
      answer:
        "Disculpa, ha ocurrido un error procesando tu consulta. Por favor, inténtalo de nuevo.",
      confidence: 0,
    };
  }
}
