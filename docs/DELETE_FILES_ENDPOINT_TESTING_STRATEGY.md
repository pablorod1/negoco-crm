# 🧪 TESTING STRATEGY - Contract Documents DELETE Endpoint

## Overview

Comprehensive testing strategy for the refactored DELETE endpoint to ensure 100% backward compatibility and enhanced functionality.

**Endpoint**: `/new_api/contracts/[id]/documents` (DELETE method)
**Original**: `/api/tramites/delete/[id]/file` (POST method)
**Testing Framework**: Jest with Next.js App Router testing utilities

## Test Categories

### 1. Backward Compatibility Tests

#### Request/Response Format Validation
```typescript
describe("DELETE /new_api/contracts/[id]/documents - Backward Compatibility", () => {
  test("should accept same request body format as original endpoint", async () => {
    const response = await fetch('/new_api/contracts/123/documents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_name: 'contract_document.pdf',
        organization_id: 'org123'
      })
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ success: true });
  });

  test("should return identical error messages for missing parameters", async () => {
    const response = await fetch('/new_api/contracts/123/documents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({
      success: false,
      error: "Faltan parámetros"
    });
  });

  test("should return same error for database connection issues", async () => {
    // Mock database connection failure
    jest.mock('@/core/libsql/client', () => ({
      getTursoClient: () => null
    }));

    const response = await fetch('/new_api/contracts/123/documents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_name: 'test.pdf',
        organization_id: 'org123'
      })
    });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toEqual({
      success: false,
      error: "Error al conectar a la base de datos"
    });
  });
});
```

### 2. Database Operation Tests

#### SQL Query Compatibility
```typescript
describe("Database Operations", () => {
  let mockTursoClient: jest.Mocked<Client>;

  beforeEach(() => {
    mockTursoClient = {
      execute: jest.fn(),
    } as any;
    
    jest.mock('@/core/libsql/client', () => ({
      getTursoClient: () => mockTursoClient
    }));
  });

  test("should execute exact same SQL query as original endpoint", async () => {
    mockTursoClient.execute.mockResolvedValue({ rowsAffected: 1 });

    await fetch('/new_api/contracts/123/documents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_name: 'test.pdf',
        organization_id: 'org123'
      })
    });

    expect(mockTursoClient.execute).toHaveBeenCalledWith({
      sql: 'DELETE FROM tramite_files WHERE filename = ? AND tramite_id = ?',
      args: ['test.pdf', '123']
    });
  });

  test("should handle zero rows affected (file not found)", async () => {
    mockTursoClient.execute.mockResolvedValue({ rowsAffected: 0 });

    const response = await fetch('/new_api/contracts/123/documents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_name: 'nonexistent.pdf',
        organization_id: 'org123'
      })
    });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toEqual({
      success: false,
      error: "Error al eliminar el archivo de la base de datos"
    });
  });

  test("should handle database execution errors", async () => {
    mockTursoClient.execute.mockRejectedValue(new Error('Database error'));

    const response = await fetch('/new_api/contracts/123/documents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_name: 'test.pdf',
        organization_id: 'org123'
      })
    });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toEqual({
      success: false,
      error: "Error al eliminar el archivo"
    });
  });
});
```

### 3. Enhanced Validation Tests

#### Zod Schema Validation
```typescript
describe("Enhanced Validation with Zod", () => {
  test("should validate request body with Zod schema", async () => {
    const response = await fetch('/new_api/contracts/123/documents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_name: "",  // Invalid: empty string
        organization_id: "org123"
      })
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({
      success: false,
      error: "Faltan parámetros"
    });
  });

  test("should handle malformed JSON gracefully", async () => {
    const response = await fetch('/new_api/contracts/123/documents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json'
    });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toEqual({
      success: false,
      error: "Error al eliminar el archivo"
    });
  });
});
```

### 4. HTTP Method Tests

#### Semantic Correctness
```typescript
describe("HTTP Method Semantics", () => {
  test("should use DELETE method for resource removal", async () => {
    const response = await fetch('/new_api/contracts/123/documents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_name: 'test.pdf',
        organization_id: 'org123'
      })
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  test("should reject non-DELETE methods", async () => {
    const postResponse = await fetch('/new_api/contracts/123/documents', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_name: 'test.pdf',
        organization_id: 'org123'
      })
    });

    expect(postResponse.status).toBe(405);
  });
});
```

### 5. Parameter Validation Tests

#### Contract ID Validation
```typescript
describe("Parameter Validation", () => {
  test("should handle various contract ID formats", async () => {
    const testCases = [
      { id: '123', valid: true },
      { id: 'contract_123', valid: true },
      { id: 'abc-def-123', valid: true },
      { id: '', valid: false },
      { id: ' ', valid: false },
    ];

    for (const testCase of testCases) {
      const response = await fetch(`/new_api/contracts/${testCase.id}/documents`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: 'test.pdf',
          organization_id: 'org123'
        })
      });

      if (testCase.valid) {
        expect(response.status).not.toBe(400);
      } else {
        expect(response.status).toBe(400);
      }
    }
  });

  test("should validate required fields presence", async () => {
    const testCases = [
      { body: { file_name: 'test.pdf' }, valid: false }, // Missing organization_id
      { body: { organization_id: 'org123' }, valid: false }, // Missing file_name
      { body: {}, valid: false }, // Missing both
      { body: { file_name: 'test.pdf', organization_id: 'org123' }, valid: true },
    ];

    for (const testCase of testCases) {
      const response = await fetch('/new_api/contracts/123/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase.body)
      });

      if (testCase.valid) {
        expect(response.status).not.toBe(400);
      } else {
        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe("Faltan parámetros");
      }
    }
  });
});
```

