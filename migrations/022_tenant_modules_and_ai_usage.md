# Migración 022: módulos por tenant y uso de IA

Se aplica **solo en la base de control** (`negoco-crm-control`, variable
`NEXT_TURSO_CONTROL_DB_URL`), no en las bases de tenant. Es idempotente.

- `tenant_modules`: qué módulos tiene contratados cada tenant. Hoy solo existe
  `negoco_studies` (comparador propio). El tenant no puede escribir en esta
  base; activar o desactivar un módulo es cosa de Negoco.
- `ai_usage_events`: una fila por llamada a Vercel AI Gateway con tokens, coste
  y resultado, para medir el coste por tenant y tipo de trabajo.

La migración activa `negoco_studies` solo en `test`. Para activarlo en otro
tenant:

```sql
INSERT INTO tenant_modules (tenant_slug, module_key, enabled, updated_by)
VALUES ('beenergy', 'negoco_studies', 1, '<quién>')
ON CONFLICT(tenant_slug, module_key) DO UPDATE SET
  enabled = excluded.enabled,
  updated_by = excluded.updated_by,
  updated_at = CURRENT_TIMESTAMP;
```

El CRM cachea los módulos de cada tenant durante 60 segundos por instancia, así
que un cambio tarda como mucho un minuto en verse. Si la base de control no
responde, el CRM trata todos los módulos como desactivados.

Sin esta migración aplicada el CRM sigue funcionando: la lectura falla, se
registra el error y el botón «Estudio Negoco Cloud» no aparece.
