# 🧪 Comparison by ID Endpoint - Testing Strategy

## Overview
Comprehensive testing strategy for the refactored `/new_api/comparisons/[id]` endpoint to ensure 100% backward compatibility and validate performance improvements.

## 🎯 Testing Objectives

### Primary Goals
- ✅ **Functional Compatibility**: Verify identical behavior to original endpoint
- ✅ **Performance Validation**: Confirm 25% improvement in response times
- ✅ **Security Assurance**: Validate authorization and input validation
- ✅ **Error Handling**: Ensure consistent error responses and status codes

### Success Criteria
- Zero functional regressions
- Performance improvement of 20%+ in query execution
- 100% test coverage for critical paths
- Error rate < 0.1% under normal load

## 🧪 Test Categories

### 1. Unit Tests

#### Core Function Testing
```typescript
// src/app/new_api/comparisons/[id]/route.test.ts
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { POST } from './route';
import { NextRequest } from 'next/server';

describe('Comparison by ID Endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Input Validation', () => {
    test('should accept valid parameters', async () => {
      const request = new NextRequest('http://localhost/new_api/comparisons/123', {
        method: 'POST',
        body: JSON.stringify({
          id: '123',
          user_id: 'user456',
          user_role: '1'
        })
      });

      const response = await POST(request, { params: { id: '123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });

    test('should reject missing parameters', async () => {
      const request = new NextRequest('http://localhost/new_api/comparisons/123', {
        method: 'POST',
        body: JSON.stringify({
          id: '123'
          // Missing user_id and user_role
        })
      });

      const response = await POST(request, { params: { id: '123' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Missing parameters');
    });

    test('should validate parameter types', async () => {
      const request = new NextRequest('http://localhost/new_api/comparisons/123', {
        method: 'POST',
        body: JSON.stringify({
          id: 123, // Should be string
          user_id: 'user456',
          user_role: '1'
        })
      });

      const response = await POST(request, { params: { id: '123' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('Authorization Logic', () => {
    test('should allow access for regular user to own comparison', async () => {
      // Mock database response for user's own comparison
      const mockDb = jest.mocked(getTursoClient);
      mockDb.mockReturnValue({
        execute: jest.fn().mockResolvedValue({
          rows: [{
            id: '123',
            client: 'Test Client',
            user_id: 'user456',
            // ... other fields
          }]
        })
      });

      const request = new NextRequest('http://localhost/new_api/comparisons/123', {
        method: 'POST',
        body: JSON.stringify({
          id: '123',
          user_id: 'user456',
          user_role: '1'
        })
      });

      const response = await POST(request, { params: { id: '123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    test('should deny access for regular user to other user comparison', async () => {
      // Mock database response for no results (access denied)
      const mockDb = jest.mocked(getTursoClient);
      mockDb.mockReturnValue({
        execute: jest.fn().mockResolvedValue({
          rows: [] // No results due to authorization filter
        })
      });

      const request = new NextRequest('http://localhost/new_api/comparisons/123', {
        method: 'POST',
        body: JSON.stringify({
          id: '123',
          user_id: 'user456',
          user_role: '1'
        })
      });

      const response = await POST(request, { params: { id: '123' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Comparativa not found');
    });

    test('should allow manager access to subcomercial comparisons', async () => {
      // Mock getSubcomerciales and database response
      const mockSubcomerciales = jest.mocked(getSubcomerciales);
      mockSubcomerciales.mockResolvedValue({
        success: true,
        ids: ['subuser1', 'subuser2']
      });

      const mockDb = jest.mocked(getTursoClient);
      mockDb.mockReturnValue({
        execute: jest.fn()
          .mockResolvedValueOnce({ // First call for comparison data
            rows: [{
              id: '123',
              client: 'Test Client',
              user_id: 'subuser1',
              // ... other fields
            }]
          })
          .mockResolvedValueOnce({ // Second call for files
            rows: []
          })
      });

      const request = new NextRequest('http://localhost/new_api/comparisons/123', {
        method: 'POST',
        body: JSON.stringify({
          id: '123',
          user_id: 'manager456',
          user_role: '2'
        })
      });

      const response = await POST(request, { params: { id: '123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Data Transformation', () => {
    test('should correctly parse JSON fields', async () => {
      const mockComparison = {
        id: '123',
        client: 'Test Client',
        plan: '["fijo", "indexado"]',
        notes: '["Note 1", "Note 2"]',
        comision_fijo: 25.5,
        comision_indexado: 30.0,
        // ... other fields
      };

      const result = transformComparisonData(mockComparison, []);

      expect(result.plan).toEqual(['fijo', 'indexado']);
      expect(result.notes).toEqual(['Note 1', 'Note 2']);
      expect(result.comision.fijo).toBe(25.5);
    });

    test('should handle null tramite_id', async () => {
      const mockComparison = {
        id: '123',
        tramite_id: null,
        // ... other fields
      };

      const result = transformComparisonData(mockComparison, []);

      expect(result.tramite_id).toBeNull();
    });

    test('should format files correctly', async () => {
      const mockFiles = [{
        id: 'file1',
        comparativa_id: '123',
        filename: 'document.pdf',
        size: 1024,
        extension: 'pdf',
        upload_date: '2024-01-01T12:00:00Z',
        download_url: 'https://example.com/file1',
        preview_url: null
      }];

      const result = transformComparisonData(mockComparison, mockFiles);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].id).toBe('file1');
      expect(result.files[0].size).toBe(1024);
    });
  });
});
```

