# 📝 Solar Installation DELETE Endpoint - Migration Guide

## 🎯 Migration Overview

This guide covers the migration from the legacy DELETE endpoint to the new RESTful API following screaming architecture principles.

| Aspect | Legacy | New API |
|--------|--------|---------|
| **Endpoint** | `/api/fotovoltaica/delete/[id]` | `/new_api/solar-installations/[id]` |
| **HTTP Method** | `POST` | `DELETE` |
| **Architecture** | CRUD-based | Business Entity-based |
| **Request Format** | Identical | Identical |
| **Response Format** | Identical | Identical |

## 🔄 API Endpoint Mapping

### Request Structure (Unchanged)

```typescript
// Both endpoints use identical request structure
DELETE /new_api/solar-installations/{installation-id}
Content-Type: application/json

{
  "organization_id": "string"
}
```

### Response Structure (Unchanged)

```typescript
// SUCCESS Response (Identical)
{
  "success": true
}

// ERROR Response (Identical)
{
  "success": false,
  "error": "Error message in Spanish"
}
```

## 🚨 Breaking Changes

**✅ ZERO BREAKING CHANGES**

The refactored endpoint maintains 100% functional compatibility with the original endpoint:

- ✅ Identical request body structure
- ✅ Identical response format
- ✅ Identical error messages
- ✅ Identical HTTP status codes
- ✅ Identical business logic flow

## 📋 Migration Checklist

### Phase 1: Pre-Migration Preparation

- [ ] **Review existing integrations** that call `/api/fotovoltaica/delete/[id]`
- [ ] **Identify all client applications** using this endpoint
- [ ] **Document current usage patterns** and error handling
- [ ] **Set up monitoring** for current endpoint performance
- [ ] **Prepare rollback plan** in case of issues

### Phase 2: New Endpoint Validation

- [ ] **Deploy new endpoint** alongside existing endpoint
- [ ] **Run comprehensive tests** against new endpoint
- [ ] **Validate performance metrics** meet or exceed current benchmarks
- [ ] **Confirm error handling** matches original behavior exactly
- [ ] **Test edge cases** and error scenarios

### Phase 3: Gradual Migration

- [ ] **Implement feature flag** for endpoint selection
- [ ] **Route 10% of traffic** to new endpoint initially
- [ ] **Monitor error rates** and performance metrics
- [ ] **Gradually increase traffic** to 25%, 50%, 75%, 100%
- [ ] **Validate business metrics** remain stable throughout migration

### Phase 4: Legacy Cleanup

- [ ] **Confirm 100% traffic** is on new endpoint
- [ ] **Monitor for 24-48 hours** to ensure stability
- [ ] **Deprecate legacy endpoint** with appropriate notice
- [ ] **Remove legacy code** after deprecation period
- [ ] **Update API documentation** to reflect new endpoints

## 🔧 Client Code Migration

### Frontend Application Changes

```typescript
// BEFORE: Legacy endpoint call
const deleteInstallation = async (installationId: string, organizationId: string) => {
  const response = await fetch(`/api/fotovoltaica/delete/${installationId}`, {
    method: 'POST',  // Legacy used POST
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      organization_id: organizationId,
    }),
  });
  
  return response.json();
};

// AFTER: New endpoint call
const deleteInstallation = async (installationId: string, organizationId: string) => {
  const response = await fetch(`/new_api/solar-installations/${installationId}`, {
    method: 'DELETE',  // Now uses proper DELETE method
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      organization_id: organizationId,
    }),
  });
  
  return response.json();
};
```

### Backend Service Changes

```typescript
// BEFORE: Legacy service call
class SolarInstallationService {
  async deleteSolarInstallation(installationId: string, organizationId: string) {
    const response = await fetch(`${API_BASE_URL}/api/fotovoltaica/delete/${installationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization_id: organizationId }),
    });
    
    return response.json();
  }
}

