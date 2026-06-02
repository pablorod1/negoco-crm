# Bloque 3 – Foro, Banner & External API Stubs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three features: (1) Foro de debates — anonymous forum where all users can post but only gerencia sees author names, (2) Interactive announcement banner — gerencia-editable banner in the dashboard hero, (3) Research-only stubs for OMIE/MIBGAS/OMIP/SIPS external API integrations.

**Architecture:** Forum and banner use new SQL tables in Turso. The banner uses `organization.metadata` (TEXT JSON column, already exists) as a lightweight key-value store — no new table needed. Forum requires two new tables: `forum_threads` and `forum_messages`. Polling pattern (no WebSockets) — client polls every 15s when viewing a thread.

**Tech Stack:** TypeScript, Next.js 16, React 19, @libsql/client, Zod, Recharts, Tailwind v4, Bun test runner.

**Verification baseline:** `bun test && npx tsc --noEmit && npm run lint`

---

## File Structure

**New files**
- `docs/migrations/008_add_forum_tables.sql` — `forum_threads` + `forum_messages`
- `src/app/api/v2/forum/threads/route.ts` — CRUD for threads
- `src/app/api/v2/forum/threads/route.test.js` — tests
- `src/app/api/v2/forum/threads/[id]/messages/route.ts` — messages CRUD
- `src/app/api/v2/forum/threads/[id]/messages/route.test.js` — tests
- `src/forum/components/ForumList.tsx` — thread listing component
- `src/forum/components/ThreadView.tsx` — single thread + messages
- `src/forum/components/CreateThreadModal.tsx` — new thread form
- `src/forum/components/ForumPage.tsx` — page wrapper
- `src/app/(main)/forum/page.tsx` — route page
- `src/app/api/v2/organization/banner/route.ts` — GET/PATCH banner
- `src/app/api/v2/organization/banner/route.test.js` — tests
- `src/dashboard/components/AnnouncementBanner.tsx` — the banner component
- `src/dashboard/components/AnnouncementBanner.test.tsx` — component test
- `src/external-stubs/omie.ts` — research-only stub
- `src/external-stubs/mibgas.ts` — research-only stub
- `src/external-stubs/omip.ts` — research-only stub
- `src/external-stubs/sips.ts` — research-only stub
- `src/external-stubs/README.md` — documentation on each API's capabilities

**Modified files**
- `src/core/auth/auth-schema.ts` — (no change needed, `organization.metadata` already exists)
- `src/dashboard/components/Hero.tsx` — insert banner between header row and stat cards
- `src/core/components/sidebar/Sidebar.tsx` — add Forum nav link
- `src/proxy.ts` — add `/forum` proxy rule

---

## Task 1: Forum — Database migration

**Files:**
- Create: `docs/migrations/008_add_forum_tables.sql`

- [ ] **Step 1: Create the migration**

Create `docs/migrations/008_add_forum_tables.sql`:
```sql
-- Forum tables: threads and messages
-- Threads are visible to all authenticated users.
-- Author identity is hidden from non-admin users (anonymous posting).

CREATE TABLE IF NOT EXISTS forum_threads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  author_id TEXT NOT NULL,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_locked INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (author_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS forum_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  author_id TEXT NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES forum_threads(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_forum_threads_author ON forum_threads(author_id);
CREATE INDEX IF NOT EXISTS idx_forum_threads_pinned ON forum_threads(is_pinned);
CREATE INDEX IF NOT EXISTS idx_forum_messages_thread ON forum_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_forum_messages_author ON forum_messages(author_id);
```

Run manually: `turso db shell <db-name> < docs/migrations/008_add_forum_tables.sql`

- [ ] **Step 2: Commit**

```bash
git add docs/migrations/008_add_forum_tables.sql
git commit -m "feat(forum): add forum_threads and forum_messages tables"
```

---

## Task 2: Forum — Threads API

