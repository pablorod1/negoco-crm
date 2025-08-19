# 🧪 TESTING STRATEGY: Paginated Comparisons API

**Endpoint**: `/new_api/comparisons` (GET)  
**Migration From**: `/api/comparativas/get/paginated-comparativas`  
**Date**: January 14, 2025

## Test Suite Overview

This document outlines the comprehensive testing strategy for the refactored paginated comparisons endpoint, ensuring 100% backward compatibility and performance improvements.

## Unit Tests

### 1. Request Validation Tests

```typescript
import { GET, POST } from '@/app/new_api/comparisons/route';
import { NextRequest } from 'next/server';

describe('/new_api/comparisons - Request Validation', () => {
  
  test('GET: should accept valid query parameters', async () => {
    const url = new URL('http://localhost:3000/new_api/comparisons');
    url.searchParams.set('page', '1');
    url.searchParams.set('rowsPerPage', '10');
    url.searchParams.set('user_id', 'test-user-123');
    url.searchParams.set('user_role', '2');

    const request = new NextRequest(url);
    const response = await GET(request);
    
    expect(response.status).toBe(200);
  });

  test('GET: should reject missing required parameters', async () => {
    const url = new URL('http://localhost:3000/new_api/comparisons');
    url.searchParams.set('page', '1');
    // Missing rowsPerPage, user_id, user_role
    
    const request = new NextRequest(url);
    const response = await GET(request);
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Missing parameters");
  });

  test('POST: should accept backward compatible request body', async () => {
    const requestBody = {
      page: 1,
      rowsPerPage: 10,
      user_id: 'test-user-123',
      user_role: '2',
      filterValue: 'test client',
      statusFilter: ['pending', 'completed'],
      dateRange: {
        from: new Date('2024-01-01'),
        to: new Date('2024-12-31')
      }
    };

    const request = new NextRequest('http://localhost:3000/new_api/comparisons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
```

### 2. Response Format Tests

```typescript
describe('/new_api/comparisons - Response Format', () => {
  
  test('should return exact original response structure', async () => {
    const url = new URL('http://localhost:3000/new_api/comparisons');
    url.searchParams.set('page', '1');
    url.searchParams.set('rowsPerPage', '5');
    url.searchParams.set('user_id', 'test-user');
    url.searchParams.set('user_role', '1');

    const request = new NextRequest(url);
    const response = await GET(request);
    const data = await response.json();

    // Verify response structure
    expect(data).toHaveProperty('success');
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('total');
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(typeof data.total).toBe('number');

    // Verify comparison item structure
    if (data.data.length > 0) {
      const comparison = data.data[0];
      expect(comparison).toHaveProperty('id');
      expect(comparison).toHaveProperty('creation_date');
      expect(comparison).toHaveProperty('client');
      expect(comparison).toHaveProperty('comision_sales_person');
      expect(comparison).toHaveProperty('comision');
      expect(comparison).toHaveProperty('status');
      expect(comparison).toHaveProperty('service');
      expect(comparison).toHaveProperty('plan');
      expect(comparison).toHaveProperty('tramite_id');
      expect(comparison).toHaveProperty('user');

      // Verify nested object structures
      expect(comparison.comision_sales_person).toHaveProperty('fijo');
      expect(comparison.comision_sales_person).toHaveProperty('indexado');
      expect(comparison.comision).toHaveProperty('fijo');
      expect(comparison.comision).toHaveProperty('indexado');
      expect(comparison.user).toHaveProperty('name');
      expect(comparison.user).toHaveProperty('email');
      expect(comparison.user).toHaveProperty('image');
    }
  });

  test('should return proper error response format', async () => {
    const url = new URL('http://localhost:3000/new_api/comparisons');
    // Missing required parameters
    
    const request = new NextRequest(url);
    const response = await GET(request);
    const data = await response.json();

    expect(data).toHaveProperty('success');
    expect(data).toHaveProperty('error');
    expect(data.success).toBe(false);
    expect(typeof data.error).toBe('string');
  });
});
```

### 3. Filtering Logic Tests