#### Database Function Testing
```typescript
describe('Database Operations', () => {
  test('executeQuery should track performance', async () => {
    const consoleSpy = jest.spyOn(console, 'log');
    const mockClient = {
      execute: jest.fn().mockResolvedValue({ rows: [] })
    };

    await executeQuery(mockClient, 'SELECT * FROM test', [], 'test-query');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[DB Query] test-query executed in')
    );
  });

  test('executeQuery should handle errors gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error');
    const mockClient = {
      execute: jest.fn().mockRejectedValue(new Error('Database error'))
    };

    const result = await executeQuery(mockClient, 'SELECT * FROM test', [], 'test-query');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Database query failed');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
```

### 2. Integration Tests

#### End-to-End API Testing
```typescript
// tests/integration/comparison-by-id.test.ts
describe('Comparison by ID API Integration', () => {
  test('should retrieve comparison with files', async () => {
    const response = await fetch('/new_api/comparisons/existing-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'existing-id',
        user_id: 'test-user',
        user_role: '1'
      })
    });

    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toEqual({
      success: true,
      data: {
        id: expect.any(String),
        client: expect.any(String),
        service: expect.stringMatching(/^(Luz|Gas)$/),
        plan: expect.arrayContaining(['fijo']),
        status: expect.any(String),
        comision: {
          fijo: expect.any(Number),
          indexado: expect.any(Number)
        },
        comision_sales_person: {
          fijo: expect.any(Number),
          indexado: expect.any(Number)
        },
        notes: expect.any(Array),
        user: {
          id: expect.any(String),
          email: expect.any(String),
          name: expect.any(String),
          image: expect.toBeOneOf([expect.any(String), null])
        },
        creation_date: expect.any(String),
        tramite_id: expect.toBeOneOf([expect.any(String), null]),
        files: expect.any(Array)
      }
    });
  });

  test('should handle non-existent comparison', async () => {
    const response = await fetch('/new_api/comparisons/non-existent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'non-existent',
        user_id: 'test-user',
        user_role: '1'
      })
    });

    expect(response.status).toBe(404);
    
    const data = await response.json();
    expect(data).toEqual({
      success: false,
      error: 'Comparativa not found'
    });
  });
});
```

### 3. Performance Tests

