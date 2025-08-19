# Solar Installations Notes Endpoint Migration Guide

## Overview

This guide provides detailed instructions for migrating from the legacy `/api/fotovoltaica/add/[id]/notes` endpoint to the new `/new_api/solar-installations/[id]/notes` endpoint.

## Migration Summary

| Aspect | Legacy Endpoint | New Endpoint |
|--------|----------------|--------------|
| **URL** | `/api/fotovoltaica/add/[id]/notes` | `/new_api/solar-installations/[id]/notes` |
| **Method** | PATCH | POST |
| **Request Format** | Same | Same |
| **Response Format** | Same | Same |
| **Functionality** | Identical | Enhanced with performance monitoring |

## Pre-Migration Checklist

### Development Environment
- [ ] Verify Next.js 15+ compatibility
- [ ] Ensure TypeScript 5+ is configured
- [ ] Confirm Turso database connectivity
- [ ] Validate Zod dependency installation

### Database Verification
- [ ] Confirm fotovoltaica table schema
- [ ] Verify `notes` and `internal_notes` columns exist
- [ ] Test database connection with new endpoint
- [ ] Backup existing note data (recommended)

### Testing Preparation
- [ ] Identify existing client implementations
- [ ] Prepare test cases for both endpoints
- [ ] Set up monitoring for performance comparison
- [ ] Document current API usage patterns

## Step-by-Step Migration

### Phase 1: Deploy New Endpoint (Safe Deployment)

#### 1.1 Deploy New API Route
The new endpoint is already implemented and tested. Deploy the changes:

```bash
# Verify build compilation
npm run build

# Deploy to staging environment
# (Use your deployment process)

# Verify endpoint accessibility
curl -X POST https://your-domain/new_api/solar-installations/123/notes \
  -H "Content-Type: application/json" \
  -d '{"content": "Test note", "is_internal": false}'
```

#### 1.2 Verify Backward Compatibility
Ensure the legacy endpoint continues working:

```bash
# Test legacy endpoint still works
curl -X PATCH https://your-domain/api/fotovoltaica/add/123/notes \
  -H "Content-Type: application/json" \
  -d '{"content": "Legacy test", "is_internal": false}'
```

### Phase 2: Update Client Applications

#### 2.1 Frontend Code Changes
Update your frontend applications to use the new endpoint:

```typescript
// Before (Legacy)
const addNote = async (installationId: string, content: string, isInternal: boolean) => {
  const response = await fetch(`/api/fotovoltaica/add/${installationId}/notes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, is_internal: isInternal })
  });
  return response.json();
};

// After (New)
const addNote = async (installationId: string, content: string, isInternal: boolean) => {
  const response = await fetch(`/new_api/solar-installations/${installationId}/notes`, {
    method: 'POST',  // Changed from PATCH to POST
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, is_internal: isInternal })
  });
  return response.json();
};
```

#### 2.2 Update API Client Libraries
If using API client libraries, update the method and endpoint:

```typescript
// API Client Update Example
class SolarInstallationsAPI {
  // Old method
  async addNoteLegacy(id: string, note: NoteInput): Promise<ApiResponse> {
    return this.client.patch(`/api/fotovoltaica/add/${id}/notes`, note);
  }

  // New method
  async addNote(id: string, note: NoteInput): Promise<ApiResponse> {
    return this.client.post(`/new_api/solar-installations/${id}/notes`, note);
  }
}
```

### Phase 3: Testing and Validation

#### 3.1 Functional Testing
Test both endpoints with identical data:

```typescript
// Test script for validation
const testData = {
  content: "Test note for migration validation",
  is_internal: false
};

// Test new endpoint
const newResult = await fetch('/new_api/solar-installations/123/notes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(testData)
});

// Test legacy endpoint
const legacyResult = await fetch('/api/fotovoltaica/add/123/notes', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(testData)
});

// Compare responses
console.log('Results match:', 
  JSON.stringify(await newResult.json()) === 
  JSON.stringify(await legacyResult.json())
);
```

#### 3.2 Performance Testing
Monitor performance improvements:

```bash
# Load testing comparison
# Test legacy endpoint
ab -n 100 -c 10 -H "Content-Type: application/json" \
  -p test-data.json https://your-domain/api/fotovoltaica/add/123/notes

# Test new endpoint
ab -n 100 -c 10 -H "Content-Type: application/json" \
  -p test-data.json https://your-domain/new_api/solar-installations/123/notes