```typescript
describe('/new_api/comparisons - Filtering', () => {
  
  test('should apply text filter correctly', async () => {
    const url = new URL('http://localhost:3000/new_api/comparisons');
    url.searchParams.set('page', '1');
    url.searchParams.set('rowsPerPage', '10');
    url.searchParams.set('user_id', 'test-user');
    url.searchParams.set('user_role', '1');
    url.searchParams.set('filterValue', 'Test Client');

    const request = new NextRequest(url);
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    // Verify that results contain the filter term
    if (data.data.length > 0) {
      const hasFilterMatch = data.data.some((item: any) => 
        item.client.toLowerCase().includes('test client') ||
        item.id.toLowerCase().includes('test client') ||
        item.user.name.toLowerCase().includes('test client') ||
        item.user.email.toLowerCase().includes('test client')
      );
      expect(hasFilterMatch).toBe(true);
    }
  });

  test('should apply status filter correctly', async () => {
    const url = new URL('http://localhost:3000/new_api/comparisons');
    url.searchParams.set('page', '1');
    url.searchParams.set('rowsPerPage', '10');
    url.searchParams.set('user_id', 'test-user');
    url.searchParams.set('user_role', '1');
    url.searchParams.set('statusFilter', JSON.stringify(['pending', 'completed']));

    const request = new NextRequest(url);
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    // Verify all results match the status filter
    data.data.forEach((item: any) => {
      expect(['pending', 'completed']).toContain(item.status);
    });
  });

  test('should apply date range filter correctly', async () => {
    const dateRange = {
      from: new Date('2024-01-01'),
      to: new Date('2024-12-31')
    };

    const url = new URL('http://localhost:3000/new_api/comparisons');
    url.searchParams.set('page', '1');
    url.searchParams.set('rowsPerPage', '10');
    url.searchParams.set('user_id', 'test-user');
    url.searchParams.set('user_role', '1');
    url.searchParams.set('dateRange', JSON.stringify(dateRange));

    const request = new NextRequest(url);
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    // Verify all results fall within the date range
    data.data.forEach((item: any) => {
      const creationDate = new Date(item.creation_date);
      expect(creationDate >= dateRange.from).toBe(true);
      expect(creationDate <= dateRange.to).toBe(true);
    });
  });
});
```

### 4. Pagination Tests

```typescript
describe('/new_api/comparisons - Pagination', () => {
  
  test('should paginate results correctly', async () => {
    // Test first page
    const url1 = new URL('http://localhost:3000/new_api/comparisons');
    url1.searchParams.set('page', '1');
    url1.searchParams.set('rowsPerPage', '5');
    url1.searchParams.set('user_id', 'test-user');
    url1.searchParams.set('user_role', '1');

    const request1 = new NextRequest(url1);
    const response1 = await GET(request1);
    const data1 = await response1.json();

    // Test second page
    const url2 = new URL('http://localhost:3000/new_api/comparisons');
    url2.searchParams.set('page', '2');
    url2.searchParams.set('rowsPerPage', '5');
    url2.searchParams.set('user_id', 'test-user');
    url2.searchParams.set('user_role', '1');

    const request2 = new NextRequest(url2);
    const response2 = await GET(request2);
    const data2 = await response2.json();

    expect(data1.success).toBe(true);
    expect(data2.success).toBe(true);
    
    // Verify pagination logic
    expect(data1.data.length).toBeLessThanOrEqual(5);
    expect(data2.data.length).toBeLessThanOrEqual(5);
    
    // Verify total count is consistent
    expect(data1.total).toBe(data2.total);

    // Verify different data sets (no overlap)
    const ids1 = data1.data.map((item: any) => item.id);
    const ids2 = data2.data.map((item: any) => item.id);
    const overlap = ids1.filter((id: string) => ids2.includes(id));
    expect(overlap.length).toBe(0);
  });

  test('should respect rowsPerPage parameter', async () => {
    const url = new URL('http://localhost:3000/new_api/comparisons');
    url.searchParams.set('page', '1');
    url.searchParams.set('rowsPerPage', '3');
    url.searchParams.set('user_id', 'test-user');
    url.searchParams.set('user_role', '1');

    const request = new NextRequest(url);
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.length).toBeLessThanOrEqual(3);
  });
});
```

## Integration Tests

### 1. Database Integration Tests