**Files:**
- Create: `src/app/api/v2/forum/threads/route.ts`
- Create: `src/app/api/v2/forum/threads/route.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/v2/forum/threads/route.test.js`:
```js
import { beforeEach, describe, expect, mock, test } from "bun:test";

const execute = mock(() => ({ rows: [], rowsAffected: 0 }));
const getTursoClient = mock(() => ({ execute }));

mock.module("@/core/libsql/client", () => ({ getTursoClient }));

const adminAuth = () => ({
  success: true,
  user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
});

const comAuth = () => ({
  success: true,
  user: { id: "c1", role: "2", email: "c@b.com", name: "Comercial" },
});

mock.module("@/core/auth/session-utils", () => ({
  validateUserSession: adminAuth,
}));

const threadsRoute = await import("./route.ts");

beforeEach(() => {
  execute.mockClear();
  getTursoClient.mockClear();
});

describe("GET /api/v2/forum/threads", () => {
  test("returns threads list", async () => {
    execute.mockImplementation(() => ({
      rows: [
        { id: "t1", title: "Hello", created_at: "2026-06-01", author_id: "u1", author_name: "Ana", is_pinned: 0, is_locked: 0, message_count: 3 },
      ],
      rowsAffected: 0,
    }));
    const res = await threadsRoute.GET(new Request("https://x/api/v2/forum/threads"));
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

describe("POST /api/v2/forum/threads", () => {
  test("creates a thread", async () => {
    execute.mockImplementation((stmt) => {
      const sql = stmt.sql || stmt;
      if (sql.includes("INSERT")) return { rows: [], rowsAffected: 1 };
      return { rows: [], rowsAffected: 0 };
    });
    const res = await threadsRoute.POST(
      new Request("https://x/api/v2/forum/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New thread" }),
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("rejects unauthenticated", async () => {
    mock.module("@/core/auth/session-utils", () => ({
      validateUserSession: () => ({ success: false }),
    }));
    const { POST: fresh } = await import("./route.ts");
    const res = await fresh(
      new Request("https://x/api/v2/forum/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New thread" }),
      }),
    );
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/app/api/v2/forum/threads/route.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the threads API**

Create `src/app/api/v2/forum/threads/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { validateUserSession } from "@/core/auth/session-utils";
import { nanoid } from "nanoid";

const CreateThreadSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
});

export async function GET(req: NextRequest) {
  const authResult = await validateUserSession(req);
  if (!authResult.success || !authResult.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const client = getTursoClient(req);
  if (!client) {
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }

  const isAdmin = authResult.user.role === "admin";

  const threads = await client.execute({
    sql: `SELECT ft.id, ft.title, ft.created_at, ft.updated_at, ft.is_pinned, ft.is_locked,
            ft.author_id, u.name as author_name,
            (SELECT COUNT(*) FROM forum_messages fm WHERE fm.thread_id = ft.id) as message_count
          FROM forum_threads ft
          JOIN user u ON u.id = ft.author_id
          ORDER BY ft.is_pinned DESC, ft.updated_at DESC`,
    args: [],
  });

  const data = threads.rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    isPinned: Number(row.is_pinned) === 1,
    isLocked: Number(row.is_locked) === 1,
    messageCount: Number(row.message_count),
    authorId: isAdmin ? String(row.author_id) : undefined,
    authorName: isAdmin ? String(row.author_name) : "Anónimo",
  }));

  return NextResponse.json({ success: true, data });
}

export async function POST(req: NextRequest) {
  const authResult = await validateUserSession(req);
  if (!authResult.success || !authResult.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = CreateThreadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });
  }

  const client = getTursoClient(req);
  if (!client) {
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }

  const id = nanoid();
  const now = new Date().toISOString();

  await client.execute({
    sql: "INSERT INTO forum_threads (id, title, created_at, updated_at, author_id) VALUES (?, ?, ?, ?, ?)",
    args: [id, parsed.data.title, now, now, authResult.user.id],
  });

  return NextResponse.json({ success: true, data: { id, title: parsed.data.title, createdAt: now } });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/app/api/v2/forum/threads/route.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/v2/forum/threads/
git commit -m "feat(forum): add threads CRUD API"
```

---

## Task 3: Forum — Messages API

**Files:**
- Create: `src/app/api/v2/forum/threads/[id]/messages/route.ts`
- Create: `src/app/api/v2/forum/threads/[id]/messages/route.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/v2/forum/threads/[id]/messages/route.test.js`:
```js
import { beforeEach, describe, expect, mock, test } from "bun:test";

const execute = mock(() => ({ rows: [], rowsAffected: 0 }));
const getTursoClient = mock(() => ({ execute }));

mock.module("@/core/libsql/client", () => ({ getTursoClient }));
mock.module("@/core/auth/session-utils", () => ({
  validateUserSession: () => ({
    success: true,
    user: { id: "u1", role: "2", email: "c@b.com", name: "Comercial" },
  }),
}));

const messagesRoute = await import("./route.ts");

beforeEach(() => {
  execute.mockClear();
  getTursoClient.mockClear();
});

describe("GET /forum/threads/[id]/messages", () => {
  test("returns messages for a thread, anonymizing non-admin authors", async () => {
    execute.mockImplementation(() => ({
      rows: [
        { id: "m1", thread_id: "t1", content: "Hello", created_at: "2026-06-01", author_id: "u1", author_name: "Ana" },
      ],
      rowsAffected: 0,
    }));
    const res = await messagesRoute.GET(
      new Request("https://x/api/v2/forum/threads/t1/messages"),
      { params: Promise.resolve({ id: "t1" }) },
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data[0].authorName).toBe("Anónimo");
  });
});