#### Load Testing
```bash
#!/bin/bash
# tests/performance/load-test.sh

echo "Running Comparison by ID Load Tests..."

# Test 1: Normal load (100 concurrent users)
echo "Test 1: Normal Load"
autocannon -c 100 -d 30 -m POST \
  --headers "Content-Type=application/json" \
  --body '{"id":"test-id","user_id":"test-user","user_role":"1"}' \
  http://localhost:3000/new_api/comparisons/test-id

# Test 2: High load (500 concurrent users)  
echo "Test 2: High Load"
autocannon -c 500 -d 30 -m POST \
  --headers "Content-Type=application/json" \
  --body '{"id":"test-id","user_id":"test-user","user_role":"1"}' \
  http://localhost:3000/new_api/comparisons/test-id

# Test 3: Manager role with subcomerciales (complex authorization)
echo "Test 3: Manager Role Load"
autocannon -c 200 -d 30 -m POST \
  --headers "Content-Type=application/json" \
  --body '{"id":"test-id","user_id":"manager-user","user_role":"2"}' \
  http://localhost:3000/new_api/comparisons/test-id

echo "Load tests completed. Check results for performance metrics."
```

#### Performance Benchmarking
```typescript
// tests/performance/benchmark.test.ts
describe('Performance Benchmarks', () => {
  test('should complete request within 500ms for simple comparison', async () => {
    const startTime = performance.now();
    
    const response = await fetch('/new_api/comparisons/simple-id', {
      method: 'POST',
      body: JSON.stringify({
        id: 'simple-id',
        user_id: 'test-user',
        user_role: '1'
      })
    });
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(500); // 500ms SLA
  });

  test('should handle file-heavy comparison within 1000ms', async () => {
    const startTime = performance.now();
    
    const response = await fetch('/new_api/comparisons/file-heavy-id', {
      method: 'POST',
      body: JSON.stringify({
        id: 'file-heavy-id',
        user_id: 'test-user',
        user_role: '1'
      })
    });
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(1000); // 1s SLA for complex requests
  });
});
```

### 4. Compatibility Tests

#### Response Format Validation
```typescript
// tests/compatibility/response-format.test.ts
describe('Response Format Compatibility', () => {
  test('should match original endpoint response structure', async () => {
    // Test against known comparison ID
    const newResponse = await fetch('/new_api/comparisons/known-id', {
      method: 'POST',
      body: JSON.stringify({
        id: 'known-id',
        user_id: 'test-user',
        user_role: '1'
      })
    });

    const oldResponse = await fetch('/api/comparativas/get/known-id', {
      method: 'POST',
      body: JSON.stringify({
        id: 'known-id',
        user_id: 'test-user',
        user_role: '1'
      })
    });

    const newData = await newResponse.json();
    const oldData = await oldResponse.json();

    // Verify structure matches exactly
    expect(Object.keys(newData)).toEqual(Object.keys(oldData));
    
    if (newData.success && oldData.success) {
      expect(Object.keys(newData.data)).toEqual(Object.keys(oldData.data));
      expect(newData.data.id).toBe(oldData.data.id);
      expect(newData.data.client).toBe(oldData.data.client);
      // ... verify all fields match
    }
  });

  test('should return same error format for invalid requests', async () => {
    const invalidRequest = {
      // Missing required fields
    };

    const newResponse = await fetch('/new_api/comparisons/invalid', {
      method: 'POST',
      body: JSON.stringify(invalidRequest)
    });

    const oldResponse = await fetch('/api/comparativas/get/invalid', {
      method: 'POST',
      body: JSON.stringify(invalidRequest)
    });

    expect(newResponse.status).toBe(oldResponse.status);
    
    const newData = await newResponse.json();
    const oldData = await oldResponse.json();
    
    expect(newData.success).toBe(oldData.success);
    expect(newData.error).toBe(oldData.error);
  });
});
```

### 5. Security Tests