### 6. Integration Tests

#### End-to-End Workflow
```typescript
describe("Integration Tests", () => {
  test("should complete full file deletion workflow", async () => {
    // Setup: Insert a test file
    const setupResponse = await fetch('/new_api/contracts/123/documents', {
      method: 'POST',
      body: new FormData() // Assume we have file upload functionality
    });
    expect(setupResponse.status).toBe(200);

    // Test: Delete the file
    const deleteResponse = await fetch('/new_api/contracts/123/documents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_name: 'test_document.pdf',
        organization_id: 'org123'
      })
    });

    expect(deleteResponse.status).toBe(200);
    const deleteData = await deleteResponse.json();
    expect(deleteData).toEqual({ success: true });

    // Verify: File is actually removed from database
    // This would require a GET endpoint or direct database query
  });
});
```

### 7. Performance Tests

#### Response Time Validation
```typescript
describe("Performance Tests", () => {
  test("should complete deletion within acceptable time", async () => {
    const startTime = performance.now();

    await fetch('/new_api/contracts/123/documents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_name: 'test.pdf',
        organization_id: 'org123'
      })
    });

    const endTime = performance.now();
    const responseTime = endTime - startTime;

    // Should complete within 1 second
    expect(responseTime).toBeLessThan(1000);
  });

  test("should handle concurrent deletion requests", async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      fetch('/new_api/contracts/123/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: `test_${i}.pdf`,
          organization_id: 'org123'
        })
      })
    );

    const responses = await Promise.all(promises);
    
    // All requests should complete (success or failure)
    responses.forEach(response => {
      expect([200, 500]).toContain(response.status);
    });
  });
});
```

## Test Execution Strategy

### Local Development
```bash
# Run all tests
npm run test

# Run specific test file
npm run test src/app/new_api/contracts/[id]/documents/route.test.ts

# Run with coverage
npm run test -- --coverage

# Watch mode for development
npm run test -- --watch
```

### CI/CD Pipeline
```yaml
# .github/workflows/test.yml
name: API Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '20'
      - run: npm install
      - run: npm run test
      - run: npm run build
```

### Production Validation
```typescript
// Health check endpoint for production monitoring
export async function HEAD(request: NextRequest) {
  return new NextResponse(null, { status: 200 });
}
```

## Test Data Management

### Test Database Setup
```typescript
// Setup test database with known data
beforeEach(async () => {
  await setupTestDatabase();
  await seedTestData();
});

afterEach(async () => {
  await cleanupTestDatabase();
});

const setupTestDatabase = async () => {
  // Initialize test database with same schema
};

const seedTestData = async () => {
  // Insert known test files for deletion tests
};
```

### Mock Data
```typescript
const TEST_FILE_DATA = {
  validFile: {
    file_name: 'test_contract.pdf',
    organization_id: 'test_org_123'
  },
  invalidFile: {
    file_name: '',
    organization_id: ''
  },
  nonexistentFile: {
    file_name: 'does_not_exist.pdf',
    organization_id: 'test_org_123'
  }
};
```

## Coverage Requirements

### Minimum Coverage Targets
- **Statements**: 95%
- **Branches**: 90%
- **Functions**: 100%
- **Lines**: 95%

### Critical Paths to Cover
- ✅ All error conditions
- ✅ Success scenarios
- ✅ Input validation
- ✅ Database operations
- ✅ HTTP status codes
- ✅ Response formats

## Monitoring & Alerting

### Production Metrics
```typescript
// Add monitoring to the endpoint
export async function DELETE(request: NextRequest, { params }: any) {
  const startTime = performance.now();
  
  try {
    // ... deletion logic ...
    
    // Log success metrics
    console.log(`File deletion successful: ${performance.now() - startTime}ms`);
    
  } catch (error) {
    // Log error metrics
    console.error(`File deletion failed: ${error.message}`);
    
  }
}
```

### Key Performance Indicators
- **Response Time**: < 500ms p95
- **Error Rate**: < 1%
- **Success Rate**: > 99%
- **Database Query Time**: < 100ms

## Test Automation

### Pre-deployment Checks
1. **Unit Tests**: All test cases pass
2. **Integration Tests**: Full workflow validation
3. **Performance Tests**: Response time within limits
4. **Compatibility Tests**: Backward compatibility verified

### Continuous Monitoring
1. **Synthetic Tests**: Automated endpoint testing
2. **Real User Monitoring**: Production traffic analysis
3. **Error Tracking**: Exception monitoring
4. **Performance Monitoring**: Response time tracking

---

**Testing Status**: ✅ **COMPREHENSIVE STRATEGY DEFINED**
**Ready for Implementation**: All test cases documented and ready for execution