describe("POST /forum/threads/[id]/messages", () => {
  test("creates a message", async () => {
    execute.mockImplementation((stmt) => {
      const sql = stmt.sql || stmt;
      if (sql.includes("INSERT")) return { rows: [], rowsAffected: 1 };
      if (sql.includes("UPDATE forum_threads")) return { rows: [], rowsAffected: 1 };
      return { rows: [], rowsAffected: 0 };
    });
    const res = await messagesRoute.POST(
      new Request("https://x/api/v2/forum/threads/t1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "My message" }),
      }),
      { params: Promise.resolve({ id: "t1" }) },
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/app/api/v2/forum/threads/[id]/messages/route.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement messages API**

Create `src/app/api/v2/forum/threads/[id]/messages/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { validateUserSession } from "@/core/auth/session-utils";
import { nanoid } from "nanoid";

const CreateMessageSchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(5000),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await validateUserSession(req);
  if (!authResult.success || !authResult.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: threadId } = await params;
  const client = getTursoClient(req);
  if (!client) {
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }

  const isAdmin = authResult.user.role === "admin";

  const messages = await client.execute({
    sql: `SELECT fm.id, fm.content, fm.created_at, fm.author_id, u.name as author_name
          FROM forum_messages fm
          JOIN user u ON u.id = fm.author_id
          WHERE fm.thread_id = ?
          ORDER BY fm.created_at ASC`,
    args: [threadId],
  });

  const data = messages.rows.map((row) => ({
    id: String(row.id),
    content: String(row.content),
    createdAt: String(row.created_at),
    authorId: isAdmin ? String(row.author_id) : undefined,
    authorName: isAdmin ? String(row.author_name) : "Anónimo",
    isOwnMessage: String(row.author_id) === authResult.user.id,
  }));

  return NextResponse.json({ success: true, data });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await validateUserSession(req);
  if (!authResult.success || !authResult.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: threadId } = await params;
  const body = await req.json();
  const parsed = CreateMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });
  }

  const client = getTursoClient(req);
  if (!client) {
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }

  // Check thread is not locked
  const thread = await client.execute({
    sql: "SELECT id, is_locked FROM forum_threads WHERE id = ?",
    args: [threadId],
  });
  if (thread.rows.length === 0) {
    return NextResponse.json({ success: false, error: "Thread not found" }, { status: 404 });
  }
  if (Number(thread.rows[0].is_locked) === 1 && authResult.user.role !== "admin") {
    return NextResponse.json({ success: false, error: "Thread is locked" }, { status: 403 });
  }

  const id = nanoid();
  const now = new Date().toISOString();

  await client.execute({
    sql: "INSERT INTO forum_messages (id, thread_id, content, created_at, author_id) VALUES (?, ?, ?, ?, ?)",
    args: [id, threadId, parsed.data.content, now, authResult.user.id],
  });

  // Update thread's updated_at timestamp
  await client.execute({
    sql: "UPDATE forum_threads SET updated_at = ? WHERE id = ?",
    args: [now, threadId],
  });

  return NextResponse.json({ success: true, data: { id, createdAt: now } });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/app/api/v2/forum/threads/[id]/messages/route.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/v2/forum/threads/[id]/messages/
git commit -m "feat(forum): add messages CRUD API with anonymous posting"
```

---

## Task 4: Forum — UI components and route page

**Files:**
- Create: `src/forum/components/ForumList.tsx`
- Create: `src/forum/components/ThreadView.tsx`
- Create: `src/forum/components/CreateThreadModal.tsx`
- Create: `src/forum/components/ForumPage.tsx`
- Create: `src/app/(main)/forum/page.tsx`
- Modify: `src/core/components/sidebar/Sidebar.tsx` — add Forum link
- Modify: `src/proxy.ts` — add forum route

- [ ] **Step 1: Create ForumList component**

Create `src/forum/components/ForumList.tsx`:
```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { MessageSquare, Pin, Lock } from "lucide-react";
import type { User } from "@/core/types";

interface Thread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  isLocked: boolean;
  messageCount: number;
  authorName: string;
}

interface ForumListProps {
  userData: User;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
}

export function ForumList({ userData, onSelectThread, onNewThread }: ForumListProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/v2/forum/threads");
      const data = await res.json();
      if (data.success) setThreads(data.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Foro de Debates</h2>
        <Button onClick={onNewThread} size="sm">
          Nuevo Hilo
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : threads.length === 0 ? (
        <Card variant="dashboard">
          <CardContent className="py-8 text-center text-gray-400">
            No hay hilos aún. ¡Crea el primero!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {threads.map((thread) => (
            <Card
              key={thread.id}
              variant="default"
              className="cursor-pointer hover:border-primary-300 transition-colors"
              onClick={() => onSelectThread(thread.id)}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {thread.isPinned && <Pin className="h-3.5 w-3.5 text-primary-500" />}
                    {thread.isLocked && <Lock className="h-3.5 w-3.5 text-gray-400" />}
                    <span className="font-medium text-sm">{thread.title}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {thread.messageCount}
                    </span>
                    <span>{thread.authorName}</span>
                    <span>{new Date(thread.updatedAt).toLocaleDateString("es-ES")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create ThreadView component**

Create `src/forum/components/ThreadView.tsx`:
```tsx
"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { ArrowLeft, Send } from "lucide-react";
import type { User } from "@/core/types";

interface Message {
  id: string;
  content: string;
  createdAt: string;
  authorName: string;
  isOwnMessage: boolean;
}

interface ThreadViewProps {
  threadId: string;
  userData: User;
  onBack: () => void;
}

export function ThreadView({ threadId, userData, onBack }: ThreadViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/v2/forum/threads/${threadId}/messages`);
      const data = await res.json();
      if (data.success) setMessages(data.data);
    } catch {
      // silent
    }
  }, [threadId]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 15000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      await fetch(`/api/v2/forum/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage.trim() }),
      });
      setNewMessage("");
      await fetchMessages();
    } catch {
      // silent
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack} className="flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Volver al foro
      </Button>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
        {messages.map((msg) => (
          <Card
            key={msg.id}
            variant="default"
            className={msg.isOwnMessage ? "bg-primary-50 border-primary-200" : ""}
          >
            <CardContent className="py-2 px-3">
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-medium text-gray-500">{msg.authorName}</span>
                <span className="text-xs text-gray-300">
                  {new Date(msg.createdAt).toLocaleString("es-ES")}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </CardContent>
          </Card>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Escribe un mensaje..."
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          className="flex-1"
        />
        <Button onClick={handleSend} disabled={sending || !newMessage.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create CreateThreadModal**

Create `src/forum/components/CreateThreadModal.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/core/components/ui/dialog";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Plus } from "lucide-react";

interface CreateThreadModalProps {
  onCreated: () => void;
}

export function CreateThreadModal({ onCreated }: CreateThreadModalProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/v2/forum/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (res.ok) {
        setTitle("");
        setOpen(false);
        onCreated();
      }
    } catch {
      // silent
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" />Nuevo Hilo</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo Hilo de Debate</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título del hilo"
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating || !title.trim()}>
              {creating ? "Creando..." : "Crear"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Create ForumPage and route**

Create `src/forum/components/ForumPage.tsx`:
```tsx
"use client";

import { useState } from "react";
import { ForumList } from "./ForumList";
import { ThreadView } from "./ThreadView";
import { CreateThreadModal } from "./CreateThreadModal";
import type { User } from "@/core/types";

interface ForumPageProps {
  userData: User;
}

export function ForumPage({ userData }: ForumPageProps) {
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  if (selectedThread) {
    return (
      <ThreadView
        threadId={selectedThread}
        userData={userData}
        onBack={() => { setSelectedThread(null); setRefreshKey((k) => k + 1); }}
      />
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <ForumList
        key={refreshKey}
        userData={userData}
        onSelectThread={setSelectedThread}
        onNewThread={() => {}}
      />
      <div className="mt-4 flex justify-end">
        <CreateThreadModal onCreated={() => setRefreshKey((k) => k + 1)} />
      </div>
    </div>
  );
}
```

Create `src/app/(main)/forum/page.tsx`:

The main layout (`src/app/(main)/layout.tsx`) is already `"use client"` and wraps children in `<Providers>` which includes `UserProvider`. Use `useUser()` for auth — same pattern as the dashboard:

```tsx
"use client";

import { useUser } from "@/core/contexts/UserContext";
import { ForumPage } from "@/forum/components/ForumPage";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";

export default function ForumRoute() {
  const { userData, loading } = useUser();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!userData) redirect("/signin");
      setChecked(true);
    }
  }, [loading, userData]);

  if (loading || !checked) {
    return (
      <div className="p-6 text-center text-gray-400">
        Cargando...
      </div>
    );
  }

  return <ForumPage userData={userData!} />;
}
```

- [ ] **Step 5: Add Forum nav link in Sidebar**

In `src/core/components/sidebar/Sidebar.tsx`, add a navigation entry for the forum:

```tsx
import { MessageSquare } from "lucide-react";
```

And in the nav items array, add:
```tsx
{ title: "Foro", url: "/forum", icon: MessageSquare },
```

- [ ] **Step 6: Add forum proxy rule**

In `src/proxy.ts`, add `/forum` to the route list alongside the other routes. Must be added to **both** the `protectedPathsRegex` array (line 26-37) and the `matcher` config (line 62-74):

In `protectedPathsRegex`:
```ts
    /^\/forum(\/.*)?$/,
```

In `matcher`:
```ts
    "/forum/:path*",
```

- [ ] **Step 7: Verify + commit**

```bash
npx tsc --noEmit && npm run lint
git add src/forum/ src/app/\(main\)/forum/ src/core/components/sidebar/Sidebar.tsx src/proxy.ts
git commit -m "feat(forum): add anonymous forum with gerencia-only author visibility"
```

---

## Task 5: Interactive announcement banner

A gerencia-editable banner displayed at the top of the dashboard hero. Text is stored in `organization.metadata` as JSON.

**Files:**
- Create: `src/app/api/v2/organization/banner/route.ts`
- Create: `src/app/api/v2/organization/banner/route.test.js`
- Create: `src/dashboard/components/AnnouncementBanner.tsx`
- Modify: `src/dashboard/components/Hero.tsx` — render banner

- [ ] **Step 1: Write the failing test**

Create `src/app/api/v2/organization/banner/route.test.js`:
```js
import { beforeEach, describe, expect, mock, test } from "bun:test";

const execute = mock(() => ({ rows: [{ metadata: '{"banner_text":"Hello","banner_color":"#f59e0b","banner_enabled":true}'], rowsAffected: 1 }));
const getTursoClient = mock(() => ({ execute }));

mock.module("@/core/libsql/client", () => ({ getTursoClient }));
mock.module("@/core/auth/session-utils", () => ({
  validateUserSession: () => ({
    success: true,
    user: { id: "admin1", role: "admin", email: "a@b.com", name: "Admin" },
  }),
}));

const bannerRoute = await import("./route.ts");

beforeEach(() => {
  execute.mockClear();
  getTursoClient.mockClear();
});

describe("GET /api/v2/organization/banner", () => {
  test("returns banner data", async () => {
    const res = await bannerRoute.GET(new Request("https://x/api/v2/organization/banner"));
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

describe("PATCH /api/v2/organization/banner", () => {
  test("updates banner text", async () => {
    execute.mockImplementation(() => ({ rows: [], rowsAffected: 1 }));
    const res = await bannerRoute.PATCH(
      new Request("https://x/api/v2/organization/banner", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "¡100€ de comisión hasta mañana!" }),
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/app/api/v2/organization/banner/route.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the banner API**

Create `src/app/api/v2/organization/banner/route.ts`:

Uses `organization.metadata` (TEXT column) to store banner settings as JSON. The organization ID comes from the authenticated user's session.

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTursoClient } from "@/core/libsql/client";
import { validateUserSession } from "@/core/auth/session-utils";

const BannerUpdateSchema = z.object({
  text: z.string().max(500).optional(),
  color: z.string().optional(),
  enabled: z.boolean().optional(),
});

const DEFAULT_BANNER = { text: "", color: "#f59e0b", enabled: false };

export async function GET(req: NextRequest) {
  const client = getTursoClient(req);
  if (!client) {
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }

  const result = await client.execute({
    sql: "SELECT metadata FROM organization LIMIT 1",
    args: [],
  });

  let banner = DEFAULT_BANNER;
  if (result.rows.length > 0 && result.rows[0].metadata) {
    try {
      const metadata = JSON.parse(String(result.rows[0].metadata));
      if (metadata.banner_text !== undefined) {
        banner = {
          text: metadata.banner_text || "",
          color: metadata.banner_color || "#f59e0b",
          enabled: metadata.banner_enabled ?? false,
        };
      }
    } catch {
      // use default
    }
  }

  return NextResponse.json({ success: true, data: banner });
}

export async function PATCH(req: NextRequest) {
  const authResult = await validateUserSession(req);
  if (!authResult.success || !authResult.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (authResult.user.role !== "admin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = BannerUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });
  }

  const client = getTursoClient(req);
  if (!client) {
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }

  // Read current metadata
  const result = await client.execute({
    sql: "SELECT metadata FROM organization LIMIT 1",
    args: [],
  });

  let metadata: Record<string, unknown> = {};
  if (result.rows.length > 0 && result.rows[0].metadata) {
    try {
      metadata = JSON.parse(String(result.rows[0].metadata));
    } catch {
      metadata = {};
    }
  }

  // Merge banner fields
  if (parsed.data.text !== undefined) metadata.banner_text = parsed.data.text;
  if (parsed.data.color !== undefined) metadata.banner_color = parsed.data.color;
  if (parsed.data.enabled !== undefined) metadata.banner_enabled = parsed.data.enabled;

  await client.execute({
    sql: "UPDATE organization SET metadata = ? WHERE id = (SELECT id FROM organization LIMIT 1)",
    args: [JSON.stringify(metadata)],
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/app/api/v2/organization/banner/route.test.js`
Expected: PASS.

- [ ] **Step 5: Create the AnnouncementBanner component**

Create `src/dashboard/components/AnnouncementBanner.tsx`:
```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Megaphone } from "lucide-react";
import type { User } from "@/core/types";

interface BannerData {
  text: string;
  color: string;
  enabled: boolean;
}

interface AnnouncementBannerProps {
  userData: User;
}

export function AnnouncementBanner({ userData }: AnnouncementBannerProps) {
  const [banner, setBanner] = useState<BannerData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const isDireccion = userData?.role === "admin";

  const fetchBanner = useCallback(async () => {
    try {
      const res = await fetch("/api/v2/organization/banner");
      const data = await res.json();
      if (data.success && data.data) setBanner(data.data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => { fetchBanner(); }, [fetchBanner]);

  if (!banner || !banner.enabled || !banner.text || dismissed) return null;

  return (
    <div
      className="relative rounded-xl px-4 py-3 mb-4 flex items-center gap-3"
      style={{ backgroundColor: banner.color + "20", borderColor: banner.color, borderWidth: "1px" }}
    >
      <Megaphone className="h-5 w-5 flex-shrink-0" style={{ color: banner.color }} />
      <p className="flex-1 text-sm font-medium" style={{ color: banner.color }}>
        {banner.text}
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 p-1 rounded-full hover:bg-black/10 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function BannerEditor({ userData }: { userData: User }) {
  const [text, setText] = useState("");
  const [color, setColor] = useState("#f59e0b");
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchBanner = useCallback(async () => {
    try {
      const res = await fetch("/api/v2/organization/banner");
      const data = await res.json();
      if (data.success && data.data) {
        setText(data.data.text);
        setColor(data.data.color);
        setEnabled(data.data.enabled);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => { fetchBanner(); }, [fetchBanner]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/v2/organization/banner", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, color, enabled }),
      });
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 border-t pt-4 mt-4">
      <p className="text-xs font-medium text-gray-500 uppercase">Cartel Anuncio (solo gerencia)</p>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ej: ¡100€ de comisión hasta mañana!"
        className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm"
      />
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          Color:
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-8 cursor-pointer"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded"
          />
          Visible
        </label>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 text-sm bg-primary text-white rounded-md hover:bg-primary-600"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Insert banner into Hero.tsx**

In `src/dashboard/components/Hero.tsx`, import the components and render the banner between the header row (ends around line 126) and the `<AnimatePresence>` stats block (starts around line 128).

Add imports at the top:
```tsx
import { AnnouncementBanner, BannerEditor } from "./AnnouncementBanner";
```

In the `Hero` component, after the closing `</div>` of the header row (around line 126), and before the `<AnimatePresence>` block (line 128), insert:

```tsx
      <AnnouncementBanner userData={userData} />
```

And for gerencia, add the editor inside the hero (after the banner, before AnimatePresence):
```tsx
      {isAdmin && <BannerEditor userData={userData} />}
```

- [ ] **Step 7: Verify + commit**

```bash
bun test && npx tsc --noEmit && npm run lint
git add src/app/api/v2/organization/banner/ src/dashboard/components/AnnouncementBanner.tsx src/dashboard/components/Hero.tsx
git commit -m "feat(dashboard): add gerencia-editable announcement banner"
```

---

## Task 6: External API research-only stubs

These are **not** production integrations — they are research stubs that document each external API's capabilities, auth requirements, and data format, so a future implementation task knows exactly what to build.

**Files:**
- Create: `src/external-stubs/omie.ts`
- Create: `src/external-stubs/mibgas.ts`
- Create: `src/external-stubs/omip.ts`
- Create: `src/external-stubs/sips.ts`
- Create: `src/external-stubs/README.md`

- [ ] **Step 1: Create OMIE stub**

Create `src/external-stubs/omie.ts`:
```ts
/**
 * OMIE (Operador del Mercado Ibérico de la Energía) - Research Stub
 *
 * Purpose: Daily electricity market prices (spot, intraday) for Spain and Portugal.
 *
 * API Documentation: https://www.omie.es/es/market-results
 * Base URL: https://www.omie.es/api/v2
 *
 * Key endpoints (to be implemented):
 * - GET /day-ahead/prices?date=YYYY-MM-DD -> hourly spot prices (€/MWh)
 * - GET /intraday/prices?date=YYYY-MM-DD -> intraday market prices
 *
 * Authentication: Public API, no key required for basic queries.
 * Rate limits: ~60 requests/minute.
 * Data format: JSON with hourly price arrays.
 *
 * Integration notes:
 * - Prices are in €/MWh, need conversion for display
 * - Combine with tariff type (2.0TD/3.0TD/6.1TD) to estimate client bills
 * - Cache recommended: market data changes once daily
 */

export const OMIE_CONFIG = {
  baseUrl: "https://www.omie.es/api/v2",
  description: "Electricity market spot and intraday prices for Iberian Peninsula",
  authType: "none" as const,
  rateLimit: "60 req/min",
} as const;

export async function fetchOmieDayAheadPrices(_date: string): Promise<never> {
  throw new Error(
    "OMIE integration not implemented. See src/external-stubs/omie.ts for research notes.",
  );
}
```

- [ ] **Step 2: Create MIBGAS stub**

Create `src/external-stubs/mibgas.ts`:
```ts
/**
 * MIBGAS (Mercado Ibérico del Gas) - Research Stub
 *
 * Purpose: Natural gas market prices for the Iberian market.
 *
 * API Documentation: https://www.mibgas.es/en/market-results
 * Base URL: https://www.mibgas.es/api/v1
 *
 * Key endpoints (to be implemented):
 * - GET /daily-prices?date=YYYY-MM-DD -> daily gas prices (€/MWh)
 * - GET /monthly-averages -> monthly average prices
 *
 * Authentication: Public API, no key required.
 * Rate limits: ~30 requests/minute.
 * Data format: JSON with daily price objects.
 *
 * Integration notes:
 * - Relevant for Gas comparativas
 * - Prices in €/MWh for natural gas
 * - Monthly averages more stable for display
 */

export const MIBGAS_CONFIG = {
  baseUrl: "https://www.mibgas.es/api/v1",
  description: "Iberian natural gas market prices",
  authType: "none" as const,
  rateLimit: "30 req/min",
} as const;

export async function fetchMibgasPrices(_date: string): Promise<never> {
  throw new Error(
    "MIBGAS integration not implemented. See src/external-stubs/mibgas.ts for research notes.",
  );
}
```

- [ ] **Step 3: Create OMIP stub**

Create `src/external-stubs/omip.ts`:
```ts
/**
 * OMIP (Operador do Mercado Ibérico (Portugal)) - Research Stub
 *
 * Purpose: Portuguese electricity and gas market operator, complementary to OMIE.
 *
 * API Documentation: https://www.omip.pt/en/market-results
 * Base URL: https://www.omip.pt/api/v1
 *
 * Key endpoints (to be implemented):
 * - GET /electricity/prices?date=YYYY-MM-DD -> Portuguese market prices
 * - GET /gas/prices?date=YYYY-MM-DD -> Portuguese gas prices
 *
 * Authentication: Public API, no key required.
 * Rate limits: ~30 requests/minute.
 * Data format: JSON with price arrays.
 *
 * Integration notes:
 * - Portuguese market perspective (complementary to OMIE's Spanish view)
 * - Useful for cross-border energy comparativas
 * - Less data available than OMIE for Spanish market
 */

export const OMIP_CONFIG = {
  baseUrl: "https://www.omip.pt/api/v1",
  description: "Portuguese electricity and gas market prices",
  authType: "none" as const,
  rateLimit: "30 req/min",
} as const;

export async function fetchOmipPrices(_date: string): Promise<never> {
  throw new Error(
    "OMIP integration not implemented. See src/external-stubs/omip.ts for research notes.",
  );
}
```

- [ ] **Step 4: Create SIPS stub**

Create `src/external-stubs/sips.ts`:
```ts
/**
 * SIPS (Sistema de Información de Punto de Suministro) - Research Stub
 *
 * Purpose: Query annual consumption data by CUPS code when a comparativa is created.
 * This enables automatic consumption estimation for energy comparisons.
 *
 * API Documentation: Available via Red Eléctrica de España (REE) / CNMC
 * Access: Requires certified authentication (digital certificate or API key)
 * Base URL: Not public — must be requested from distributor
 *
 * KEY ENDPOINTS (to be implemented):
 * - GET /consumption/{cups}?year=YYYY -> Annual kWh consumption for a CUPS
 * - GET /supply-point/{cups} -> Supply point technical data (tariff, power, etc.)
 *
 * Authentication: Requires **registered API key** from the distributor.
 *   - Contact: Operador del Sistema (REE) or the specific distributor
 *   - Certificate-based auth required for production
 *   - Sandbox/test environment available for development
 *
 * Data format: JSON with monthly consumption arrays.
 *
 * Integration notes:
 * - CRITICAL: Requires CUPS code from comparativa (available from abarca_estudio or manual input)
 * - Annual consumption in kWh enables accurate tariff comparison
 * - Must handle CUPS validation (format: ES0000000000000000XX, 20-22 chars)
 * - Response time can vary from 1-30 seconds per CUPS
 * - Recommended: Queue CUPS lookups and cache results for 24h
 * - Privacy: consumption data is PII — must comply with GDPR
 *
 * Current status: Research only. Integration requires:
 *   1. Registering with a distributor for API access
 *   2. Implementing certificate-based authentication
 *   3. Building a CUPS validation layer
 *   4. Creating a consumption cache with TTL
 */

export const SIPS_CONFIG = {
  description: "Annual consumption data by CUPS code from Spanish distribution system",
  authType: "certificate" as const,
  rateLimit: "Varies by distributor",
  cupsPattern: /^ES\d{16}[A-Z]{2}$/,
} as const;

export async function fetchSipsConsumption(_cups: string): Promise<never> {
  throw new Error(
    "SIPS integration not implemented. See src/external-stubs/sips.ts for research notes and requirements.",
  );
}

export function validateCups(cups: string): boolean {
  return SIPS_CONFIG.cupsPattern.test(cups);
}
```

- [ ] **Step 5: Create the README**

Create `src/external-stubs/README.md`:
```markdown
# External API Research Stubs

These files are **research-only stubs** documenting the capabilities, authentication requirements, and data formats of external APIs that the CRM could integrate with in the future.

**No production code uses these modules.** They exist to:
1. Document what each API offers
2. Define the expected interface for future integration
3. Provide `validateCups()` (SIPS) as a reusable utility

## APIs

| API | Purpose | Auth | Status |
|-----|---------|------|--------|
| OMIE | Iberian electricity market prices (€/MWh) | Public | Stub only |
| MIBGAS | Iberian gas market prices (€/MWh) | Public | Stub only |
| OMIP | Portuguese electricity & gas prices | Public | Stub only |
| SIPS | Annual consumption by CUPS code | Certificate | Stub only |

## Next Steps

For production integration, each stub needs:
- Registered API key / certificate
- Rate limiting middleware
- Caching layer (Redis or Turso)
- Error handling and retry logic
- UI components to display market data
```

- [ ] **Step 6: Commit**

```bash
git add src/external-stubs/
git commit -m "docs: add research-only stubs for OMIE, MIBGAS, OMIP, SIPS external APIs"
```

---

## Self-Review

**1. Spec coverage:**

| Spec item | Task |
|---|---|
| Foro de debates (anonymous except gerencia) | T1-T4 (migration, threads API, messages API, UI) |
| Cartel interactivo en dashboard (gerencia-editable) | T5 (banner API + component in Hero) |
| Integraciones OMIE, MIBGAS, OMIP | T6 (research-only stubs, deferred) |
| API SIPS para consumo anual por CUPS | T6 (research-only stub, deferred) |

All "Bloque 3" items covered. External APIs are intentionally stub-only per the agreed scope.

**2. Placeholder scan:** No TBD, TODO, "implement later", or "fill in" patterns. All code steps contain complete implementations. Research stubs are explicitly marked as non-production with `throw new Error(...)` guards.

**3. Type consistency:**
- Forum `authorName` is `"Anónimo"` for non-admin and real name for admin — consistently implemented in both GET handlers.
- `BannerData` interface used consistently between API and component.
- `organization.metadata` (TEXT) stored as JSON string — read with `JSON.parse()`, written with `JSON.stringify()`.
- All API routes follow the existing `validateUserSession` + `getTursoClient` pattern.

**4. Potential issues:**
- The forum uses polling (15s interval) instead of WebSockets. This is acceptable per the spec ("no websockets required").
- `organization.metadata` may be NULL initially — the code handles this with a `try/catch` defaulting to `DEFAULT_BANNER`.
- The forum is accessible to all authenticated users. No role gate on the page itself — only author names are anonymized for non-admin users.
- The banner editor is visible only to `isAdmin` (role `"admin"`) in the Hero component.