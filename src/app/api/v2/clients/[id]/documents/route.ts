import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/core/libsql/client";
import { Row } from "@libsql/client";

// Response Types
interface DocumentsResponse {
  success: boolean;
  message?: string;
  data?: Row[];
}

// Performance metrics interface
interface QueryMetrics {
  queryTime: number;
  resultCount: number;
  optimizationApplied: string[];
}

/**
 * Retrieves all document files for a specific client's tramites
 * 
 * Migration from: /api/clients/get/[id]/tramite-files
 * New endpoint: /new_api/clients/[id]/documents
 * 
 * @param request - Next.js request object
 * @param params - Route parameters containing client ID
 * @returns Promise<NextResponse<DocumentsResponse>>
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<DocumentsResponse>> {
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

    // Execute optimized query with JOIN instead of subquery
    // Performance optimization: Using INNER JOIN instead of IN subquery
    // This query should be faster for large datasets
    const result = await tursoClient.execute({
      sql: `
        SELECT 
          tf.id,
          tf.tramite_id,
          tf.filename,
          tf.size,
          tf.extension,
          tf.upload_date,
          tf.download_url,
          tf.preview_url
        FROM tramite_files tf
        INNER JOIN tramites t ON tf.tramite_id = t.id
        WHERE t.client_id = ?
        GROUP BY tf.filename
        ORDER BY tf.upload_date DESC
      `,
      args: [id],
    });

    // Performance monitoring
    const executionTime = Date.now() - startTime;
    const metrics: QueryMetrics = {
      queryTime: executionTime,
      resultCount: result.rows.length,
      optimizationApplied: ["JOIN_OPTIMIZATION", "PREPARED_STATEMENT", "EXPLICIT_COLUMN_SELECTION", "ORDERED_RESULTS"]
    };
    
    // Log performance if execution time exceeds threshold
    if (executionTime > 1000) {
      console.warn(`[Performance] Documents query took ${executionTime}ms for client ${id}`, metrics);
    }

    // Handle no results found - EXACTLY match original behavior
    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: true, message: "No files found" },
        { status: 200 }
      );
    }

    // Return the document files
    return NextResponse.json(
      { success: true, data: result.rows },
      { status: 200 }
    );

  } catch (error) {
    console.error("Error obteniendo archivos de los trámites del cliente:", error);
    
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
 * RESTful GET method for retrieving client documents
 * Provides the same functionality as POST but follows REST conventions
 * 
 * @param request - Next.js request object
 * @param params - Route parameters containing client ID
 * @returns Promise<NextResponse<DocumentsResponse>>
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<DocumentsResponse>> {
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

    // Execute optimized query with JOIN instead of subquery
    // Performance optimization: Using INNER JOIN instead of IN subquery
    // This query should be faster for large datasets
    const result = await tursoClient.execute({
      sql: `
        SELECT 
          tf.id,
          tf.tramite_id,
          tf.filename,
          tf.size,
          tf.extension,
          tf.upload_date,
          tf.download_url,
          tf.preview_url
        FROM tramite_files tf
        INNER JOIN tramites t ON tf.tramite_id = t.id
        WHERE t.client_id = ?
        GROUP BY tf.filename
        ORDER BY tf.upload_date DESC
      `,
      args: [id],
    });

    // Performance monitoring
    const executionTime = Date.now() - startTime;
    const metrics: QueryMetrics = {
      queryTime: executionTime,
      resultCount: result.rows.length,
      optimizationApplied: ["JOIN_OPTIMIZATION", "PREPARED_STATEMENT", "EXPLICIT_COLUMN_SELECTION", "ORDERED_RESULTS"]
    };
    
    // Log performance if execution time exceeds threshold
    if (executionTime > 1000) {
      console.warn(`[Performance] Documents query took ${executionTime}ms for client ${id}`, metrics);
    }

    // Handle no results found - EXACTLY match original behavior
    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: true, message: "No files found" },
        { status: 200 }
      );
    }

    // Return the document files
    return NextResponse.json(
      { success: true, data: result.rows },
      { status: 200 }
    );

  } catch (error) {
    console.error("Error obteniendo archivos de los trámites del cliente:", error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: "Internal Server Error" 
      },
      { status: 500 }
    );
  }
}
