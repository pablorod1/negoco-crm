# 🔄 TICKET SYSTEM INTEGRATION GUIDE

## 📋 REPLACING NOTES WITH TICKETS

This guide shows how to replace the existing `NotesTabContent` component with the new `TicketTabContent` component in your CRM application.

## 🎯 INTEGRATION STEPS

### Step 1: Import the New Component

Replace the old notes import:
```tsx
// OLD - Remove this
import { TramiteNotesSection } from "@/tramites/components/editTramite/notes/NotesTabContent";

// NEW - Add this
import TicketTabContent from "@/tramites/components/editTramite/tickets/TicketTabContent";
```

### Step 2: Update Component Usage

Replace the notes section in your tab component:

```tsx
// OLD - Replace this
<TramiteNotesSection
  notes={tramite.notes}
  onDeletedNote={handleRefresh}
  onAddNote={handleRefresh}
  tramite_id={tramite.id}
  userData={userData}
  client={client}
  internalNotes={tramite.internal_notes}
/>

// NEW - Use this instead
<TicketTabContent
  context="tramite"
  refId={parseInt(tramite.id)}
  userData={userData}
  onRefresh={handleRefresh}
/>
```

### Step 3: Context-Specific Integration

For different contexts, update the `context` prop:

#### Tramites
```tsx
<TicketTabContent
  context="tramite"
  refId={parseInt(tramite.id)}
  userData={userData}
  onRefresh={handleRefresh}
/>
```

#### Fotovoltaica
```tsx
<TicketTabContent
  context="fotovoltaica"
  refId={parseInt(fotovoltaica.id)}
  userData={userData}
  onRefresh={handleRefresh}
/>
```

#### Comparativas
```tsx
<TicketTabContent
  context="comparativa"
  refId={parseInt(comparativa.id)}
  userData={userData}
  onRefresh={handleRefresh}
/>
```

#### Clients
```tsx
<TicketTabContent
  context="cliente"
  refId={parseInt(client.id)}
  userData={userData}
  onRefresh={handleRefresh}
/>
```

## 🔧 COMPONENT INTERFACE

### Props Reference

```typescript
interface TicketTabContentProps {
  context: "tramite" | "cliente" | "fotovoltaica" | "comparativa";
  refId: number;
  userData: User;
  onRefresh?: () => void;
}
```

### Required Props
- **context**: The type of entity the tickets are associated with
- **refId**: The ID of the specific entity (convert string to number if needed)
- **userData**: Current user session data

### Optional Props
- **onRefresh**: Callback function called when tickets are created/updated/deleted

## 🎨 UI DIFFERENCES

### Before (Notes)
- Simple text-based notes
- Basic add/delete functionality
- Internal vs public notes separation
- Post-it style display

### After (Tickets)
- Rich ticket cards with status and priority
- Full CRUD operations
- Reply/conversation system
- Advanced filtering and search
- Role-based visibility

## 📊 MIGRATION BENEFITS

### Enhanced Functionality
- **Status Tracking**: Track ticket lifecycle from creation to closure
- **Priority Management**: Assign and filter by priority levels
- **Conversation Threads**: Rich reply system for better communication
- **Type Categorization**: Organize tickets by type (consulta, incidencia, etc.)

### Improved User Experience
- **Visual Status Indicators**: Color-coded badges for status and priority
- **Expandable Content**: Click to expand ticket details
- **Inline Actions**: Edit, delete, and reply directly from the list
- **Advanced Filtering**: Filter by status, show/hide internal tickets

### Better Data Organization
- **Structured Data**: Tickets have defined schema with relationships
- **Audit Trail**: Full conversation history and status changes
- **Role-Based Access**: Automatic filtering based on user permissions

## ⚡ QUICK MIGRATION EXAMPLE

### Complete Before/After Example

```tsx
// BEFORE - Old notes implementation
import { TramiteNotesSection } from "@/tramites/components/editTramite/notes/NotesTabContent";

export function TramiteDetailsTab({ tramite, userData, onRefresh }) {
  return (
    <div className="space-y-6">
      {/* Other components */}
      
      <TramiteNotesSection
        notes={tramite.notes}
        onDeletedNote={onRefresh}
        onAddNote={onRefresh}
        tramite_id={tramite.id}
        userData={userData}
        client={client}
        internalNotes={tramite.internal_notes}
      />
    </div>
  );
}

// AFTER - New ticket implementation
import TicketTabContent from "@/tramites/components/editTramite/tickets/TicketTabContent";

export function TramiteDetailsTab({ tramite, userData, onRefresh }) {
  return (
    <div className="space-y-6">
      {/* Other components */}
      
      <TicketTabContent
        context="tramite"
        refId={parseInt(tramite.id)}
        userData={userData}
        onRefresh={onRefresh}
      />
    </div>
  );
}
```

## 🚀 DEPLOYMENT CHECKLIST

### Pre-Migration
- [ ] Run database seeding script: `bun run seed:tickets`
- [ ] Verify API endpoints are working
- [ ] Test with different user roles

### Migration
- [ ] Update import statements
- [ ] Replace component usage
- [ ] Update prop mapping
- [ ] Test functionality

### Post-Migration
- [ ] Verify tickets display correctly
- [ ] Test ticket creation
- [ ] Test reply functionality
- [ ] Verify role-based access
- [ ] Clean up old notes components (optional)

## 🔍 TROUBLESHOOTING

### Common Issues

#### "Cannot find module CreateTicketDialog"
**Solution**: Ensure the ticket components are properly built:
```bash
bun run build
```

#### "Ticket types not loading"
**Solution**: Verify the ticket types endpoint and database seeding:
```bash
curl http://localhost:3000/api/v2/tickets/types
bun run seed:tickets
```

#### "Permission denied" errors
**Solution**: Check user session and role validation:
- Verify `userData.role` is correctly set
- Check session authentication

## 📞 SUPPORT

If you encounter issues during migration:

1. **Check the console** for any JavaScript errors
2. **Verify API responses** using browser dev tools
3. **Test with different user roles** to ensure permissions work
4. **Review the completion report** for detailed implementation details

## 🎉 SUCCESS VALIDATION

After migration, verify these features work:

- ✅ **Ticket Creation**: Users can create new tickets
- ✅ **Status Updates**: Authorized users can change ticket status
- ✅ **Reply System**: Users can add replies to tickets
- ✅ **Role Filtering**: Comercial users don't see internal tickets
- ✅ **Context Association**: Tickets are properly linked to the entity

The migration is complete when all these features work correctly! 🚀