// AFTER: New service call
class SolarInstallationService {
  async deleteSolarInstallation(installationId: string, organizationId: string) {
    const response = await fetch(`${API_BASE_URL}/new_api/solar-installations/${installationId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization_id: organizationId }),
    });
    
    return response.json();
  }
}
```

## 🎛️ Feature Flag Implementation

### Environment Configuration

```bash
# .env.local
USE_NEW_SOLAR_DELETE_API=false  # Start with legacy endpoint
```

### Runtime Feature Toggle

```typescript
// utils/featureFlags.ts
export const useNewSolarDeleteAPI = () => {
  return process.env.USE_NEW_SOLAR_DELETE_API === 'true';
};

// services/solarInstallationService.ts
export const deleteSolarInstallation = async (
  installationId: string, 
  organizationId: string
) => {
  const useNewAPI = useNewSolarDeleteAPI();
  
  const endpoint = useNewAPI 
    ? `/new_api/solar-installations/${installationId}`
    : `/api/fotovoltaica/delete/${installationId}`;
    
  const method = useNewAPI ? 'DELETE' : 'POST';
  
  const response = await fetch(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organization_id: organizationId }),
  });
  
  return response.json();
};
```

### Gradual Traffic Migration

```typescript
// Advanced: Percentage-based rollout
export const shouldUseNewSolarDeleteAPI = (userId?: string) => {
  const rolloutPercentage = parseInt(process.env.NEW_SOLAR_DELETE_ROLLOUT_PERCENT || '0');
  
  if (rolloutPercentage === 0) return false;
  if (rolloutPercentage >= 100) return true;
  
  // Consistent user-based routing
  if (userId) {
    const hash = cyrpto.createHash('md5').update(userId).digest('hex');
    const userPercent = parseInt(hash.substring(0, 2), 16) / 255 * 100;
    return userPercent < rolloutPercentage;
  }
  
  // Random routing for anonymous users
  return Math.random() * 100 < rolloutPercentage;
};
```

## 📊 Monitoring During Migration

### Key Metrics to Track

```typescript
// Performance Metrics
interface MigrationMetrics {
  // Response Time Metrics
  legacyEndpointResponseTime: number;
  newEndpointResponseTime: number;
  responseTimeImprovement: number;
  
  // Error Rate Metrics
  legacyEndpointErrorRate: number;
  newEndpointErrorRate: number;
  
  // Success Rate Metrics
  legacySuccessRate: number;
  newSuccessRate: number;
  
  // Business Metrics
  deletionsPerMinute: number;
  filesDeletedPerOperation: number;
  storageUsageReduction: number;
}
```

### Monitoring Setup

```typescript
// monitoring/solarInstallationMetrics.ts
export const trackDeletionMetrics = (
  endpoint: 'legacy' | 'new',
  duration: number,
  success: boolean,
  fileCount: number
) => {
  // Send metrics to your monitoring service
  metrics.histogram('solar_installation_deletion_duration', duration, {
    endpoint,
    success: success.toString(),
  });
  
  metrics.counter('solar_installation_deletion_total', 1, {
    endpoint,
    success: success.toString(),
  });
  
  metrics.histogram('solar_installation_files_deleted', fileCount, {
    endpoint,
  });
};
```

### Alert Conditions

```yaml
# alerts.yml
alerts:
  - name: solar_deletion_error_rate_spike
    condition: error_rate > 1% for 5 minutes
    action: rollback_to_legacy_endpoint
    
  - name: solar_deletion_performance_degradation
    condition: avg_response_time > 500ms for 5 minutes
    action: investigate_performance
    
  - name: solar_deletion_success_rate_drop
    condition: success_rate < 99% for 5 minutes
    action: immediate_investigation
```

## 🔄 Rollback Strategy

### Automatic Rollback Triggers

```typescript
// rollback/automaticRollback.ts
const ROLLBACK_THRESHOLDS = {
  errorRate: 2, // 2% error rate
  responseTime: 1000, // 1 second average response time
  successRate: 98, // Below 98% success rate
};

export const checkRollbackConditions = (metrics: MigrationMetrics) => {
  if (metrics.newEndpointErrorRate > ROLLBACK_THRESHOLDS.errorRate) {
    return { shouldRollback: true, reason: 'High error rate' };
  }
  
  if (metrics.newEndpointResponseTime > ROLLBACK_THRESHOLDS.responseTime) {
    return { shouldRollback: true, reason: 'Performance degradation' };
  }
  
  if (metrics.newSuccessRate < ROLLBACK_THRESHOLDS.successRate) {
    return { shouldRollback: true, reason: 'Low success rate' };
  }
  
  return { shouldRollback: false };
};
```

### Manual Rollback Process

```bash
# Emergency rollback procedure
echo "Initiating emergency rollback..."

# Step 1: Set feature flag to legacy endpoint
export USE_NEW_SOLAR_DELETE_API=false

# Step 2: Update environment variables
kubectl set env deployment/negoco-crm USE_NEW_SOLAR_DELETE_API=false

# Step 3: Verify rollback success
curl -X POST /api/fotovoltaica/delete/test-id \
  -H "Content-Type: application/json" \
  -d '{"organization_id": "test-org"}'

echo "Rollback completed. Monitor metrics for stability."
```

## 🧪 Testing Strategy

### Pre-Migration Testing

```typescript
// tests/migration/solarDeletionMigration.test.ts
describe('Solar Installation Deletion Migration', () => {
  test('legacy endpoint maintains functionality', async () => {
    const response = await request(app)
      .post('/api/fotovoltaica/delete/test-id')
      .send({ organization_id: 'test-org' })
      .expect(200);
      
    expect(response.body).toEqual({ success: true });
  });
  
  test('new endpoint provides identical functionality', async () => {
    const response = await request(app)
      .delete('/new_api/solar-installations/test-id')
      .send({ organization_id: 'test-org' })
      .expect(200);
      
    expect(response.body).toEqual({ success: true });
  });
  
  test('both endpoints handle errors identically', async () => {
    const legacyResponse = await request(app)
      .post('/api/fotovoltaica/delete/nonexistent')
      .send({ organization_id: 'test-org' })
      .expect(404);
      
    const newResponse = await request(app)
      .delete('/new_api/solar-installations/nonexistent')
      .send({ organization_id: 'test-org' })
      .expect(404);
      
    expect(legacyResponse.body).toEqual(newResponse.body);
  });
});
```

### Load Testing

```typescript
// tests/load/solarDeletionLoad.test.ts
import { check } from 'k6';
import http from 'k6/http';

export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up
    { duration: '5m', target: 10 },   // Stay at 10 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
};

export default function () {
  const payload = JSON.stringify({
    organization_id: 'load-test-org',
  });
  
  const params = {
    headers: { 'Content-Type': 'application/json' },
  };
  
  // Test new endpoint
  const response = http.del(
    `${__ENV.BASE_URL}/new_api/solar-installations/load-test-${Math.random()}`,
    payload,
    params
  );
  
  check(response, {
    'status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

## 📈 Success Metrics

### Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Response Time** | <500ms average | P95 response time |
| **Error Rate** | <0.5% | 5-minute rolling average |
| **Success Rate** | >99.5% | Successful deletions / total attempts |
| **Throughput** | Maintain current | Requests per minute |

### Business Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Data Consistency** | 100% | Storage/database sync rate |
| **User Impact** | Zero errors | User-reported issues |
| **Operational Efficiency** | Improved | Support ticket reduction |

## ⚠️ Risks and Mitigation

### Identified Risks

1. **Performance Regression**
   - **Risk**: New endpoint slower than legacy
   - **Mitigation**: Comprehensive performance testing and monitoring
   - **Rollback**: Automatic rollback if response time > 1 second

2. **Data Consistency Issues**
   - **Risk**: File/database sync problems
   - **Mitigation**: Atomic operations and comprehensive testing
   - **Rollback**: Manual intervention and data verification

3. **Client Integration Issues**
   - **Risk**: Client applications break due to subtle differences
   - **Mitigation**: Gradual rollout and extensive compatibility testing
   - **Rollback**: Feature flag-based instant rollback

### Mitigation Strategies

```typescript
// Comprehensive error handling and monitoring
export const safeEndpointCall = async (
  endpoint: string,
  options: RequestInit
): Promise<Response> => {
  const startTime = Date.now();
  
  try {
    const response = await fetch(endpoint, {
      ...options,
      timeout: 5000, // 5 second timeout
    });
    
    const duration = Date.now() - startTime;
    
    // Track metrics
    trackMetrics({
      endpoint,
      duration,
      status: response.status,
      success: response.ok,
    });
    
    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Track error metrics
    trackErrorMetrics({
      endpoint,
      duration,
      error: error.message,
    });
    
    throw error;
  }
};
```

## 🎯 Timeline and Milestones

### Week 1: Preparation
- [ ] Deploy new endpoint to staging
- [ ] Complete comprehensive testing
- [ ] Set up monitoring and alerts
- [ ] Prepare client migration code

### Week 2: Gradual Rollout
- [ ] Deploy to production (0% traffic)
- [ ] Enable 10% traffic to new endpoint
- [ ] Monitor for 48 hours
- [ ] Increase to 25% if metrics are stable

### Week 3: Full Migration
- [ ] Increase to 50% traffic
- [ ] Monitor for 24 hours
- [ ] Increase to 100% traffic
- [ ] Monitor for 48 hours for complete stability

### Week 4: Cleanup
- [ ] Confirm stable operation
- [ ] Begin legacy endpoint deprecation
- [ ] Update documentation
- [ ] Schedule legacy code removal

## 📞 Support and Troubleshooting

### Common Issues and Solutions

1. **Error: "Missing parameters"**
   - **Cause**: Empty or missing `organization_id` in request body
   - **Solution**: Ensure request body contains valid `organization_id`

2. **Error: "Database client not initialized"**
   - **Cause**: Database connection issues
   - **Solution**: Check database connectivity and retry

3. **Error: "No se encontró el trámite"**
   - **Cause**: Installation ID doesn't exist in database
   - **Solution**: Verify installation ID exists before deletion

### Emergency Contacts

- **Primary**: Development Team Lead
- **Secondary**: DevOps Engineer
- **Escalation**: CTO

### Rollback Contacts

- **Immediate Rollback**: On-call Engineer
- **Rollback Verification**: QA Lead
- **Business Impact Assessment**: Product Manager

---

**Migration Guide Version**: 1.0  
**Last Updated**: 2025-01-17T18:30:00Z  
**Review Date**: 2025-02-17T18:30:00Z
