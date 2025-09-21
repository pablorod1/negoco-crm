# Comprehensive Energy Suppliers Integration Testing Strategy

## Overview
This document outlines the systematic testing approach for validating the complete comercializadoras (energy suppliers) integration system. This testing strategy ensures all components work seamlessly together and validates the migration from hardcoded supplier lists to API-driven dynamic data.

## Testing Categories

### 1. API Endpoint Testing

#### 1.1 Energy Suppliers Active Endpoint
**Endpoint**: `/api/v2/energy-suppliers/active`
- **GET Testing**:
  - ✅ Verify returns only active suppliers
  - ✅ Check response structure matches ComercializadoraVM type
  - ✅ Validate caching headers are set appropriately
  - ✅ Test performance with large datasets
  - ✅ Verify error handling for database connection issues

- **POST Testing**:
  - ✅ Test adding new active suppliers
  - ✅ Validate request body validation with Zod schemas
  - ✅ Test duplicate name handling
  - ✅ Verify transaction rollback on errors

#### 1.2 Energy Supplier By ID Endpoint
**Endpoint**: `/api/v2/energy-suppliers/[id]`
- **GET Testing**:
  - ✅ Test valid ID returns correct supplier
  - ✅ Test invalid ID returns 404
  - ✅ Test non-numeric ID validation
  - ✅ Verify caching headers
  - ✅ Test performance with concurrent requests

- **PUT Testing**:
  - ✅ Test supplier status updates
  - ✅ Test supplier information updates
  - ✅ Validate authorization requirements
  - ✅ Test optimistic locking scenarios

### 2. React Component Testing

#### 2.1 Custom Hooks Testing
**Hook**: `useActiveEnergySuppliers`
- ✅ Test successful data fetching
- ✅ Test loading states
- ✅ Test error handling and toast notifications
- ✅ Test caching behavior
- ✅ Test refetch functionality

**Hook**: `useEnergySupplierById`
- ✅ Test single supplier resolution
- ✅ Test batch supplier resolution
- ✅ Test invalid ID handling
- ✅ Test memoization of results

#### 2.2 Form Component Testing
**Component**: `ContractForm.tsx`
- ✅ Test dynamic supplier loading
- ✅ Test fallback to loading state
- ✅ Test error state handling
- ✅ Test form submission with selected supplier
- ✅ Test accessibility compliance

**Component**: `EditContractForm.tsx`
- ✅ Test existing supplier pre-selection
- ✅ Test supplier change scenarios
- ✅ Test validation with empty supplier selection
- ✅ Test update functionality

#### 2.3 Modal Component Testing
**Component**: `CompletarEstudioModal.tsx`
- ✅ Test supplier selection integration
- ✅ Test modal workflow completion
- ✅ Test comparison conversion to contract
- ✅ Test error scenarios during completion

### 3. Data Flow Validation

#### 3.1 Comparison Flow Testing
- ✅ Create comparison with hardcoded supplier (legacy support)
- ✅ Complete comparison with new supplier selection
- ✅ Convert comparison to contract with supplier ID
- ✅ Verify supplier name resolution in detail view
- ✅ Test comparison editing maintains supplier data

#### 3.2 Contract Flow Testing
- ✅ Create contract with supplier ID
- ✅ Create contract with legacy supplier string
- ✅ Edit existing contract supplier information
- ✅ Test contract renewal preserves supplier data
- ✅ Verify contract analytics include supplier metrics

### 4. Database Integration Testing

#### 4.1 Query Performance Testing
- ✅ Test active suppliers query performance
- ✅ Test supplier by ID lookup performance
- ✅ Test JOIN queries with comparisons/contracts
- ✅ Validate index utilization
- ✅ Test concurrent access scenarios

#### 4.2 Data Consistency Testing
- ✅ Test foreign key constraint enforcement
- ✅ Test supplier deactivation impact
- ✅ Test data migration scenarios
- ✅ Verify transaction isolation

### 5. Performance Testing

#### 5.1 API Response Times
- ✅ Target: < 100ms for supplier list endpoint
- ✅ Target: < 50ms for supplier by ID endpoint
- ✅ Test with varying database sizes
- ✅ Test under concurrent load

#### 5.2 Frontend Performance
- ✅ Test component rendering performance
- ✅ Test hook memoization effectiveness
- ✅ Test bundle size impact
- ✅ Test memory usage patterns

### 6. End-to-End Integration Testing