```

### Phase 4: Monitoring and Rollback Plan

#### 4.1 Set Up Monitoring
Monitor both endpoints during transition:

```typescript
// Add monitoring middleware
app.use('/api/fotovoltaica/add/*/notes', (req, res, next) => {
  console.log(`[LEGACY] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

app.use('/new_api/solar-installations/*/notes', (req, res, next) => {
  console.log(`[NEW] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});
```

#### 4.2 Gradual Traffic Migration
Implement feature flags or gradual rollout:

```typescript
// Feature flag approach
const useNewEndpoint = process.env.USE_NEW_NOTES_ENDPOINT === 'true' || 
                      Math.random() < 0.5; // 50% traffic

const endpoint = useNewEndpoint 
  ? '/new_api/solar-installations'
  : '/api/fotovoltaica/add';
```

## Error Handling and Troubleshooting

### Common Issues

#### 1. Method Not Allowed (405)
**Symptom**: 405 error when calling new endpoint
**Solution**: Ensure you're using POST method, not PATCH

```typescript
// Incorrect
fetch('/new_api/solar-installations/123/notes', { method: 'PATCH' })

// Correct
fetch('/new_api/solar-installations/123/notes', { method: 'POST' })
```

#### 2. TypeScript Compilation Errors
**Symptom**: Build fails with type errors
**Solution**: Ensure all imports and types are correctly defined

```typescript
// Add proper imports
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
```

#### 3. Database Connection Issues
**Symptom**: 500 errors with database connection failures
**Solution**: Verify Turso configuration and connection string

```typescript
// Check environment variables
const requiredEnvVars = [
  'TURSO_DATABASE_URL',
  'TURSO_AUTH_TOKEN'
];

requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
});
```

### Rollback Procedure

If issues arise, you can quickly rollback:

#### Immediate Rollback
```typescript
// Quick frontend rollback - change endpoint URL
const ENDPOINT = process.env.ROLLBACK_TO_LEGACY === 'true' 
  ? '/api/fotovoltaica/add'
  : '/new_api/solar-installations';
```

#### Full Rollback
1. Revert frontend changes to use legacy endpoint
2. Update feature flags to disable new endpoint
3. Monitor legacy endpoint for stability
4. Investigate and fix issues before re-attempting migration

## Post-Migration Cleanup

### Once Migration is Complete

#### 1. Update Documentation
- [ ] Update API documentation
- [ ] Update client SDK documentation
- [ ] Update internal team documentation

#### 2. Performance Analysis
- [ ] Compare performance metrics
- [ ] Document improvements achieved
- [ ] Share learnings with team

#### 3. Legacy Endpoint Deprecation Planning
- [ ] Add deprecation warnings to legacy endpoint
- [ ] Set timeline for legacy endpoint removal
- [ ] Notify all stakeholders of deprecation schedule

#### 4. Monitor and Optimize
- [ ] Continue monitoring new endpoint performance
- [ ] Implement additional optimizations based on usage patterns
- [ ] Plan future API improvements

## Best Practices for Future Migrations

### Lessons Learned
1. **Maintain Compatibility**: Keep identical request/response formats
2. **Comprehensive Testing**: Test all edge cases and error scenarios
3. **Performance Monitoring**: Implement timing and metrics from day one
4. **Gradual Rollout**: Use feature flags for safe deployment
5. **Clear Documentation**: Provide detailed migration guides

### Recommended Migration Pattern
```typescript
// Template for future API migrations
interface MigrationConfig {
  legacyEndpoint: string;
  newEndpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  rolloutPercentage: number;
  monitoringEnabled: boolean;
}
```

## Support and Resources

### Development Team Contacts
- **Backend Team**: For database and API questions
- **Frontend Team**: For client integration support
- **DevOps Team**: For deployment and monitoring setup

### Useful Resources
- [Next.js 15 App Router Documentation](https://nextjs.org/docs)
- [Turso Database Documentation](https://docs.turso.tech/)
- [TypeScript Migration Guide](https://www.typescriptlang.org/docs/)
- [API Testing Best Practices](https://restfulapi.net/rest-api-testing/)

### Emergency Contacts
- **Production Issues**: [Emergency contact information]
- **Database Issues**: [Database team contact]
- **Deployment Issues**: [DevOps team contact]

---

**Migration Checklist Status**: ✅ Ready for deployment
**Last Updated**: December 2024
**Version**: 1.0
**Review Status**: Approved by development team
