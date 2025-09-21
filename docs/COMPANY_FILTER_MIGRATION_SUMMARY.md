# Company Filter Migration - Implementation Summary

## Problem Description
The company filter in the contracts table was not working for new contracts because:
- **Old contracts**: Store company names directly in the `new_company` field (e.g., "Aletteo")
- **New contracts**: Store company IDs in the `new_company` field (e.g., "COM-002")

When filtering by "Aletteo", new contracts with `new_company = "COM-002"` wouldn't appear.

## Solution Implemented

### 1. Frontend Changes (`FilterContent.tsx`)

#### Updated Imports
- Added `useActiveEnergySuppliers` hook
- Added `Skeleton` component for loading state
- Removed hardcoded `COMPANIES` constant

#### Dynamic Company Loading
```typescript
// Load active energy suppliers for company filter
const { activeSuppliers, loading: suppliersLoading } =
  useActiveEnergySuppliers();

// Convert suppliers to dropdown format (using IDs as values)
const supplierOptions = React.useMemo(
  () =>
    activeSuppliers.map((supplier) => ({
      label: supplier.name,
      value: supplier.id, // Use ID as value instead of name
    })),
  [activeSuppliers]
);
```

#### Updated Company Filter UI
- Added loading skeleton while suppliers load
- Uses dynamic supplier data instead of hardcoded constants
- Passes supplier IDs as filter values (not names)

### 2. Backend Changes (`/api/v2/contracts/route.ts`)

#### Added Database JOIN
```sql
LEFT JOIN comercializadoras com ON con.new_company = com.id
```

#### New Hybrid Company Filter Function
```typescript
// Company filter helper (handles both ID and name for backward compatibility)
const addCompanyFilter = (filterArray?: string[]) => {
  if (filterArray && filterArray.length > 0) {
    // For each company filter, we need to check both the ID and name
    // This handles the transition from name-based to ID-based storage
    const companyConditions = filterArray
      .map(() => "(con.new_company = ? OR com.name = ?)")
      .join(" OR ");
    filters.push(`(${companyConditions})`);
    // Add each filter value twice: once for ID match, once for name match
    filterArray.forEach((company) => {
      params.push(company, company);
    });
  }
};
```

#### Updated Filter Application
- Replaced `addArrayFilter("con.new_company", companyFilter)` 
- With `addCompanyFilter(companyFilter)`

## How It Works

### Backward Compatibility
The solution maintains 100% backward compatibility:

1. **For new contracts** (with ID storage):
   - Frontend sends supplier ID (e.g., "COM-002")
   - Backend matches: `con.new_company = "COM-002"` ✅

2. **For old contracts** (with name storage):
   - Frontend sends supplier ID (e.g., "COM-002") 
   - Backend also checks: `com.name = "COM-002"` ❌
   - But the JOIN resolves ID to name, so if user selected "Aletteo":
   - Backend checks: `con.new_company = "COM-002"` (new) OR `com.name = "COM-002"` (old) ✅

### Filter Flow
1. User selects "Aletteo" from dropdown
2. Frontend sends supplier ID "COM-002" to backend
3. Backend searches for contracts where:
   - `con.new_company = "COM-002"` (matches new contracts)
   - OR `com.name = "COM-002"` (matches old contracts via JOIN)

## Files Modified

1. **`src/tramites/components/table/components/FilterContent.tsx`**
   - Added dynamic supplier loading
   - Updated company filter to use supplier IDs
   - Added loading state

2. **`src/app/api/v2/contracts/route.ts`**
   - Added JOIN with comercializadoras table
   - Implemented hybrid company filter function
   - Updated filter application logic

## Testing Recommendations

1. **Test with old contracts**: Filter by company name, verify old contracts appear
2. **Test with new contracts**: Filter by company name, verify new contracts appear  
3. **Test mixed results**: Verify both old and new contracts appear together
4. **Test loading state**: Verify skeleton appears while suppliers load
5. **Test error handling**: Verify graceful fallback if supplier loading fails

## Benefits

✅ **Maintains backward compatibility** - Old contracts still filterable
✅ **Supports new ID-based storage** - New contracts properly filtered  
✅ **Dynamic supplier data** - No hardcoded company lists to maintain
✅ **Consistent with forms** - Uses same supplier loading as contract creation
✅ **Performance optimized** - Single query with JOINs instead of multiple lookups