#### 6.1 User Journey Testing
1. **New Comparison Creation**:
   - Navigate to comparisons page
   - Create new comparison
   - Complete comparison with supplier selection
   - Verify supplier appears in detail view
   - Convert to contract
   - Verify contract maintains supplier data

2. **Contract Management**:
   - Create new contract with supplier
   - Edit existing contract supplier
   - View contract details with supplier name
   - Generate contract reports

3. **Analytics Integration**:
   - View supplier performance metrics
   - Generate supplier-based reports
   - Test filtering by supplier

#### 6.2 Error Recovery Testing
- ✅ Test API timeout handling
- ✅ Test network failure recovery
- ✅ Test invalid data handling
- ✅ Test partial data scenarios

## Testing Tools and Framework

### API Testing
- **Tool**: Postman/Insomnia for manual testing
- **Automation**: Jest with supertest for automated API tests
- **Performance**: Artillery for load testing

### Component Testing
- **Tool**: React Testing Library with Jest
- **Integration**: Cypress for E2E testing
- **Performance**: Lighthouse for performance audits

### Database Testing
- **Tool**: Turso CLI for query analysis
- **Performance**: EXPLAIN QUERY PLAN for optimization
- **Monitoring**: Custom performance logging

## Test Data Requirements

### Database Setup
```sql
-- Test comercializadoras data
INSERT INTO comercializadoras (name, active, logo) VALUES 
('Test Supplier 1', true, 'logo1.png'),
('Test Supplier 2', true, 'logo2.png'),
('Inactive Supplier', false, 'logo3.png');

-- Test comparativas with supplier IDs
INSERT INTO comparativas (comercializadora_id, comercializadora, status) VALUES
(1, NULL, 'pending'),
(2, NULL, 'completed'),
(NULL, 'Legacy Supplier', 'in_progress');
```

### Mock Data
- Active suppliers list (10+ entries)
- Inactive suppliers for filtering tests
- Legacy comparisons with string suppliers
- New comparisons with ID suppliers

## Success Criteria

### Functional Requirements
✅ All API endpoints return correct data structures
✅ Form components load suppliers dynamically
✅ Detail views resolve supplier names correctly
✅ Legacy data continues to work
✅ New data uses ID-based relationships

### Performance Requirements
✅ API response times under specified targets
✅ Frontend components render within 500ms
✅ Database queries utilize indexes effectively
✅ No memory leaks in long-running sessions

### User Experience Requirements
✅ Smooth transitions between old and new data
✅ Clear error messages for failure scenarios
✅ Accessible supplier selection interfaces
✅ Consistent data presentation across views

## Testing Schedule

### Phase 1: Unit Testing (Estimated: 2-3 hours)
- API endpoint testing
- React hook testing
- Component isolation testing

### Phase 2: Integration Testing (Estimated: 2-3 hours)
- Component interaction testing
- Data flow validation
- Database integration testing

### Phase 3: Performance Testing (Estimated: 1-2 hours)
- Load testing API endpoints
- Frontend performance profiling
- Database query optimization validation

### Phase 4: End-to-End Testing (Estimated: 2-3 hours)
- Complete user journey testing
- Error scenario testing
- Cross-browser compatibility

## Risk Assessment

### High Risk Areas
1. **Data Migration**: Ensuring legacy string-based data continues to work
2. **Performance**: API response times under load
3. **Caching**: Proper cache invalidation strategies

### Mitigation Strategies
1. **Gradual Migration**: Support both old and new data formats
2. **Performance Monitoring**: Real-time API response tracking
3. **Cache Strategy**: Conservative TTL with manual invalidation options

## Test Execution Log

### Automated Tests
- [ ] API endpoint tests (Jest/Supertest)
- [ ] React component tests (RTL/Jest)
- [ ] Database query tests (Turso/Jest)

### Manual Tests
- [ ] End-to-end user journeys
- [ ] Cross-browser compatibility
- [ ] Accessibility compliance

### Performance Tests
- [ ] API load testing (Artillery)
- [ ] Frontend performance (Lighthouse)
- [ ] Database performance (Query analysis)

## Documentation Updates Required

1. **API Documentation**: Update endpoint specifications
2. **Component Documentation**: Update prop interfaces
3. **Migration Guide**: Document transition process
4. **Performance Guide**: Document optimization strategies

---

**Testing Contact**: Development Team
**Last Updated**: December 2024
**Next Review**: After implementation completion
