# 📝 NOTIFICATIONS ENDPOINT MIGRATION GUIDE

## 🎯 Overview

This guide provides step-by-step instructions for migrating from the legacy notification endpoints to the new RESTful API structure. All new endpoints maintain backward compatibility while providing enhanced performance and type safety.

## 🔄 Endpoint Migration Map

### Summary Table
| Legacy Endpoint | New Endpoint | Method | Migration Required |
|----------------|--------------|---------|-------------------|
| `POST /api/notifications/create` | `POST /new_api/notifications` | POST | ✅ Direct replacement |
| `POST /api/notifications/get/notifications` | `GET /new_api/notifications` | GET | ⚠️ Method + params change |
| `POST /api/notifications/delete/[id]` | `DELETE /new_api/notifications/[id]` | DELETE | ⚠️ Method change |
| `POST /api/notifications/delete/all` | `DELETE /new_api/notifications` | DELETE | ⚠️ Method change |

## 📋 Detailed Migration Instructions

### 1. Create Notification Endpoint

#### ✅ BEFORE (Legacy)
```typescript
// Route: POST /api/notifications/create
const createNotification = async (notification: Notification) => {
  const response = await fetch('/api/notifications/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ notification }),
  });
  return response.json();
};
```

#### ✅ AFTER (New - Direct Replacement)
```typescript
// Route: POST /new_api/notifications
const createNotification = async (notification: Notification) => {
  const response = await fetch('/new_api/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ notification }),
  });
  return response.json();
};
```

**Migration Steps:**
1. Update the URL from `/api/notifications/create` to `/new_api/notifications`
2. No other changes required - request/response format identical

---

### 2. Get Notifications Endpoint

#### ⚠️ BEFORE (Legacy)
```typescript
// Route: POST /api/notifications/get/notifications
const getNotifications = async (userId: string) => {
  const response = await fetch('/api/notifications/get/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: userId }),
  });
  return response.json();
};
```

#### ✅ AFTER (New - Method & Parameters Updated)
```typescript
// Route: GET /new_api/notifications
const getNotifications = async (userId: string) => {
  const response = await fetch(`/new_api/notifications?user_id=${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return response.json();
};
```

**Migration Steps:**
1. Change method from `POST` to `GET`
2. Change URL from `/api/notifications/get/notifications` to `/new_api/notifications`
3. Move `id` parameter from request body to query parameter `user_id`
4. Remove body from the request
5. Response format remains identical

---

### 3. Delete Single Notification Endpoint

#### ⚠️ BEFORE (Legacy)
```typescript
// Route: POST /api/notifications/delete/[id]
const deleteNotification = async (id: string) => {
  const response = await fetch(`/api/notifications/delete/${id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return response.json();
};
```

#### ✅ AFTER (New - Method Updated)
```typescript
// Route: DELETE /new_api/notifications/[id]
const deleteNotification = async (id: string) => {
  const response = await fetch(`/new_api/notifications/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return response.json();
};
```

**Migration Steps:**
1. Change method from `POST` to `DELETE`
2. Change URL from `/api/notifications/delete/${id}` to `/new_api/notifications/${id}`
3. No request body changes required
4. Response format remains identical

---

### 4. Delete All Notifications Endpoint

#### ⚠️ BEFORE (Legacy)
```typescript
// Route: POST /api/notifications/delete/all
const deleteAllNotifications = async (ids: string[]) => {
  const response = await fetch('/api/notifications/delete/all', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
  });
  return response.json();
};
```

#### ✅ AFTER (New - Method Updated)
```typescript
// Route: DELETE /new_api/notifications
const deleteAllNotifications = async (ids: string[]) => {
  const response = await fetch('/new_api/notifications', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
  });
  return response.json();
};
```

**Migration Steps:**
1. Change method from `POST` to `DELETE`
2. Change URL from `/api/notifications/delete/all` to `/new_api/notifications`
3. Request body format remains identical
4. Response format remains identical

## 🔧 Component Update Examples

### React Component Migration Example

#### BEFORE (Legacy Implementation)
```typescript
// File: src/components/NotificationsMenu.tsx
export default function NotificationsMenu() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications/get/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userData.id }),
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/delete/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        fetchNotifications();
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleDeleteAll = async (ids: string[]) => {
    try {
      const res = await fetch('/api/notifications/delete/all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (data.success) {
        fetchNotifications();
      }
    } catch (error) {
      console.error('Error deleting notifications:', error);
    }
  };

  return (
    // JSX implementation
  );
}
```

#### AFTER (New Implementation)
```typescript
// File: src/components/NotificationsMenu.tsx  
export default function NotificationsMenu() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`/new_api/notifications?user_id=${encodeURIComponent(userData.id)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      const res = await fetch(`/new_api/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        fetchNotifications();
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleDeleteAll = async (ids: string[]) => {
    try {
      const res = await fetch('/new_api/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (data.success) {
        fetchNotifications();
      }
    } catch (error) {
      console.error('Error deleting notifications:', error);
    }
  };

  return (
    // JSX implementation (unchanged)
  );
}
```

## 🛠️ API Client/Service Layer Updates

### Service Layer Migration
```typescript
// File: src/services/notificationsService.ts

