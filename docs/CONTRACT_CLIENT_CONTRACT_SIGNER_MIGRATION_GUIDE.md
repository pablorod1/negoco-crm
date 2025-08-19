# 📝 CONTRACT CLIENT/CONTRACT/SIGNER MIGRATION GUIDE

**Generated:** August 11, 2025  
**Migration Status:** ✅ **READY FOR DEPLOYMENT**  
**Endpoints Migrated:** 5 endpoints

## Breaking Changes

- **None**: Zero breaking changes implemented
- **Full compatibility**: All existing request/response formats maintained
- **Business logic preservation**: All functionality preserved exactly

## New Endpoints

### Migrated Routes

| Legacy Route | New Route | Method | Status |
|-------------|-----------|--------|--------|
| `POST /api/v1/tramites/add/[id]/client` | `POST /api/v2/contracts/[id]/client` | POST | ✅ Ready |
| `PATCH /api/v1/tramites/update/client` | `PATCH /api/v2/contracts/[id]/client` | PATCH | ✅ Ready |
| `POST /api/v1/tramites/add/[id]/contract` | `POST /api/v2/contracts/[id]/contract` | POST | ✅ Ready |
| `PATCH /api/v1/tramites/update/contract` | `PATCH /api/v2/contracts/[id]/contract` | PATCH | ✅ Ready |
| `PATCH /api/v1/tramites/update/signer` | `PATCH /api/v2/contracts/[id]/signer` | PATCH | ✅ Ready |

### New Dependencies

- **Added**: None - All dependencies already exist in the project
- **Removed**: None - No dependencies removed

### Enhanced Features

1. **Comprehensive Input Validation**
   - Zod schema validation for all request bodies
   - Type-safe coordinate handling for client addresses
   - Email format validation
   - Numeric value validation for contract power settings

2. **Improved Error Handling**
   - Detailed validation error messages
   - Proper HTTP status code usage
   - Consistent error response format

3. **Better Type Safety**
   - Strict TypeScript types
   - Runtime type checking
   - Prevention of type coercion errors

## Configuration Changes

### Environment Variables
- **No new variables required**: All existing environment variables continue to work
- **Database connection**: Uses existing `TURSO_AUTH_TOKEN` and connection settings

### Build Configuration
- **No changes required**: All existing build configurations remain valid
- **TypeScript**: Leverages existing tsconfig.json settings
- **Bundling**: Compatible with existing Bun runtime and build process

## Request/Response Format Examples

### Client Operations

#### Create Client (POST /api/v2/contracts/[id]/client)
```typescript
// Request Body
{
  "client": {
    "id": "CLT-12345",
    "name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "type": "Empresa",
    "phone": "+34600123456",
    "address": "Calle Mayor 123",
    "postal_code": "28001",
    "province": "Madrid",
    "city": "Madrid",
    "document_type": "CIF",
    "document_number": "B12345678",
    "IBAN": "ES9121000418450200051332",
    "coordinates": [40.4168, -3.7038]
  },
  "signer": {
    "id": "SGN-12345",
    "name": "Jane",
    "last_name": "Smith",
    "email": "jane.smith@example.com",
    "phone": "+34600123457",
    "document_number": "12345678A",
    "cargo": "CEO",
    "client_id": "CLT-12345"
  }
}

// Response
{
  "success": true
}
```

#### Update Client (PATCH /api/v2/contracts/[id]/client)
```typescript
// Request Body (same as create)
{
  "client": { /* client data */ },
  "signer": { /* optional signer data */ }
}

// Response
{
  "success": true
}
```

### Contract Operations

#### Create Contract (POST /api/v2/contracts/[id]/contract)
```typescript
// FormData with contracts JSON string
formData.append("contracts", JSON.stringify([{
  "id": "CNT-12345",
  "type": "Electricidad",
  "province": "Madrid",
  "city": "Madrid",
  "address": "Calle Mayor 123",
  "postal_code": "28001",
  "old_company": "Iberdrola",
  "new_company": "Endesa",
  "plan": "Tarifa Fija",
  "consumption": 3500,
  "CUPS": "ES0021000000000001JN0F",
  "pot1": 5.75,
  "pot2": 0,
  "pot3": 0,
  "pot4": 0,
  "pot5": 0,
  "pot6": 0,
  "description": "Contrato residencial",
  "tramite_id": "TRM-12345"
}]));

// Response
{
  "success": true
}
```

#### Update Contract (PATCH /api/v2/contracts/[id]/contract)
```typescript
// Request Body
{
  "contract": {
    "id": "CNT-12345",
    "consumption": 4000,
    "pot1": 6.25,
    // ... other contract fields
  }
}

// Response
{
  "success": true
}
```

### Signer Operations

#### Update Signer (PATCH /api/v2/contracts/[id]/signer)
```typescript
// Request Body
{
  "signer": {
    "id": "SGN-12345",
    "name": "Jane",
    "last_name": "Smith",
    "email": "jane.smith@newcompany.com",
    "phone": "+34600123457",
    "document_number": "12345678A",
    "cargo": "CTO",
    "client_id": "CLT-12345"
  }
}

// Response
{
  "success": true
}
```

## Deployment Considerations

### Database Migrations
- **No schema changes required**: All endpoints use existing database schema
- **Index maintenance**: No new indexes needed
- **Data integrity**: All existing data remains valid

### Feature Flags
- **Gradual rollout strategy**: 
  1. Deploy new endpoints alongside legacy ones
  2. Test with limited user group
  3. Gradually migrate frontend components
  4. Deprecate legacy endpoints after validation

### Rollback Plan
- **Legacy endpoints preserved**: Old endpoints remain functional during transition
- **Feature toggle**: Can switch between old and new endpoints via configuration
- **Zero downtime**: Migration can be performed without service interruption

## Testing Strategy

### Validation Testing
- **Schema validation**: Test all Zod schemas with valid/invalid data
- **Edge cases**: Empty strings, null values, malformed data
- **Type coercion**: Ensure proper handling of different input types

### Integration Testing
- **Database operations**: Verify all CRUD operations work correctly
- **Error scenarios**: Test database connection failures, invalid IDs
- **Business logic**: Verify signer handling for business entities

### Performance Testing
- **Load testing**: Verify performance under expected traffic
- **Memory testing**: Check for memory leaks during extended use
- **Validation overhead**: Measure impact of additional validation

## Monitoring and Observability

### Key Metrics to Track
1. **Response times**: Compare new vs legacy endpoint performance
2. **Error rates**: Monitor validation vs database error ratios
3. **Usage patterns**: Track adoption of new endpoints
4. **Data quality**: Monitor validation failure reasons

### Alerts
- **High error rates**: Alert when validation errors exceed 5%
- **Performance degradation**: Alert when response times increase >20%
- **Database connection issues**: Alert on connection failures

## Support and Documentation

### Developer Resources
- **API documentation**: Updated OpenAPI/Swagger specs
- **Code examples**: TypeScript examples for common operations
- **Migration checklist**: Step-by-step frontend migration guide

### Troubleshooting
- **Common validation errors**: Guide for fixing typical validation failures
- **Type compatibility**: How to handle TypeScript type mismatches
- **Error messages**: Mapping of error codes to solutions
