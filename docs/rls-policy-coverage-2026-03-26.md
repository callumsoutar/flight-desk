# RLS Policy Coverage Checklist — 2026-03-26

Purpose: capture current Row Level Security (RLS) assurance for tenant-bound tables touched by the recent API auth hardening pass.

Method:
- Live database verification via Supabase MCP (`execute_sql` against `pg_class` + `pg_policies`) on project `fergmobsjyucucxeumvb`.
- In-repo policy definition check via `supabase/migrations/*.sql` presence scan for `on public.<table>` statements.

## Snapshot findings

- Live DB: all reviewed tables below have `rls_enabled = true` and non-zero policy coverage.
- Version control: repo currently contains only `34` migration files, while live DB has `469` applied migrations (`supabase_migrations.schema_migrations`).
- Assurance gap reduced: a baseline migration has now been added to version policy DDL for the previously missing audit-scope tables (`20260326013104_rls_policy_baseline_audit_scope.sql`).
- Migration execution verified in Supabase MCP: `supabase_migrations.schema_migrations` contains `20260326013104 | rls_policy_baseline_audit_scope`.
- Post-apply policy verification via `pg_policies` confirms expected coverage on baseline tables: all have active policies (`invoices=3`; all others in baseline scope=`4`).

## Table-by-table checklist

| Table | Live RLS verified (MCP) | Policy definitions discoverable in `supabase/migrations` | Notes |
| --- | --- | --- | --- |
| `aircraft` | yes | yes | Present in `20260312190000_security_audit_remediation.sql`. |
| `aircraft_types` | yes | yes | Baseline added in `20260326013104_rls_policy_baseline_audit_scope.sql`. |
| `bookings` | yes | yes | Present in `20260312190000_security_audit_remediation.sql`. |
| `cancellation_categories` | yes | yes | Present in `20260319150000_remove_global_cancellation_categories.sql`. |
| `email_logs` | yes | yes | Present in `20260321120000_email_logs_and_trigger_configs.sql`. |
| `flight_experience` | yes | yes | Baseline added in `20260326013104_rls_policy_baseline_audit_scope.sql`. |
| `flight_types` | yes | yes | Present in `20260312190000_security_audit_remediation.sql`. |
| `instructors` | yes | yes | Present in `20260312190000_security_audit_remediation.sql`. |
| `invoice_items` | yes | yes | Baseline added in `20260326013104_rls_policy_baseline_audit_scope.sql`. |
| `invoice_payments` | yes | yes | Baseline added in `20260326013104_rls_policy_baseline_audit_scope.sql`. |
| `invoices` | yes | yes | Baseline added in `20260326013104_rls_policy_baseline_audit_scope.sql`. |
| `lesson_progress` | yes | yes | Baseline added in `20260326013104_rls_policy_baseline_audit_scope.sql`. |
| `lessons` | yes | yes | Present in `20260312190000_security_audit_remediation.sql`. |
| `roles` | yes | yes | Present in `20260312190000_security_audit_remediation.sql`. |
| `roster_rules` | yes | yes | Present in `20260312190000_security_audit_remediation.sql`. |
| `student_syllabus_enrollment` | yes | yes | Baseline added in `20260326013104_rls_policy_baseline_audit_scope.sql`. |
| `syllabus` | yes | yes | Baseline added in `20260326013104_rls_policy_baseline_audit_scope.sql`. |
| `tenant_settings` | yes | yes | Present in `20260312170000_tenant_settings_rls_hardening.sql`. |
| `tenant_users` | yes | yes | Baseline added in `20260326013104_rls_policy_baseline_audit_scope.sql`. |
| `tenants` | yes | yes | Baseline added in `20260326013104_rls_policy_baseline_audit_scope.sql`. |
| `transactions` | yes | yes | Baseline added in `20260326013104_rls_policy_baseline_audit_scope.sql`. |
| `users` | yes | yes | Present in `20260312190000_security_audit_remediation.sql` and `20260312200100_fix_users_rls_auth_initplan.sql`. |
| `xero_accounts` | yes | yes | Present in `20260311113000_xero_security_hardening.sql`. |
| `xero_connections` | yes | yes | Present in `20260311113000_xero_security_hardening.sql`. |

## Recommended next steps

1. Apply `20260326013104_rls_policy_baseline_audit_scope.sql` to all active environments and confirm no drift.
2. Decide whether to import historical migrations (or an authoritative schema baseline) so a fresh environment can be audited from git alone.
3. Add a recurring audit task (or CI check) that diffs live `pg_policies` against expected policy definitions in repo.