class NotificationsService {
  private baseUrl = '/new_api/notifications';

  async create(notification: Notification) {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notification }),
    });
    return response.json();
  }

  async getByUserId(userId: string) {
    const response = await fetch(`${this.baseUrl}?user_id=${encodeURIComponent(userId)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
  }

  async deleteById(id: string) {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
  }

  async deleteMultiple(ids: string[]) {
    const response = await fetch(this.baseUrl, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    return response.json();
  }
}

export const notificationsService = new NotificationsService();
```

## 🧪 Testing Updates

### Test Suite Migration
```typescript
// File: src/__tests__/notifications.test.ts

describe('Notifications API', () => {
  describe('GET /new_api/notifications', () => {
    it('should fetch notifications with query parameter', async () => {
      const userId = 'user123';
      const response = await fetch(`/new_api/notifications?user_id=${userId}`, {
        method: 'GET'
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('DELETE /new_api/notifications/[id]', () => {
    it('should delete single notification', async () => {
      const notificationId = 'notif123';
      const response = await fetch(`/new_api/notifications/${notificationId}`, {
        method: 'DELETE'
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });
});
```

## ⚡ Performance Optimizations

### Benefits of New Implementation
1. **RESTful Design**: Proper HTTP methods for better caching and semantics
2. **Query Parameters**: More efficient for GET requests (cacheable)
3. **Type Safety**: Enhanced validation with Zod schemas
4. **Better Error Handling**: More descriptive error messages

### Recommended Optimizations
```typescript
// Add request/response interceptors for better error handling
const apiClient = {
  async request(url: string, options: RequestInit = {}) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }
};
```

## 🚀 Deployment Strategy

### Gradual Migration Approach
1. **Phase 1**: Deploy new endpoints alongside legacy ones
2. **Phase 2**: Update frontend components one by one
3. **Phase 3**: Monitor performance and error rates
4. **Phase 4**: Deprecate legacy endpoints after full migration

### Rollback Plan
If issues arise, you can immediately revert to legacy endpoints by changing URLs back to the original format.

## ✅ Migration Checklist

### For Each Component Using Notifications:
- [ ] Update GET requests from POST to GET with query parameters
- [ ] Update DELETE requests to use proper HTTP DELETE method
- [ ] Update URL paths from `/api/notifications/*` to `/new_api/notifications/*`
- [ ] Test functionality in development environment
- [ ] Update any hardcoded endpoint references
- [ ] Update API documentation/comments

### Global Updates:
- [ ] Update service layer/API client
- [ ] Update test suites
- [ ] Update error handling for new error message formats
- [ ] Update TypeScript types if needed
- [ ] Performance testing with new endpoints

## 🆘 Troubleshooting

### Common Issues and Solutions

#### Issue: "user_id parameter missing" 
**Solution**: Ensure query parameter is properly encoded:
```typescript
const url = `/new_api/notifications?user_id=${encodeURIComponent(userId)}`;
```

#### Issue: CORS errors with new endpoints
**Solution**: Verify CORS configuration includes `/new_api/*` paths

#### Issue: TypeScript type errors
**Solution**: All response types remain identical, ensure proper type imports

## 📞 Support

For questions or issues during migration:
1. Check this migration guide
2. Review the optimization report: `NOTIFICATIONS_REFACTORING_OPTIMIZATION_REPORT.md`
3. Check API mapping documentation: `API_MAPPING_DOCUMENTATION.md`

**Migration Completion**: Update this checklist when migration is complete.

---
**Document Version**: 1.0  
**Last Updated**: January 21, 2025  
**Migration Status**: Ready for Implementation