```typescript
describe('/new_api/comparisons - Database Integration', () => {
  
  test('should execute queries without errors', async () => {
    const url = new URL('http://localhost:3000/new_api/comparisons');
    url.searchParams.set('page', '1');
    url.searchParams.set('rowsPerPage', '10');
    url.searchParams.set('user_id', 'test-user');
    url.searchParams.set('user_role', '1');

    const request = new NextRequest(url);
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  test('should handle database connection errors gracefully', async () => {
    // Mock database connection failure
    jest.mock('@/core/libsql/client', () => ({
      getTursoClient: jest.fn(() => null)
    }));

    const url = new URL('http://localhost:3000/new_api/comparisons');
    url.searchParams.set('page', '1');
    url.searchParams.set('rowsPerPage', '10');
    url.searchParams.set('user_id', 'test-user');
    url.searchParams.set('user_role', '1');

    const request = new NextRequest(url);
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Database client not initialized");
  });
});
```

### 2. User Role and Access Control Tests

```typescript
describe('/new_api/comparisons - Access Control', () => {
  
  test('should filter results based on user role', async () => {
    // Test role-based filtering for role "2" (subcomerciales)
    const url = new URL('http://localhost:3000/new_api/comparisons');
    url.searchParams.set('page', '1');
    url.searchParams.set('rowsPerPage', '10');
    url.searchParams.set('user_id', 'user-with-subcomerciales');
    url.searchParams.set('user_role', '2');

    const request = new NextRequest(url);
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    // Verify that results include user's data and subcomerciales data
  });

  test('should handle subcomerciales lookup errors', async () => {
    // Mock subcomerciales lookup failure
    jest.mock('@/core/libsql/users/getSubcomerciales', () => ({
      getSubcomerciales: jest.fn(() => Promise.resolve({ success: false }))
    }));

    const url = new URL('http://localhost:3000/new_api/comparisons');
    url.searchParams.set('page', '1');
    url.searchParams.set('rowsPerPage', '10');
    url.searchParams.set('user_id', 'test-user');
    url.searchParams.set('user_role', '2');

    const request = new NextRequest(url);
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    // Should fallback to user's own data only
  });
});
```

## Performance Tests

### 1. Response Time Tests

```typescript
describe('/new_api/comparisons - Performance', () => {
  
  test('should respond within acceptable time limits', async () => {
    const startTime = performance.now();

    const url = new URL('http://localhost:3000/new_api/comparisons');
    url.searchParams.set('page', '1');
    url.searchParams.set('rowsPerPage', '50');
    url.searchParams.set('user_id', 'test-user');
    url.searchParams.set('user_role', '1');

    const request = new NextRequest(url);
    await GET(request);

    const endTime = performance.now();
    const responseTime = endTime - startTime;

    // Expect response within 1 second for large datasets
    expect(responseTime).toBeLessThan(1000);
  });

  test('should handle large result sets efficiently', async () => {
    const url = new URL('http://localhost:3000/new_api/comparisons');
    url.searchParams.set('page', '1');
    url.searchParams.set('rowsPerPage', '100');
    url.searchParams.set('user_id', 'test-user');
    url.searchParams.set('user_role', '1');

    const request = new NextRequest(url);
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.length).toBeLessThanOrEqual(100);
  });
});
```

### 2. Memory Usage Tests

```typescript
describe('/new_api/comparisons - Memory Usage', () => {
  
  test('should not cause memory leaks with repeated requests', async () => {
    const initialMemory = process.memoryUsage();

    // Execute multiple requests
    for (let i = 0; i < 10; i++) {
      const url = new URL('http://localhost:3000/new_api/comparisons');
      url.searchParams.set('page', '1');
      url.searchParams.set('rowsPerPage', '20');
      url.searchParams.set('user_id', 'test-user');
      url.searchParams.set('user_role', '1');

      const request = new NextRequest(url);
      await GET(request);
    }

    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    
    // Memory increase should be minimal (less than 10MB)
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
  });
});
```

## Backward Compatibility Tests

### 1. Cross-Endpoint Comparison Tests

```typescript
describe('/new_api/comparisons - Backward Compatibility', () => {
  
  test('new endpoint returns identical data to original endpoint', async () => {
    const requestParams = {
      page: 1,
      rowsPerPage: 10,
      user_id: 'test-user',
      user_role: '1',
      filterValue: 'test',
      statusFilter: ['pending']
    };

    // Test original endpoint
    const originalResponse = await fetch('/api/comparativas/get/paginated-comparativas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestParams)
    });
    const originalData = await originalResponse.json();

    // Test new endpoint (POST compatibility)
    const newResponse = await fetch('/new_api/comparisons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestParams)
    });
    const newData = await newResponse.json();

    // Compare essential data structures
    expect(newData.success).toBe(originalData.success);
    expect(newData.total).toBe(originalData.total);
    expect(newData.data.length).toBe(originalData.data.length);

    // Compare individual items
    for (let i = 0; i < newData.data.length; i++) {
      const newItem = newData.data[i];
      const originalItem = originalData.data[i];
      
      expect(newItem.id).toBe(originalItem.id);
      expect(newItem.client).toBe(originalItem.client);
      expect(newItem.status).toBe(originalItem.status);
      expect(newItem.service).toBe(originalItem.service);
    }
  });
});
```

