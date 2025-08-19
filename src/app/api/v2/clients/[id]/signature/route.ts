import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { Row } from "@libsql/client";

// Response Types
interface SignatureResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: Row;
}

/**
 * Retrieves the signature information for a specific client
 * 
 * Migration from: /api/clients/get/[id]/signer
 * New endpoint: /new_api/clients/[id]/signature
 * 
 * @param request - Next.js request object
 * @param params - Route parameters containing client ID
 * @returns Promise<NextResponse<SignatureResponse>>
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SignatureResponse>> {
  const startTime = Date.now();
  
  try {
    // Validate route parameters
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Missing Parameters" },
        { status: 400 }
      );
    }

    // Initialize database connection
    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, message: "Database not initialized" },
        { status: 500 }
      );
    }

    // Execute query to get signer information
    const result = await tursoClient.execute({
      sql: "SELECT * FROM signers WHERE client_id = ?",
      args: [id],
    });

    // Performance monitoring
    const executionTime = Date.now() - startTime;
    
    // Log performance if execution time exceeds threshold
    if (executionTime > 1000) {
      console.warn(`[Performance] Signature query took ${executionTime}ms for client ${id}`);
    }

    // Handle no results found - EXACTLY match original behavior
    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: true, message: "No signers found" },
        { status: 200 }
      );
    }

    // Return the first signer record
    return NextResponse.json(
      { success: true, data: result.rows[0] },
      { status: 200 }
    );

  } catch (error) {
    console.error("Error fetching signature:", error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: "Internal Server Error" 
      },
      { status: 500 }
    );
  }
}

/**
 * RESTful GET method for retrieving signature information
 * Provides the same functionality as POST but follows REST conventions
 * 
 * @param request - Next.js request object
 * @param params - Route parameters containing client ID
 * @returns Promise<NextResponse<SignatureResponse>>
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SignatureResponse>> {
  const startTime = Date.now();
  
  try {
    // Validate route parameters
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Missing Parameters" },
        { status: 400 }
      );
    }

    // Initialize database connection
    const tursoClient = getTursoClient(request);

    if (!tursoClient) {
      return NextResponse.json(
        { success: false, message: "Database not initialized" },
        { status: 500 }
      );
    }

    // Execute query to get signer information
    const result = await tursoClient.execute({
      sql: "SELECT * FROM signers WHERE client_id = ?",
      args: [id],
    });

    // Performance monitoring
    const executionTime = Date.now() - startTime;
    
    // Log performance if execution time exceeds threshold
    if (executionTime > 1000) {
      console.warn(`[Performance] Signature query took ${executionTime}ms for client ${id}`);
    }

    // Handle no results found - EXACTLY match original behavior
    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: true, message: "No signers found" },
        { status: 200 }
      );
    }

    // Return the first signer record
    return NextResponse.json(
      { success: true, data: result.rows[0] },
      { status: 200 }
    );

  } catch (error) {
    console.error("Error fetching signature:", error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: "Internal Server Error" 
      },
      { status: 500 }
    );
  }
}