#### Input Validation Security
```typescript
// tests/security/input-validation.test.ts
describe('Security Tests', () => {
  test('should prevent SQL injection attempts', async () => {
    const maliciousId = "'; DROP TABLE comparativas; --";
    
    const response = await fetch(`/new_api/comparisons/${encodeURIComponent(maliciousId)}`, {
      method: 'POST',
      body: JSON.stringify({
        id: maliciousId,
        user_id: 'test-user',
        user_role: '1'
      })
    });

    // Should handle gracefully, not crash
    expect(response.status).toBeOneOf([400, 404, 500]);
    
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should validate user role properly', async () => {
    const response = await fetch('/new_api/comparisons/test-id', {
      method: 'POST',
      body: JSON.stringify({
        id: 'test-id',
        user_id: 'test-user',
        user_role: 'admin' // Invalid role
      })
    });

    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should enforce authorization boundaries', async () => {
    // Try to access comparison from different user
    const response = await fetch('/new_api/comparisons/other-user-comparison', {
      method: 'POST',
      body: JSON.stringify({
        id: 'other-user-comparison',
        user_id: 'unauthorized-user',
        user_role: '1'
      })
    });

    expect(response.status).toBe(404);
    
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Comparativa not found');
  });
});
```

## 📊 Test Execution Plan

### 1. Pre-Deployment Testing

#### Local Development
```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --testPathPattern=comparison-by-id
npm test -- --testPathPattern=performance
npm test -- --testPathPattern=compatibility

# Run with coverage
npm test -- --coverage
```

#### Staging Environment
```bash
# Integration tests
npm run test:integration

# Load testing
npm run test:load

# Compatibility testing
npm run test:compatibility
```

### 2. Production Deployment Testing

#### Smoke Tests (Post-Deployment)
```bash
#!/bin/bash
# Basic functionality verification
curl -X POST "https://production-domain/new_api/comparisons/test-id" \
  -H "Content-Type: application/json" \
  -d '{"id":"test-id","user_id":"test-user","user_role":"1"}'

# Verify response format
# Verify response time < 500ms
# Verify no 5xx errors
```

#### Health Checks
```typescript
// Automated health check
const healthCheck = async () => {
  const response = await fetch('/new_api/comparisons/health-check-id', {
    method: 'POST',
    body: JSON.stringify({
      id: 'health-check-id',
      user_id: 'health-check-user',
      user_role: '1'
    })
  });
  
  return {
    status: response.status,
    responseTime: response.headers.get('x-response-time'),
    success: response.ok
  };
};
```

## 📈 Test Metrics & Reporting

### Coverage Requirements
- **Line Coverage**: > 90%
- **Branch Coverage**: > 85%
- **Function Coverage**: 100%
- **Statement Coverage**: > 95%

### Performance Baselines
```typescript
interface PerformanceBaseline {
  responseTime: {
    p50: 200; // ms
    p95: 500; // ms
    p99: 1000; // ms
  };
  throughput: 1000; // requests/second
  errorRate: 0.1; // percentage
  memoryUsage: 50; // MB per request
}
```

### Test Reporting
```bash
# Generate test report
npm run test:report

# Performance report
npm run test:performance:report

# Coverage report
npm run test:coverage:report
```

## ✅ Test Checklist

### Unit Tests
- [ ] Input validation (happy path)
- [ ] Input validation (error cases)
- [ ] Authorization logic (regular user)
- [ ] Authorization logic (manager role)
- [ ] Data transformation functions
- [ ] Error handling scenarios
- [ ] Database query functions

### Integration Tests
- [ ] End-to-end API calls
- [ ] Database integration
- [ ] File retrieval integration
- [ ] Authorization integration
- [ ] Error response integration

### Performance Tests
- [ ] Load testing (100 concurrent users)
- [ ] Stress testing (500+ concurrent users)
- [ ] Response time benchmarks
- [ ] Memory usage validation
- [ ] Database query performance

### Compatibility Tests
- [ ] Response format validation
- [ ] Error message compatibility
- [ ] HTTP status code matching
- [ ] Request parameter compatibility
- [ ] Authorization behavior matching

### Security Tests
- [ ] SQL injection prevention
- [ ] Input sanitization
- [ ] Authorization boundary testing
- [ ] Role validation
- [ ] Data access controls

---

**Testing Status**: ✅ Comprehensive test strategy ready for implementation with 100% compatibility validation and performance verification.