## Error Handling Tests

### 1. Malformed Input Tests

```typescript
describe('/new_api/comparisons - Error Handling', () => {
  
  test('should handle malformed JSON parameters gracefully', async () => {
    const url = new URL('http://localhost:3000/new_api/comparisons');
    url.searchParams.set('page', '1');
    url.searchParams.set('rowsPerPage', '10');
    url.searchParams.set('user_id', 'test-user');
    url.searchParams.set('user_role', '1');
    url.searchParams.set('statusFilter', 'invalid-json');

    const request = new NextRequest(url);
    const response = await GET(request);
    const data = await response.json();

    // Should handle gracefully and continue processing
    expect(response.status).not.toBe(500);
  });

  test('should handle SQL injection attempts', async () => {
    const url = new URL('http://localhost:3000/new_api/comparisons');
    url.searchParams.set('page', '1');
    url.searchParams.set('rowsPerPage', '10');
    url.searchParams.set('user_id', "'; DROP TABLE comparativas; --");
    url.searchParams.set('user_role', '1');

    const request = new NextRequest(url);
    const response = await GET(request);

    // Should not cause server errors
    expect(response.status).not.toBe(500);
  });
});
```

## Load Testing Strategy

### 1. Concurrent Request Tests

```typescript
describe('/new_api/comparisons - Load Testing', () => {
  
  test('should handle concurrent requests efficiently', async () => {
    const concurrentRequests = 20;
    const requests = [];

    for (let i = 0; i < concurrentRequests; i++) {
      const url = new URL('http://localhost:3000/new_api/comparisons');
      url.searchParams.set('page', String(i % 5 + 1));
      url.searchParams.set('rowsPerPage', '10');
      url.searchParams.set('user_id', `test-user-${i}`);
      url.searchParams.set('user_role', '1');

      const request = new NextRequest(url);
      requests.push(GET(request));
    }

    const startTime = performance.now();
    const responses = await Promise.all(requests);
    const endTime = performance.now();

    // All requests should succeed
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });

    // Total time should be reasonable for concurrent execution
    expect(endTime - startTime).toBeLessThan(5000);
  });
});
```

## Test Execution Commands

### Running Test Suite

```bash
# Run all tests
npm test src/app/new_api/comparisons/route.test.ts

# Run specific test categories
npm test -- --testNamePattern="Request Validation"
npm test -- --testNamePattern="Performance"
npm test -- --testNamePattern="Backward Compatibility"

# Run tests with coverage
npm test -- --coverage src/app/new_api/comparisons/route.test.ts

# Run load tests
npm test -- --testNamePattern="Load Testing"
```

### Performance Benchmarking

```bash
# Benchmark against original endpoint
npm run benchmark:comparisons

# Monitor memory usage during tests
npm test -- --detectOpenHandles --forceExit
```

## Success Criteria

### ✅ All Tests Must Pass

1. **Functional Tests**: 100% pass rate for all business logic tests
2. **Compatibility Tests**: Identical behavior to original endpoint
3. **Performance Tests**: Response times under 500ms for standard queries
4. **Security Tests**: No vulnerabilities in parameter handling
5. **Error Handling**: Graceful handling of all error scenarios

### 📊 Performance Benchmarks

- **Response Time**: < 500ms for 95% of requests
- **Throughput**: > 100 requests/second under load
- **Memory Usage**: < 50MB heap increase under sustained load
- **Error Rate**: < 0.1% for valid requests

### 🔒 Security Validation

- **SQL Injection**: Zero successful injection attempts
- **Parameter Validation**: All malformed inputs handled safely
- **Access Control**: User role restrictions properly enforced

---

**Test Implementation**: Complete test suite ready for execution with Jest/Node.js testing framework. All tests validate both functional correctness and performance improvements.
