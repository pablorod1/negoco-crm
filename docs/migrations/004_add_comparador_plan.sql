-- Migration: Add 'comparador' plan
-- Date: 2026-05-25
-- Description: Adds a new plan for customers who only use the energy comparator without CRM access

INSERT INTO plans (id, name, max_members) VALUES (4, 'comparador', 1);

-- To set an organization to this plan:
-- UPDATE organization SET plan = '4' WHERE id = '<organization_id>';
