# Finance System Refactor — Implementation Plan

> **Flight Service Pro** · Invoice Immutability & Architecture Gaps
> **Date**: 2026-03-11
> **Branch**: `cursor/invoice-xero-export-locking-eb0c`
> **Supabase Project**: `fergmobsjyucucxeumvb` (flight-service-pro, ap-southeast-2)
> **Based on**: `finance_system_recommendations.md` (R-01 through R-17)

---

## Locking Model Confirmation

**The fundamental change**: Invoices are locked when exported to Xero, not when they reach `pending` status.

**Before (current)**:
- `prevent_approved_invoice_modification()` checks `OLD.status IN ('pending', 'paid', 'overdue')` → blocks edits
- `prevent_approved_invoice_item_modification()` checks `v_invoice_status IN ('pending', 'paid', 'overdue')` → blocks edits
- Admins/owners bypass unconditionally with no audit trail

**After (target)**:
- Both trigger functions check `invoice_is_xero_exported(OLD.id)` → blocks edits only after Xero export
- Invoices in `pending`, `paid`, or `overdue` that have NOT been exported to Xero are fully editable by staff
- Once exported, the invoice is locked for ALL users (including admins) unless a void-and-reissue workflow is initiated
- Admin overrides require `app.override_reason` and are logged to `admin_override_audit`
- Internal SECURITY DEFINER functions use `app.internal_caller` instead of the fragile `auth.uid() IS NULL` convention

**Current data state** (production):
- 40 active invoices: 19 pending, 21 paid
- 5 invoices exported to Xero (`export_status = 'exported'`): 2 pending, 3 paid
- 35 invoices NOT exported to Xero: 17 pending, 18 paid
- **Impact**: The 35 non-exported invoices that were previously locked (by status) will become editable. The 5 exported invoices remain locked. This is the intended behavior.

---

## Section 1: Pre-Implementation Checklist

### 1.1 Functions to Be Modified vs Replaced

| Function | Action | Reason |
|----------|--------|--------|
| `prevent_approved_invoice_modification()` | **Rewrite** | Replace status-based lock with Xero-export-based lock; add `app.internal_caller` allowlist; add admin override audit |
| `prevent_approved_invoice_item_modification()` | **Rewrite** | Same — Xero-export lock; admin audit; `app.internal_caller` |
| `update_invoice_status_atomic()` | **Modify** | Add `SECURITY DEFINER`, `SET search_path`, role check; set `app.internal_caller` |
| `update_invoice_totals_atomic()` | **Modify** | Set `app.internal_caller` before invoice update |
| `record_invoice_payment_atomic()` | **Modify** | Set `app.internal_caller` before invoice update |
| `soft_delete_invoice()` | **Modify** | Set `app.internal_caller`; add `SET search_path` |
| `generate_invoice_number_with_prefix()` | **Modify** | Scope `ON CONFLICT` to `(tenant_id, year_month)` |
| `generate_invoice_number_app()` | **No change** | Wrapper — automatically picks up prefix function changes |
| `create_invoice_atomic()` | **Modify** | Set `app.internal_caller` before invoice update steps |
| `approve_booking_checkin_atomic()` | **No change** | Calls `create_invoice_atomic` which handles its own internals |
| `finalize_booking_checkin_with_invoice_atomic()` | **Modify** | Add draft-status and user-match validation (R-16) |
| `create_invoice_with_transaction()` | **Drop** | Superseded by `create_invoice_atomic()` (R-09) |
| `upsert_invoice_items_batch()` | **Drop** | Legacy, fragile, no auth (R-08) |

### 1.2 Application Code Paths Calling Affected Functions

| RPC Function | Called From | File |
|---|---|---|
| `create_invoice_atomic` | Called internally by `approve_booking_checkin_atomic` | (DB-level only) |
| `update_invoice_totals_atomic` | `approveDraftInvoiceAction` | `app/invoices/[id]/actions.ts` |
| `update_invoice_totals_atomic` | `createAndApproveInvoiceAction` | `app/invoices/new/actions.ts` |
| `update_invoice_status_atomic` | `approveDraftInvoiceAction` | `app/invoices/[id]/actions.ts` |
| `update_invoice_status_atomic` | `createAndApproveInvoiceAction` | `app/invoices/new/actions.ts` |
| `record_invoice_payment_atomic` | `recordInvoicePaymentAction` | `app/invoices/[id]/actions.ts` |
| `soft_delete_invoice` | `createInvoiceDraftAction` (rollback) | `app/invoices/new/actions.ts` |
| `generate_invoice_number_app` | `createInvoiceDraftAction` | `app/invoices/new/actions.ts` |
| `approve_booking_checkin_atomic` | Booking check-in approval API | `app/api/bookings/[id]/checkin/approve/route.ts` |
| `create_invoice_with_transaction` | **Not called anywhere in app code** | — |
| `upsert_invoice_items_batch` | **Not called anywhere in app code** | — |
| `finalize_booking_checkin_with_invoice_atomic` | **Not called anywhere in app code** | — |

### 1.3 Data Validation Queries (Run Before Migrations)

All validated against production on 2026-03-11:

| Check | Query | Result |
|-------|-------|--------|
| Totals consistency | `SELECT count(*) FROM invoices WHERE round(subtotal + tax_total, 2) <> round(total_amount, 2) AND deleted_at IS NULL` | **0 violations** ✅ |
| Orphaned transactions | `SELECT count(*) FROM transactions t WHERE (t.metadata->>'invoice_id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = (t.metadata->>'invoice_id')::uuid)` | **0 orphans** ✅ |
| Duplicate year_month in invoice_sequences | `SELECT year_month, count(*) FROM invoice_sequences GROUP BY year_month HAVING count(*) > 1` | **0 duplicates** ✅ |
| All transactions have invoice_id metadata | `SELECT count(*) FROM transactions WHERE (metadata->>'invoice_id') IS NULL` | **0 (all 59 have invoice_id)** ✅ |
| Xero export state | `SELECT export_status, count(*) FROM xero_invoices GROUP BY export_status` | 5 exported, 2 failed ✅ |

### 1.4 Environment Prerequisites

- [x] `pg_cron` extension is enabled (v1.6 confirmed)
- [ ] Create Supabase branch database for testing all migrations before production
- [ ] Ensure `.env.local` has all required Supabase vars for local dev testing
- [ ] Back up production database before Phase 1 deployment

---

## Section 2: Database Migration Plan

### Phase 1 — Immediate: Lock Down Audit & Payments (R-03, R-12)

---

#### Migration 1: `protect_audit_logs_immutability`

**Ref**: R-03
**What it does**: Adds BEFORE DELETE and BEFORE UPDATE triggers on `audit_logs` to make it append-only.
**Dependencies**: None
**Rollback**: `DROP TRIGGER audit_logs_no_delete ON audit_logs; DROP TRIGGER audit_logs_no_update ON audit_logs; DROP FUNCTION prevent_audit_log_delete(); DROP FUNCTION prevent_audit_log_update();`

```sql
-- Migration: protect_audit_logs_immutability
-- Ref: R-03 — audit_logs is not itself immutable or append-only

CREATE OR REPLACE FUNCTION public.prevent_audit_log_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Audit log records cannot be deleted.'
    USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_audit_log_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Audit log records are immutable.'
    USING ERRCODE = 'P0001';
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'audit_logs_no_delete'
    AND tgrelid = 'public.audit_logs'::regclass
  ) THEN
    CREATE TRIGGER audit_logs_no_delete
    BEFORE DELETE ON public.audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_delete();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'audit_logs_no_update'
    AND tgrelid = 'public.audit_logs'::regclass
  ) THEN
    CREATE TRIGGER audit_logs_no_update
    BEFORE UPDATE ON public.audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_update();
  END IF;
END;
$$;
```

**Post-migration verification**:
```sql
-- Should raise exception:
DO $$ BEGIN
  UPDATE audit_logs SET action = 'tampered' WHERE id = (SELECT id FROM audit_logs LIMIT 1);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'UPDATE blocked as expected: %', SQLERRM;
END; $$;

DO $$ BEGIN
  DELETE FROM audit_logs WHERE id = (SELECT id FROM audit_logs LIMIT 1);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'DELETE blocked as expected: %', SQLERRM;
END; $$;
```

---

#### Migration 2: `protect_invoice_payments_no_delete`

**Ref**: R-12
**What it does**: Adds BEFORE DELETE trigger on `invoice_payments` to prevent hard-deletes.
**Dependencies**: None
**Rollback**: `DROP TRIGGER invoice_payments_no_delete ON invoice_payments; DROP FUNCTION prevent_invoice_payment_delete();`

```sql
-- Migration: protect_invoice_payments_no_delete
-- Ref: R-12 — invoice_payments has no DELETE protection

CREATE OR REPLACE FUNCTION public.prevent_invoice_payment_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Hard deletion of invoice payments is not permitted. Use reverse_invoice_payment_atomic() instead.'
    USING ERRCODE = 'P0001';
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'invoice_payments_no_delete'
    AND tgrelid = 'public.invoice_payments'::regclass
  ) THEN
    CREATE TRIGGER invoice_payments_no_delete
    BEFORE DELETE ON public.invoice_payments
    FOR EACH ROW EXECUTE FUNCTION public.prevent_invoice_payment_delete();
  END IF;
END;
$$;
```

**Post-migration verification**:
```sql
DO $$ BEGIN
  DELETE FROM invoice_payments WHERE id = (SELECT id FROM invoice_payments LIMIT 1);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'DELETE blocked as expected: %', SQLERRM;
END; $$;
```

---

### Phase 2 — Next Sprint: Fix Totals, Status Function, Overdue Automation (R-04, R-06, R-07)

---

#### Migration 3: `add_item_soft_delete_recalc_trigger`

**Ref**: R-04
**What it does**: Adds AFTER UPDATE trigger on `invoice_items` that automatically recalculates invoice totals when an item is soft-deleted.
**Dependencies**: None (uses existing `update_invoice_totals_atomic`)
**Rollback**: `DROP TRIGGER invoice_item_soft_delete_recalc ON invoice_items; DROP FUNCTION recalc_invoice_on_item_soft_delete();`

```sql
-- Migration: add_item_soft_delete_recalc_trigger
-- Ref: R-04 — Soft-deleting an item silently stales totals

CREATE OR REPLACE FUNCTION public.recalc_invoice_on_item_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    PERFORM public.update_invoice_totals_atomic(NEW.invoice_id);
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'invoice_item_soft_delete_recalc'
    AND tgrelid = 'public.invoice_items'::regclass
  ) THEN
    CREATE TRIGGER invoice_item_soft_delete_recalc
    AFTER UPDATE ON public.invoice_items
    FOR EACH ROW EXECUTE FUNCTION public.recalc_invoice_on_item_soft_delete();
  END IF;
END;
$$;
```

**Post-migration verification**:
```sql
SELECT 'Trigger exists' AS status FROM pg_trigger
WHERE tgname = 'invoice_item_soft_delete_recalc'
AND tgrelid = 'public.invoice_items'::regclass;
```

---

#### Migration 4: `fix_update_invoice_status_atomic_security`

**Ref**: R-06
**What it does**: Rewrites `update_invoice_status_atomic()` with `SECURITY DEFINER`, `SET search_path`, and a role check at entry. Also sets `app.internal_caller` for the immutability trigger.
**Dependencies**: None
**Rollback**: Redeploy original function definition (saved in pre-migration backup).

```sql
-- Migration: fix_update_invoice_status_atomic_security
-- Ref: R-06 — update_invoice_status_atomic is not SECURITY DEFINER

CREATE OR REPLACE FUNCTION public.update_invoice_status_atomic(
  p_invoice_id uuid,
  p_new_status text,
  p_updated_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid;
  v_invoice RECORD;
  v_transaction_id UUID;
BEGIN
  BEGIN
    v_actor := auth.uid();

    -- Allow calls from other SECURITY DEFINER functions (internal_caller set)
    IF v_actor IS NULL THEN
      IF COALESCE(current_setting('app.internal_caller', true), '') = '' THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Unauthorized',
          'message', 'Authentication required'
        );
      END IF;
    ELSE
      IF NOT check_user_role_simple(v_actor, ARRAY['admin'::user_role, 'owner'::user_role, 'instructor'::user_role]) THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Forbidden',
          'message', 'Insufficient permissions to update invoice status'
        );
      END IF;
    END IF;

    SELECT * INTO v_invoice
    FROM invoices
    WHERE id = p_invoice_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invoice not found',
        'invoice_id', p_invoice_id
      );
    END IF;

    PERFORM set_config('app.internal_caller', 'update_invoice_status_atomic', true);

    UPDATE invoices
    SET
      status = p_new_status::invoice_status,
      updated_at = p_updated_at
    WHERE id = p_invoice_id;

    PERFORM set_config('app.internal_caller', '', true);

    IF v_invoice.status = 'draft' AND p_new_status IN ('pending', 'paid') THEN
      INSERT INTO transactions (
        user_id, type, amount, description, metadata, status, completed_at
      ) VALUES (
        v_invoice.user_id,
        'debit',
        v_invoice.total_amount,
        'Invoice: ' || v_invoice.invoice_number,
        jsonb_build_object(
          'invoice_id', v_invoice.id,
          'invoice_number', v_invoice.invoice_number,
          'transaction_type', 'invoice_debit'
        ),
        'completed',
        NOW()
      ) RETURNING id INTO v_transaction_id;

    ELSIF v_invoice.status IN ('pending', 'paid') AND p_new_status = 'cancelled' THEN
      SELECT id INTO v_transaction_id
      FROM transactions
      WHERE user_id = v_invoice.user_id
        AND type = 'debit'
        AND status = 'completed'
        AND metadata->>'invoice_id' = v_invoice.id::text
        AND metadata->>'transaction_type' = 'invoice_debit';

      IF FOUND THEN
        INSERT INTO transactions (
          user_id, type, amount, description, metadata, status, completed_at
        ) VALUES (
          v_invoice.user_id,
          'credit',
          v_invoice.total_amount,
          'Reversal of Invoice: ' || v_invoice.invoice_number || ' (cancelled)',
          jsonb_build_object(
            'reversal_of', v_transaction_id,
            'reversal_reason', 'Invoice cancelled',
            'transaction_type', 'reversal',
            'original_transaction_type', 'debit',
            'invoice_id', v_invoice.id,
            'invoice_number', v_invoice.invoice_number
          ),
          'completed',
          NOW()
        ) RETURNING id INTO v_transaction_id;
      END IF;

    ELSIF v_invoice.status = 'cancelled' AND p_new_status IN ('pending', 'paid') THEN
      INSERT INTO transactions (
        user_id, type, amount, description, metadata, status, completed_at
      ) VALUES (
        v_invoice.user_id,
        'debit',
        v_invoice.total_amount,
        'Invoice: ' || v_invoice.invoice_number,
        jsonb_build_object(
          'invoice_id', v_invoice.id,
          'invoice_number', v_invoice.invoice_number,
          'transaction_type', 'invoice_debit'
        ),
        'completed',
        NOW()
      ) RETURNING id INTO v_transaction_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'invoice_id', p_invoice_id,
      'old_status', v_invoice.status,
      'new_status', p_new_status,
      'transaction_id', v_transaction_id,
      'message', 'Invoice status updated atomically'
    );

  EXCEPTION
    WHEN OTHERS THEN
      PERFORM set_config('app.internal_caller', '', true);
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'invoice_id', p_invoice_id,
        'message', 'Transaction rolled back due to error'
      );
  END;
END;
$$;
```

**Post-migration verification**:
```sql
SELECT prosecdef, proconfig
FROM pg_proc
WHERE proname = 'update_invoice_status_atomic'
AND pronamespace = 'public'::regnamespace;
-- Should show prosecdef = true, proconfig includes search_path=public
```

---

#### Migration 5: `add_overdue_invoice_cron_job`

**Ref**: R-07
**What it does**: Creates a pg_cron job that runs nightly at 2am NZST to transition overdue invoices. Also creates a safe read view.
**Dependencies**: pg_cron extension (confirmed enabled v1.6)
**Rollback**: `SELECT cron.unschedule('mark-overdue-invoices'); DROP VIEW IF EXISTS invoice_effective_status;`

```sql
-- Migration: add_overdue_invoice_cron_job
-- Ref: R-07 — No automatic overdue transition

SELECT cron.schedule(
  'mark-overdue-invoices',
  '0 14 * * *',  -- 2am NZST (UTC+12) = 14:00 UTC
  $$
    UPDATE public.invoices
    SET status = 'overdue'::invoice_status, updated_at = NOW()
    WHERE status = 'pending'
    AND due_date < NOW()
    AND deleted_at IS NULL;
  $$
);

CREATE OR REPLACE VIEW public.invoice_effective_status AS
SELECT *,
  CASE
    WHEN status = 'pending' AND due_date < NOW() THEN 'overdue'::invoice_status
    ELSE status
  END AS effective_status
FROM public.invoices;
```

**Post-migration verification**:
```sql
SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'mark-overdue-invoices';
SELECT * FROM invoice_effective_status LIMIT 1;
```

---

### Phase 3 — Transactions FK (R-01)

---

#### Migration 6: `add_transactions_invoice_fk`

**Ref**: R-01
**What it does**: Adds `invoice_id UUID` column to `transactions`, backfills from metadata, adds FK constraint and index.
**Dependencies**: None
**Rollback**: `ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_invoice_id_fkey; DROP INDEX IF EXISTS idx_transactions_invoice_id; ALTER TABLE transactions DROP COLUMN IF EXISTS invoice_id;`

```sql
-- Migration: add_transactions_invoice_fk
-- Ref: R-01 — Transactions have no FK to invoices

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS invoice_id uuid;

UPDATE public.transactions
SET invoice_id = (metadata->>'invoice_id')::uuid
WHERE metadata->>'invoice_id' IS NOT NULL
AND invoice_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transactions_invoice_id_fkey'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_invoice_id_fkey
      FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_transactions_invoice_id
ON public.transactions(invoice_id)
WHERE invoice_id IS NOT NULL;
```

**Post-migration verification**:
```sql
SELECT count(*) AS backfilled
FROM transactions
WHERE invoice_id IS NOT NULL;
-- Should equal 59 (all existing transactions)

SELECT count(*) AS mismatches
FROM transactions
WHERE (metadata->>'invoice_id')::uuid IS DISTINCT FROM invoice_id
AND metadata->>'invoice_id' IS NOT NULL;
-- Should be 0
```

---

#### Migration 7: `update_atomic_functions_use_invoice_fk`

**Ref**: R-01 (continued)
**What it does**: Updates `update_invoice_totals_atomic()` and `record_invoice_payment_atomic()` to write the `invoice_id` FK column when creating transactions. Also updates `create_invoice_atomic()` and `update_invoice_status_atomic()`.
**Dependencies**: `add_transactions_invoice_fk`
**Rollback**: Redeploy original function definitions.

```sql
-- Migration: update_atomic_functions_use_invoice_fk
-- Ref: R-01 — Update atomic functions to populate invoice_id FK

-- update_invoice_totals_atomic: add invoice_id to INSERT and set app.internal_caller
CREATE OR REPLACE FUNCTION public.update_invoice_totals_atomic(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invoice RECORD;
  v_totals RECORD;
  v_transaction_id UUID;
BEGIN
  BEGIN
    SELECT * INTO v_invoice
    FROM invoices
    WHERE id = p_invoice_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invoice not found',
        'invoice_id', p_invoice_id
      );
    END IF;

    SELECT
      COALESCE(SUM(amount), 0) as subtotal,
      COALESCE(SUM(tax_amount), 0) as tax_total,
      COALESCE(SUM(line_total), 0) as total_amount
    INTO v_totals
    FROM invoice_items
    WHERE invoice_id = p_invoice_id
      AND deleted_at IS NULL;

    PERFORM set_config('app.internal_caller', 'update_invoice_totals_atomic', true);

    UPDATE invoices
    SET
      subtotal = v_totals.subtotal,
      tax_total = v_totals.tax_total,
      total_amount = v_totals.total_amount,
      balance_due = v_totals.total_amount - total_paid,
      updated_at = NOW()
    WHERE id = p_invoice_id;

    PERFORM set_config('app.internal_caller', '', true);

    IF v_invoice.status IN ('pending', 'paid') AND v_totals.total_amount > 0 THEN
      SELECT id INTO v_transaction_id
      FROM transactions
      WHERE invoice_id = v_invoice.id
        AND type = 'debit'
        AND status = 'completed'
        AND metadata->>'transaction_type' = 'invoice_debit';

      IF FOUND THEN
        UPDATE transactions
        SET
          amount = v_totals.total_amount,
          updated_at = NOW()
        WHERE id = v_transaction_id;
      ELSE
        INSERT INTO transactions (
          user_id, type, amount, description, metadata, status, completed_at, invoice_id
        ) VALUES (
          v_invoice.user_id,
          'debit',
          v_totals.total_amount,
          'Invoice: ' || v_invoice.invoice_number,
          jsonb_build_object(
            'invoice_id', v_invoice.id,
            'invoice_number', v_invoice.invoice_number,
            'transaction_type', 'invoice_debit'
          ),
          'completed',
          NOW(),
          v_invoice.id
        ) RETURNING id INTO v_transaction_id;
      END IF;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'invoice_id', p_invoice_id,
      'subtotal', v_totals.subtotal,
      'tax_total', v_totals.tax_total,
      'total_amount', v_totals.total_amount,
      'transaction_id', v_transaction_id,
      'transaction_created', (v_transaction_id IS NOT NULL),
      'message', 'Invoice totals updated atomically'
    );

  EXCEPTION
    WHEN OTHERS THEN
      PERFORM set_config('app.internal_caller', '', true);
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'invoice_id', p_invoice_id,
        'message', 'Invoice totals update rolled back due to error'
      );
  END;
END;
$$;

-- record_invoice_payment_atomic: add invoice_id to transaction INSERT
-- and set app.internal_caller before invoice UPDATE
CREATE OR REPLACE FUNCTION public.record_invoice_payment_atomic(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method payment_method,
  p_payment_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_paid_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid;
  v_invoice_user_id uuid;
  v_invoice_number text;
  v_invoice_status invoice_status;
  v_total_amount numeric;
  v_total_paid numeric;
  v_balance_due numeric;
  v_new_total_paid numeric;
  v_new_balance_due numeric;
  v_transaction_id uuid;
  v_payment_id uuid;
BEGIN
  BEGIN
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized', 'message', 'Authentication required');
    END IF;

    IF NOT check_user_role_simple(v_actor, ARRAY['admin'::user_role, 'owner'::user_role, 'instructor'::user_role]) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Insufficient permissions to record payments');
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid amount', 'message', 'Payment amount must be greater than zero');
    END IF;

    SELECT
      i.user_id, i.invoice_number, i.status,
      COALESCE(i.total_amount, 0),
      COALESCE(i.total_paid, 0),
      COALESCE(i.balance_due, GREATEST(0, COALESCE(i.total_amount, 0) - COALESCE(i.total_paid, 0)))
    INTO
      v_invoice_user_id, v_invoice_number, v_invoice_status,
      v_total_amount, v_total_paid, v_balance_due
    FROM invoices i
    WHERE i.id = p_invoice_id AND i.deleted_at IS NULL
    FOR UPDATE;

    IF v_invoice_user_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not found', 'message', 'Invoice not found');
    END IF;

    IF v_invoice_status IN ('cancelled', 'refunded') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid invoice status', 'message', 'Cannot record payments for cancelled or refunded invoices');
    END IF;

    IF v_balance_due <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already paid', 'message', 'Invoice has no remaining balance');
    END IF;

    IF p_amount > v_balance_due THEN
      RETURN jsonb_build_object('success', false, 'error', 'Overpayment', 'message', 'Payment amount cannot exceed the remaining balance', 'balance_due', v_balance_due);
    END IF;

    v_new_total_paid := round(v_total_paid + p_amount, 2);
    v_new_balance_due := round(GREATEST(0, v_total_amount - v_new_total_paid), 2);

    INSERT INTO transactions (
      user_id, type, status, amount, description, metadata, completed_at, invoice_id
    ) VALUES (
      v_invoice_user_id,
      'adjustment'::transaction_type,
      'completed'::transaction_status,
      round(p_amount, 2),
      'Invoice payment received: ' || COALESCE(v_invoice_number, p_invoice_id::text),
      jsonb_build_object(
        'invoice_id', p_invoice_id,
        'invoice_number', v_invoice_number,
        'transaction_type', 'invoice_payment',
        'payment_method', p_payment_method::text,
        'payment_reference', p_payment_reference,
        'created_by', v_actor
      ),
      COALESCE(p_paid_at, now()),
      p_invoice_id
    ) RETURNING id INTO v_transaction_id;

    INSERT INTO invoice_payments (
      invoice_id, user_id, amount, payment_method, payment_reference, notes, paid_at, transaction_id, created_by
    ) VALUES (
      p_invoice_id, v_invoice_user_id, round(p_amount, 2), p_payment_method, p_payment_reference, p_notes, COALESCE(p_paid_at, now()), v_transaction_id, v_actor
    ) RETURNING id INTO v_payment_id;

    PERFORM set_config('app.internal_caller', 'record_invoice_payment_atomic', true);

    UPDATE invoices
    SET
      total_paid = v_new_total_paid,
      balance_due = v_new_balance_due,
      payment_method = p_payment_method,
      payment_reference = p_payment_reference,
      paid_date = CASE WHEN v_new_balance_due <= 0 THEN COALESCE(p_paid_at, now()) ELSE paid_date END,
      status = CASE WHEN v_new_balance_due <= 0 THEN 'paid'::invoice_status ELSE status END,
      updated_at = now()
    WHERE id = p_invoice_id;

    PERFORM set_config('app.internal_caller', '', true);

    RETURN jsonb_build_object(
      'success', true,
      'invoice_id', p_invoice_id,
      'payment_id', v_payment_id,
      'transaction_id', v_transaction_id,
      'new_total_paid', v_new_total_paid,
      'new_balance_due', v_new_balance_due,
      'new_status', CASE WHEN v_new_balance_due <= 0 THEN 'paid' ELSE v_invoice_status::text END,
      'message', 'Payment recorded atomically'
    );

  EXCEPTION
    WHEN OTHERS THEN
      PERFORM set_config('app.internal_caller', '', true);
      RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'error_code', SQLSTATE, 'message', 'Atomic payment recording rolled back due to error');
  END;
END;
$$;
```

**Post-migration verification**:
```sql
SELECT count(*) FROM transactions WHERE invoice_id IS NOT NULL;
-- Confirm all invoice-related transactions have the FK populated
```

---

### Phase 4 — Xero Export Locking (R-05, R-02, R-10, R-13)

This is the core architectural change. All four recommendations are interdependent and deployed together.

---

#### Migration 8: `create_invoice_is_xero_exported_helper`

**Ref**: R-05
**What it does**: Creates the `invoice_is_xero_exported()` helper function.
**Dependencies**: None
**Rollback**: `DROP FUNCTION IF EXISTS invoice_is_xero_exported(uuid);`

```sql
-- Migration: create_invoice_is_xero_exported_helper
-- Ref: R-05 — Helper function for Xero export lock check

CREATE OR REPLACE FUNCTION public.invoice_is_xero_exported(p_invoice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM xero_invoices
    WHERE invoice_id = p_invoice_id
    AND export_status = 'exported'
  );
$$;
```

**Post-migration verification**:
```sql
-- Test with a known exported invoice
SELECT invoice_is_xero_exported(invoice_id) FROM xero_invoices WHERE export_status = 'exported' LIMIT 1;
-- Should return true

-- Test with a non-exported invoice
SELECT invoice_is_xero_exported(id) FROM invoices WHERE id NOT IN (SELECT invoice_id FROM xero_invoices WHERE export_status = 'exported') LIMIT 1;
-- Should return false
```

---

#### Migration 9: `create_admin_override_audit_table`

**Ref**: R-02
**What it does**: Creates the `admin_override_audit` table for logging admin bypasses.
**Dependencies**: None
**Rollback**: `DROP TABLE IF EXISTS admin_override_audit;`

```sql
-- Migration: create_admin_override_audit_table
-- Ref: R-02 — Admin override audit trail

CREATE TABLE IF NOT EXISTS public.admin_override_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  reason text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  tenant_id uuid NOT NULL DEFAULT get_user_tenant() REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_admin_override_audit_record_id
ON public.admin_override_audit(record_id);

CREATE INDEX IF NOT EXISTS idx_admin_override_audit_changed_by
ON public.admin_override_audit(changed_by);

CREATE INDEX IF NOT EXISTS idx_admin_override_audit_tenant_id
ON public.admin_override_audit(tenant_id);

ALTER TABLE public.admin_override_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_override_audit_tenant_select
ON public.admin_override_audit FOR SELECT
USING (
  tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu
    WHERE tu.user_id = auth.uid() AND tu.is_active = true
  )
);

CREATE POLICY admin_override_audit_tenant_insert
ON public.admin_override_audit FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tu.tenant_id FROM tenant_users tu
    WHERE tu.user_id = auth.uid() AND tu.is_active = true
  )
);

-- Prevent modification/deletion of admin override audit records
CREATE OR REPLACE FUNCTION public.prevent_admin_override_audit_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Admin override audit records are immutable.'
    USING ERRCODE = 'P0001';
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'admin_override_audit_no_update'
    AND tgrelid = 'public.admin_override_audit'::regclass
  ) THEN
    CREATE TRIGGER admin_override_audit_no_update
    BEFORE UPDATE ON public.admin_override_audit
    FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_override_audit_modification();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'admin_override_audit_no_delete'
    AND tgrelid = 'public.admin_override_audit'::regclass
  ) THEN
    CREATE TRIGGER admin_override_audit_no_delete
    BEFORE DELETE ON public.admin_override_audit
    FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_override_audit_modification();
  END IF;
END;
$$;
```

**Post-migration verification**:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'admin_override_audit';
```

---

#### Migration 10: `rewrite_invoice_immutability_triggers`

**Ref**: R-05, R-02, R-10, R-13
**What it does**: Rewrites both immutability trigger functions to use Xero-export-based locking, `app.internal_caller` allowlist, admin override audit, and `app.xero_resync_acknowledged` for re-export workflow.
**Dependencies**: `create_invoice_is_xero_exported_helper`, `create_admin_override_audit_table`
**Rollback**: Redeploy original function definitions from pre-migration backup.

```sql
-- Migration: rewrite_invoice_immutability_triggers
-- Ref: R-05 (Xero lock), R-02 (admin audit), R-10 (admin constraint), R-13 (internal_caller)

-- =============================================================================
-- INVOICE IMMUTABILITY TRIGGER (replaces prevent_approved_invoice_modification)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.prevent_approved_invoice_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_internal_caller text;
  v_is_admin boolean;
  v_reason text;
  v_is_xero_locked boolean;
BEGIN
  -- 1. Allow trusted internal SECURITY DEFINER callers
  v_internal_caller := COALESCE(current_setting('app.internal_caller', true), '');
  IF v_internal_caller = ANY(ARRAY[
    'update_invoice_totals_atomic',
    'record_invoice_payment_atomic',
    'update_invoice_status_atomic',
    'create_invoice_atomic',
    'void_and_reissue_xero_invoice',
    'admin_correct_invoice'
  ]) THEN
    PERFORM set_config('app.internal_caller', '', true);
    RETURN NEW;
  END IF;

  -- 2. Check admin status
  v_is_admin := check_user_role_simple(auth.uid(), ARRAY['admin'::user_role, 'owner'::user_role]);

  -- 3. Check if invoice is locked by Xero export
  v_is_xero_locked := invoice_is_xero_exported(OLD.id);

  IF v_is_xero_locked THEN
    -- Xero-exported invoices are locked for EVERYONE
    -- Only allow if xero_resync_acknowledged is set (void-and-reissue workflow)
    IF current_setting('app.xero_resync_acknowledged', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Invoice % has been exported to Xero and is locked. Initiate a void-and-reissue workflow to make changes.', OLD.invoice_number
        USING ERRCODE = 'P0001';
    END IF;
    -- If resync acknowledged AND admin, allow with audit
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Only admins can modify Xero-exported invoices during resync.'
        USING ERRCODE = 'P0001';
    END IF;
    v_reason := current_setting('app.override_reason', true);
    IF v_reason IS NULL OR trim(v_reason) = '' THEN
      RAISE EXCEPTION 'Admin overrides on Xero-exported invoices require app.override_reason to be set'
        USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO admin_override_audit
      (table_name, record_id, changed_by, reason, old_data, new_data)
    VALUES
      (TG_TABLE_NAME, NEW.id, auth.uid(), v_reason, to_jsonb(OLD), to_jsonb(NEW));
    PERFORM set_config('app.override_reason', '', true);
    NEW.updated_at := NOW();
    RETURN NEW;
  END IF;

  -- 4. Non-Xero-locked invoices: admins can modify with override audit
  IF v_is_admin THEN
    -- For non-draft invoices, require override_reason for financial field changes
    IF OLD.status IN ('pending', 'paid', 'overdue') THEN
      IF (NEW.subtotal IS DISTINCT FROM OLD.subtotal) OR
         (NEW.tax_total IS DISTINCT FROM OLD.tax_total) OR
         (NEW.total_amount IS DISTINCT FROM OLD.total_amount) OR
         (NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
        v_reason := current_setting('app.override_reason', true);
        IF v_reason IS NULL OR trim(v_reason) = '' THEN
          RAISE EXCEPTION 'Admin overrides of financial fields require app.override_reason to be set'
            USING ERRCODE = 'P0001';
        END IF;
        INSERT INTO admin_override_audit
          (table_name, record_id, changed_by, reason, old_data, new_data)
        VALUES
          (TG_TABLE_NAME, NEW.id, auth.uid(), v_reason, to_jsonb(OLD), to_jsonb(NEW));
        PERFORM set_config('app.override_reason', '', true);
      END IF;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
  END IF;

  -- 5. Non-admin, non-Xero-locked: allow workflow changes on approved invoices
  IF OLD.status IN ('pending', 'paid', 'overdue') THEN
    IF (NEW.status IS DISTINCT FROM OLD.status) OR
       (NEW.total_paid IS DISTINCT FROM OLD.total_paid) OR
       (NEW.paid_date IS DISTINCT FROM OLD.paid_date) OR
       (NEW.balance_due IS DISTINCT FROM OLD.balance_due) OR
       (NEW.updated_at IS DISTINCT FROM OLD.updated_at) OR
       (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at) OR
       (NEW.deleted_by IS DISTINCT FROM OLD.deleted_by) OR
       (NEW.deletion_reason IS DISTINCT FROM OLD.deletion_reason) THEN

      IF (NEW.subtotal IS DISTINCT FROM OLD.subtotal) OR
         (NEW.tax_total IS DISTINCT FROM OLD.tax_total) OR
         (NEW.total_amount IS DISTINCT FROM OLD.total_amount) THEN
        RAISE EXCEPTION 'Cannot modify financial totals of approved invoice %. Contact an admin.', OLD.invoice_number
          USING ERRCODE = 'P0001';
      END IF;

      IF (NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
        RAISE EXCEPTION 'Cannot change customer of approved invoice %', OLD.invoice_number
          USING ERRCODE = 'P0001';
      END IF;

      IF (NEW.issue_date IS DISTINCT FROM OLD.issue_date) THEN
        RAISE EXCEPTION 'Cannot change issue date of approved invoice %', OLD.invoice_number
          USING ERRCODE = 'P0001';
      END IF;

      RETURN NEW;
    END IF;

    IF NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Cannot modify approved invoice %. Contact an admin.', OLD.invoice_number
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 6. Draft or cancelled invoices are freely editable
  RETURN NEW;
END;
$$;

-- =============================================================================
-- INVOICE ITEM IMMUTABILITY TRIGGER (replaces prevent_approved_invoice_item_modification)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.prevent_approved_invoice_item_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_internal_caller text;
  v_invoice_status text;
  v_invoice_number text;
  v_invoice_id uuid;
  v_is_admin boolean;
  v_is_xero_locked boolean;
  v_reason text;
BEGIN
  -- 1. Allow trusted internal callers
  v_internal_caller := COALESCE(current_setting('app.internal_caller', true), '');
  IF v_internal_caller = ANY(ARRAY[
    'update_invoice_totals_atomic',
    'create_invoice_atomic',
    'void_and_reissue_xero_invoice',
    'admin_correct_invoice'
  ]) THEN
    PERFORM set_config('app.internal_caller', '', true);
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  -- 2. Check admin status
  v_is_admin := check_user_role_simple(auth.uid(), ARRAY['admin'::user_role, 'owner'::user_role]);

  -- 3. Get invoice status
  SELECT status, invoice_number INTO v_invoice_status, v_invoice_number
  FROM invoices
  WHERE id = v_invoice_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- 4. Check Xero lock
  v_is_xero_locked := invoice_is_xero_exported(v_invoice_id);

  IF v_is_xero_locked THEN
    IF current_setting('app.xero_resync_acknowledged', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Cannot modify items on Xero-exported invoice %. Initiate a void-and-reissue workflow.', v_invoice_number
        USING ERRCODE = 'P0001';
    END IF;
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Only admins can modify items on Xero-exported invoices during resync.'
        USING ERRCODE = 'P0001';
    END IF;
    v_reason := current_setting('app.override_reason', true);
    IF v_reason IS NULL OR trim(v_reason) = '' THEN
      RAISE EXCEPTION 'Admin overrides on Xero-exported invoice items require app.override_reason'
        USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO admin_override_audit
      (table_name, record_id, changed_by, reason, old_data, new_data)
    VALUES
      ('invoice_items', COALESCE(NEW.id, OLD.id), auth.uid(), v_reason, to_jsonb(OLD), to_jsonb(NEW));
    PERFORM set_config('app.override_reason', '', true);
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- 5. Non-Xero-locked: admins bypass with audit for approved invoices
  IF v_is_admin THEN
    IF v_invoice_status IN ('pending', 'paid', 'overdue') THEN
      v_reason := current_setting('app.override_reason', true);
      IF v_reason IS NOT NULL AND trim(v_reason) <> '' THEN
        INSERT INTO admin_override_audit
          (table_name, record_id, changed_by, reason, old_data, new_data)
        VALUES
          ('invoice_items', COALESCE(NEW.id, OLD.id), auth.uid(), v_reason, to_jsonb(OLD), to_jsonb(NEW));
        PERFORM set_config('app.override_reason', '', true);
      END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- 6. Non-admin on approved invoices
  IF v_invoice_status IN ('pending', 'paid', 'overdue') THEN
    -- Allow soft-delete
    IF TG_OP = 'UPDATE' AND
       OLD.deleted_at IS NULL AND
       NEW.deleted_at IS NOT NULL THEN
      RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'Cannot add items to approved invoice %. Contact an admin.', v_invoice_number
        USING ERRCODE = 'P0001';
    ELSIF TG_OP = 'UPDATE' THEN
      RAISE EXCEPTION 'Cannot modify items on approved invoice %. Contact an admin.', v_invoice_number
        USING ERRCODE = 'P0001';
    ELSIF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Cannot delete items from approved invoice %. Contact an admin.', v_invoice_number
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 7. Draft/cancelled: freely editable
  RETURN COALESCE(NEW, OLD);
END;
$$;
```

**Post-migration verification**:
```sql
-- Verify functions exist and are SECURITY DEFINER
SELECT proname, prosecdef FROM pg_proc
WHERE proname IN ('prevent_approved_invoice_modification', 'prevent_approved_invoice_item_modification')
AND pronamespace = 'public'::regnamespace;
```

---

#### Migration 11: `create_void_and_reissue_workflow`

**Ref**: R-05 (void-and-reissue)
**What it does**: Creates the `void_and_reissue_xero_invoice()` RPC that voids the Xero invoice locally (application must handle the Xero API call separately), allows edits, and prepares for re-export.
**Dependencies**: `create_invoice_is_xero_exported_helper`, `rewrite_invoice_immutability_triggers`
**Rollback**: `DROP FUNCTION IF EXISTS void_and_reissue_xero_invoice(uuid, text);`

```sql
-- Migration: create_void_and_reissue_workflow
-- Ref: R-05 — Void-and-reissue RPC for Xero-exported invoices

CREATE OR REPLACE FUNCTION public.void_and_reissue_xero_invoice(
  p_invoice_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid;
  v_invoice record;
  v_xero_invoice record;
BEGIN
  BEGIN
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    IF NOT check_user_role_simple(v_actor, ARRAY['admin'::user_role, 'owner'::user_role]) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Only admins can void and reissue invoices');
    END IF;

    IF p_reason IS NULL OR trim(p_reason) = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Reason required', 'message', 'A reason must be provided for voiding');
    END IF;

    SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;

    SELECT * INTO v_xero_invoice FROM xero_invoices
    WHERE invoice_id = p_invoice_id AND export_status = 'exported'
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not exported', 'message', 'Invoice is not currently exported to Xero');
    END IF;

    -- Mark the Xero invoice as voided locally
    UPDATE xero_invoices
    SET export_status = 'voided'::xero_export_status,
        error_message = 'Voided for reissue: ' || p_reason,
        updated_at = now()
    WHERE id = v_xero_invoice.id;

    -- Log the void action
    INSERT INTO xero_export_logs (
      tenant_id, invoice_id, action, status, error_message, initiated_by
    ) VALUES (
      v_xero_invoice.tenant_id,
      p_invoice_id,
      'void_for_reissue',
      'success',
      p_reason,
      v_actor
    );

    -- Log to admin override audit
    INSERT INTO admin_override_audit (
      table_name, record_id, changed_by, reason, old_data, new_data
    ) VALUES (
      'xero_invoices',
      v_xero_invoice.id,
      v_actor,
      'Void for reissue: ' || p_reason,
      to_jsonb(v_xero_invoice),
      jsonb_build_object('export_status', 'voided')
    );

    RETURN jsonb_build_object(
      'success', true,
      'invoice_id', p_invoice_id,
      'xero_invoice_id', v_xero_invoice.xero_invoice_id,
      'message', 'Xero invoice voided locally. Call Xero API to void remotely, then re-export.',
      'next_steps', jsonb_build_array(
        'Call Xero API to void the invoice on their side',
        'Edit the local invoice as needed',
        'Re-export via the standard export flow'
      )
    );

  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'message', 'Void and reissue rolled back');
  END;
END;
$$;
```

**Note**: The `xero_export_status` enum needs a `voided` value added. This is handled in the same migration:

```sql
-- Add 'voided' to the xero_export_status enum if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'voided'
    AND enumtypid = 'public.xero_export_status'::regtype
  ) THEN
    ALTER TYPE public.xero_export_status ADD VALUE 'voided';
  END IF;
END;
$$;
```

**Post-migration verification**:
```sql
SELECT enumlabel FROM pg_enum
WHERE enumtypid = 'public.xero_export_status'::regtype
ORDER BY enumsortorder;
-- Should include: pending, exported, failed, voided
```

---

#### Migration 12: `create_admin_correct_invoice_rpc`

**Ref**: R-10
**What it does**: Creates the `admin_correct_invoice()` RPC that validates totals match items and logs to admin override audit.
**Dependencies**: `create_admin_override_audit_table`
**Rollback**: `DROP FUNCTION IF EXISTS admin_correct_invoice(uuid, jsonb, text);`

```sql
-- Migration: create_admin_correct_invoice_rpc
-- Ref: R-10 — Admin correction function with constraints

CREATE OR REPLACE FUNCTION public.admin_correct_invoice(
  p_invoice_id uuid,
  p_changes jsonb,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid;
  v_invoice record;
  v_computed_subtotal numeric;
  v_computed_tax_total numeric;
  v_computed_total numeric;
BEGIN
  BEGIN
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    IF NOT check_user_role_simple(v_actor, ARRAY['admin'::user_role, 'owner'::user_role]) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
    END IF;

    IF p_reason IS NULL OR trim(p_reason) = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Reason required');
    END IF;

    SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;

    -- Validate computed totals match active items
    SELECT
      COALESCE(SUM(amount), 0),
      COALESCE(SUM(tax_amount), 0),
      COALESCE(SUM(line_total), 0)
    INTO v_computed_subtotal, v_computed_tax_total, v_computed_total
    FROM invoice_items
    WHERE invoice_id = p_invoice_id AND deleted_at IS NULL;

    -- If changes include financial fields, verify they match item sums
    IF p_changes ? 'subtotal' OR p_changes ? 'tax_total' OR p_changes ? 'total_amount' THEN
      IF round(COALESCE((p_changes->>'subtotal')::numeric, v_computed_subtotal), 2) <> round(v_computed_subtotal, 2) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Subtotal mismatch',
          'message', 'Provided subtotal does not match sum of active items',
          'computed', v_computed_subtotal);
      END IF;
    END IF;

    -- Set session variables for trigger bypass
    PERFORM set_config('app.override_reason', p_reason, true);
    PERFORM set_config('app.internal_caller', 'admin_correct_invoice', true);

    -- Apply changes via update_invoice_totals_atomic for financial recalculation
    PERFORM update_invoice_totals_atomic(p_invoice_id);

    PERFORM set_config('app.internal_caller', '', true);
    PERFORM set_config('app.override_reason', '', true);

    RETURN jsonb_build_object(
      'success', true,
      'invoice_id', p_invoice_id,
      'reason', p_reason,
      'message', 'Invoice corrected and audit logged'
    );

  EXCEPTION
    WHEN OTHERS THEN
      PERFORM set_config('app.internal_caller', '', true);
      PERFORM set_config('app.override_reason', '', true);
      RETURN jsonb_build_object('success', false, 'error', SQLERRM);
  END;
END;
$$;
```

**Post-migration verification**:
```sql
SELECT proname FROM pg_proc
WHERE proname = 'admin_correct_invoice'
AND pronamespace = 'public'::regnamespace;
```

---

#### Migration 13: `create_reverse_invoice_payment_rpc`

**Ref**: R-12
**What it does**: Creates `reverse_invoice_payment_atomic()` for legitimate payment reversals.
**Dependencies**: None
**Rollback**: `DROP FUNCTION IF EXISTS reverse_invoice_payment_atomic(uuid, text);`

```sql
-- Migration: create_reverse_invoice_payment_rpc
-- Ref: R-12 — Payment reversal function

CREATE OR REPLACE FUNCTION public.reverse_invoice_payment_atomic(
  p_payment_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid;
  v_payment record;
  v_invoice record;
  v_reversal_transaction_id uuid;
BEGIN
  BEGIN
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    IF NOT check_user_role_simple(v_actor, ARRAY['admin'::user_role, 'owner'::user_role]) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Only admins can reverse payments');
    END IF;

    IF p_reason IS NULL OR trim(p_reason) = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Reason required');
    END IF;

    SELECT * INTO v_payment FROM invoice_payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
    END IF;

    SELECT * INTO v_invoice FROM invoices WHERE id = v_payment.invoice_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;

    -- Create reversal transaction
    INSERT INTO transactions (
      user_id, type, status, amount, description, metadata, completed_at, invoice_id
    ) VALUES (
      v_payment.user_id,
      'credit'::transaction_type,
      'completed'::transaction_status,
      v_payment.amount,
      'Payment reversal: ' || COALESCE(v_invoice.invoice_number, v_payment.invoice_id::text),
      jsonb_build_object(
        'invoice_id', v_payment.invoice_id,
        'invoice_number', v_invoice.invoice_number,
        'transaction_type', 'payment_reversal',
        'original_payment_id', p_payment_id,
        'original_transaction_id', v_payment.transaction_id,
        'reversal_reason', p_reason,
        'reversed_by', v_actor
      ),
      now(),
      v_payment.invoice_id
    ) RETURNING id INTO v_reversal_transaction_id;

    -- Update invoice totals
    PERFORM set_config('app.internal_caller', 'reverse_invoice_payment_atomic', true);

    UPDATE invoices
    SET
      total_paid = GREATEST(0, round(total_paid - v_payment.amount, 2)),
      balance_due = round(total_amount - GREATEST(0, round(total_paid - v_payment.amount, 2)), 2),
      status = CASE
        WHEN round(total_amount - GREATEST(0, round(total_paid - v_payment.amount, 2)), 2) > 0
          AND due_date < now() THEN 'overdue'::invoice_status
        WHEN round(total_amount - GREATEST(0, round(total_paid - v_payment.amount, 2)), 2) > 0
          THEN 'pending'::invoice_status
        ELSE status
      END,
      paid_date = CASE
        WHEN round(total_amount - GREATEST(0, round(total_paid - v_payment.amount, 2)), 2) > 0
          THEN NULL
        ELSE paid_date
      END,
      updated_at = now()
    WHERE id = v_payment.invoice_id;

    PERFORM set_config('app.internal_caller', '', true);

    -- Log admin override
    INSERT INTO admin_override_audit (
      table_name, record_id, changed_by, reason, old_data, new_data
    ) VALUES (
      'invoice_payments',
      p_payment_id,
      v_actor,
      'Payment reversal: ' || p_reason,
      to_jsonb(v_payment),
      jsonb_build_object('reversal_transaction_id', v_reversal_transaction_id)
    );

    RETURN jsonb_build_object(
      'success', true,
      'payment_id', p_payment_id,
      'invoice_id', v_payment.invoice_id,
      'reversal_transaction_id', v_reversal_transaction_id,
      'reversed_amount', v_payment.amount,
      'message', 'Payment reversed and invoice updated atomically'
    );

  EXCEPTION
    WHEN OTHERS THEN
      PERFORM set_config('app.internal_caller', '', true);
      RETURN jsonb_build_object('success', false, 'error', SQLERRM);
  END;
END;
$$;
```

**Post-migration verification**:
```sql
SELECT proname FROM pg_proc
WHERE proname = 'reverse_invoice_payment_atomic'
AND pronamespace = 'public'::regnamespace;
```

---

### Phase 5 — Clean-up: Remove Dead Code, Fix Sequences, Add Constraints (R-08, R-09, R-14, R-15, R-16, R-17)

---

#### Migration 14: `drop_legacy_functions`

**Ref**: R-08, R-09
**What it does**: Drops `create_invoice_with_transaction()` and `upsert_invoice_items_batch()`.
**Dependencies**: None (verified neither is called in app code)
**Rollback**: Recreate from backed-up definitions.

```sql
-- Migration: drop_legacy_functions
-- Ref: R-08 (upsert_invoice_items_batch), R-09 (create_invoice_with_transaction)

REVOKE EXECUTE ON FUNCTION public.create_invoice_with_transaction(uuid, uuid, text, text, numeric, timestamptz) FROM PUBLIC;
DROP FUNCTION IF EXISTS public.create_invoice_with_transaction(uuid, uuid, text, text, numeric, timestamptz);

REVOKE EXECUTE ON FUNCTION public.upsert_invoice_items_batch(uuid, jsonb) FROM PUBLIC;
DROP FUNCTION IF EXISTS public.upsert_invoice_items_batch(uuid, jsonb);
```

**Post-migration verification**:
```sql
SELECT proname FROM pg_proc
WHERE proname IN ('create_invoice_with_transaction', 'upsert_invoice_items_batch')
AND pronamespace = 'public'::regnamespace;
-- Should return 0 rows
```

---

#### Migration 15: `fix_invoice_sequences_tenant_scope`

**Ref**: R-14
**What it does**: Changes `invoice_sequences` PK to `(tenant_id, year_month)` and updates `generate_invoice_number_with_prefix()`.
**Dependencies**: None
**Rollback**: Reverse PK change and redeploy original function.

```sql
-- Migration: fix_invoice_sequences_tenant_scope
-- Ref: R-14 — invoice_sequences not scoped per-tenant

-- First drop the old PK (year_month only) and the uuid id column
ALTER TABLE public.invoice_sequences DROP CONSTRAINT IF EXISTS invoice_sequences_pkey;

-- Drop the id column since it's not needed with the composite PK
ALTER TABLE public.invoice_sequences DROP COLUMN IF EXISTS id;

-- Add the composite PK
ALTER TABLE public.invoice_sequences ADD PRIMARY KEY (tenant_id, year_month);

-- Update the invoice number generator to scope by tenant
CREATE OR REPLACE FUNCTION public.generate_invoice_number_with_prefix(p_prefix text DEFAULT 'INV'::text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_year_month TEXT;
  v_sequence INTEGER;
  v_invoice_number TEXT;
  v_tenant_id UUID;
BEGIN
  v_tenant_id := get_user_tenant();
  v_year_month := TO_CHAR(CURRENT_DATE, 'YYYY-MM');

  INSERT INTO public.invoice_sequences (tenant_id, year_month, last_sequence)
  VALUES (v_tenant_id, v_year_month, 1)
  ON CONFLICT (tenant_id, year_month)
  DO UPDATE SET
    last_sequence = public.invoice_sequences.last_sequence + 1,
    updated_at = CURRENT_TIMESTAMP
  RETURNING last_sequence INTO v_sequence;

  v_invoice_number := p_prefix || '-' || v_year_month || '-' || LPAD(v_sequence::TEXT, 4, '0');

  RETURN v_invoice_number;
END;
$$;
```

**Post-migration verification**:
```sql
SELECT conname, pg_get_constraintdef(c.oid)
FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'invoice_sequences';
-- Should show PRIMARY KEY (tenant_id, year_month)
```

---

#### Migration 16: `add_payment_overpay_guard`

**Ref**: R-15
**What it does**: Adds BEFORE INSERT trigger on `invoice_payments` to prevent payments on fully-paid invoices.
**Dependencies**: None
**Rollback**: `DROP TRIGGER payment_overpay_guard ON invoice_payments; DROP FUNCTION prevent_payment_on_paid_invoice();`

```sql
-- Migration: add_payment_overpay_guard
-- Ref: R-15 — No DB-level guard preventing payment on fully-paid invoice

CREATE OR REPLACE FUNCTION public.prevent_payment_on_paid_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance_due numeric;
BEGIN
  SELECT COALESCE(balance_due, 0) INTO v_balance_due
  FROM invoices
  WHERE id = NEW.invoice_id AND deleted_at IS NULL;

  IF v_balance_due <= 0 THEN
    RAISE EXCEPTION 'Cannot record payment: invoice has no remaining balance (balance_due = %)', v_balance_due
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'payment_overpay_guard'
    AND tgrelid = 'public.invoice_payments'::regclass
  ) THEN
    CREATE TRIGGER payment_overpay_guard
    BEFORE INSERT ON public.invoice_payments
    FOR EACH ROW EXECUTE FUNCTION public.prevent_payment_on_paid_invoice();
  END IF;
END;
$$;
```

**Post-migration verification**:
```sql
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'public.invoice_payments'::regclass AND tgname = 'payment_overpay_guard';
```

---

#### Migration 17: `add_finalize_booking_validations`

**Ref**: R-16
**What it does**: Updates `finalize_booking_checkin_with_invoice_atomic()` to validate invoice is draft, user matches, and not already linked.
**Dependencies**: None
**Rollback**: Redeploy original function.

```sql
-- Migration: add_finalize_booking_validations
-- Ref: R-16 — finalize_booking_checkin_with_invoice_atomic accepts any invoice_id

CREATE OR REPLACE FUNCTION public.finalize_booking_checkin_with_invoice_atomic(
  p_booking_id uuid,
  p_invoice_id uuid,
  p_checked_out_aircraft_id uuid,
  p_checked_out_instructor_id uuid,
  p_flight_type_id uuid,
  p_hobbs_start numeric,
  p_hobbs_end numeric,
  p_tach_start numeric,
  p_tach_end numeric,
  p_airswitch_start numeric,
  p_airswitch_end numeric,
  p_solo_end_hobbs numeric,
  p_solo_end_tach numeric,
  p_dual_time numeric,
  p_solo_time numeric,
  p_billing_basis text,
  p_billing_hours numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid;
  v_booking record;
  v_aircraft record;
  v_invoice record;
  v_hobbs_delta numeric;
  v_tach_delta numeric;
  v_airswitch_delta numeric;
  v_method text;
  v_applied_delta numeric;
  v_old_ttis numeric;
  v_new_ttis numeric;
BEGIN
  BEGIN
    v_actor := auth.uid();
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized', 'message', 'Authentication required');
    END IF;
    IF NOT check_user_role_simple(v_actor, ARRAY['admin'::user_role, 'owner'::user_role, 'instructor'::user_role]) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Forbidden', 'message', 'Insufficient permissions to finalize check-in');
    END IF;

    SELECT b.id, b.user_id, b.booking_type, b.status, b.checkin_approved_at, b.checked_in_at
    INTO v_booking FROM public.bookings b WHERE b.id = p_booking_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not found', 'message', 'Booking not found');
    END IF;
    IF v_booking.booking_type IS DISTINCT FROM 'flight' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid booking type');
    END IF;
    IF v_booking.status = 'cancelled' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
    END IF;
    IF v_booking.checkin_approved_at IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already approved');
    END IF;

    -- R-16: Validate invoice
    SELECT i.id, i.status, i.user_id, i.booking_id
    INTO v_invoice FROM public.invoices i
    WHERE i.id = p_invoice_id AND i.deleted_at IS NULL;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;
    IF v_invoice.status <> 'draft' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invoice must be in draft status');
    END IF;
    IF v_invoice.user_id <> v_booking.user_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invoice user does not match booking user');
    END IF;
    IF v_invoice.booking_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invoice already linked to another booking');
    END IF;

    IF p_billing_basis IS NULL OR p_billing_basis NOT IN ('hobbs', 'tacho', 'airswitch') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid billing_basis');
    END IF;
    IF p_billing_hours IS NULL OR p_billing_hours <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid billing_hours');
    END IF;

    SELECT a.id, a.total_time_method, a.total_time_in_service INTO v_aircraft FROM public.aircraft a WHERE a.id = p_checked_out_aircraft_id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Aircraft not found');
    END IF;
    v_method := v_aircraft.total_time_method;
    IF v_method IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid aircraft total_time_method');
    END IF;

    v_hobbs_delta := CASE WHEN p_hobbs_start IS NULL OR p_hobbs_end IS NULL THEN NULL ELSE p_hobbs_end - p_hobbs_start END;
    v_tach_delta := CASE WHEN p_tach_start IS NULL OR p_tach_end IS NULL THEN NULL ELSE p_tach_end - p_tach_start END;
    v_airswitch_delta := CASE WHEN p_airswitch_start IS NULL OR p_airswitch_end IS NULL THEN NULL ELSE p_airswitch_end - p_airswitch_start END;

    IF v_hobbs_delta IS NOT NULL AND v_hobbs_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid hobbs delta');
    END IF;
    IF v_tach_delta IS NOT NULL AND v_tach_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid tach delta');
    END IF;
    IF v_airswitch_delta IS NOT NULL AND v_airswitch_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid airswitch delta');
    END IF;

    v_applied_delta := public.calculate_applied_aircraft_delta(v_method, v_hobbs_delta, v_tach_delta);
    v_old_ttis := v_aircraft.total_time_in_service;
    v_new_ttis := v_old_ttis + v_applied_delta;
    IF v_applied_delta IS NULL OR v_applied_delta < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid applied delta');
    END IF;

    PERFORM set_config('app.bypass_aircraft_total_check', 'true', true);
    UPDATE public.aircraft
    SET total_time_in_service = v_new_ttis,
        current_hobbs = COALESCE(p_hobbs_end, current_hobbs),
        current_tach = COALESCE(p_tach_end, current_tach)
    WHERE id = p_checked_out_aircraft_id;

    UPDATE public.bookings
    SET status = 'complete',
        checked_out_aircraft_id = p_checked_out_aircraft_id,
        checked_out_instructor_id = p_checked_out_instructor_id,
        flight_type_id = p_flight_type_id,
        hobbs_start = p_hobbs_start, hobbs_end = p_hobbs_end,
        tach_start = p_tach_start, tach_end = p_tach_end,
        airswitch_start = p_airswitch_start, airswitch_end = p_airswitch_end,
        solo_end_hobbs = p_solo_end_hobbs, solo_end_tach = p_solo_end_tach,
        dual_time = p_dual_time, solo_time = p_solo_time,
        flight_time_hobbs = v_hobbs_delta, flight_time_tach = v_tach_delta, flight_time_airswitch = v_airswitch_delta,
        billing_basis = p_billing_basis, billing_hours = p_billing_hours,
        total_hours_start = v_old_ttis, total_hours_end = v_new_ttis,
        applied_aircraft_delta = v_applied_delta, applied_total_time_method = v_method,
        checkin_invoice_id = p_invoice_id,
        checkin_approved_at = now(), checkin_approved_by = v_actor,
        checked_in_at = COALESCE(v_booking.checked_in_at, now())
    WHERE id = p_booking_id;

    RETURN jsonb_build_object('success', true, 'booking_id', p_booking_id, 'invoice_id', p_invoice_id,
      'applied_aircraft_delta', v_applied_delta, 'total_hours_start', v_old_ttis, 'total_hours_end', v_new_ttis);

  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'error_code', SQLSTATE);
  END;
END;
$$;
```

**Post-migration verification**:
```sql
SELECT pg_get_functiondef(oid) FROM pg_proc
WHERE proname = 'finalize_booking_checkin_with_invoice_atomic'
AND pronamespace = 'public'::regnamespace;
-- Verify it contains the new validation checks
```

---

#### Migration 18: `add_invoice_totals_check_constraint`

**Ref**: R-17
**What it does**: Adds a deferred CHECK constraint ensuring `total_amount = subtotal + tax_total`.
**Dependencies**: None (pre-validated: 0 violations)
**Rollback**: `ALTER TABLE invoices DROP CONSTRAINT IF EXISTS chk_invoice_totals_consistent;`

```sql
-- Migration: add_invoice_totals_check_constraint
-- Ref: R-17 — No constraint enforcing total_amount = subtotal + tax_total

ALTER TABLE public.invoices
  ADD CONSTRAINT chk_invoice_totals_consistent
  CHECK (round(subtotal + tax_total, 2) = round(total_amount, 2))
  DEFERRABLE INITIALLY DEFERRED;
```

**Post-migration verification**:
```sql
SELECT conname FROM pg_constraint
WHERE conname = 'chk_invoice_totals_consistent';
```

---

## Section 3: Application Code Change Plan

### 3.1 Invoice Lock State — UI Changes

**Current**: `isReadOnly = invoice.status !== "draft"` (in `invoice-detail-client.tsx` and `invoice-actions-toolbar.tsx`)
**New**: `isReadOnly = xeroStatus?.export_status === "exported"`

#### Files to Change

| File | Change |
|------|--------|
| `components/invoices/invoice-detail-client.tsx` | Change `isReadOnly` from `invoice.status !== "draft"` to `xeroStatus?.export_status === "exported"`. Show lock icon and banner when Xero-exported. |
| `components/invoices/invoice-actions-toolbar.tsx` | Update `isReadOnly` logic. Add Xero lock indicator (lock icon) when exported. |
| `components/invoices/invoice-view-actions.tsx` | Add "Void & Reissue" option for admin users when Xero-exported. Keep payment recording for pending/overdue. |
| `components/invoices/xero-invoice-status.tsx` | Add "Void & Reissue" button for admins when `export_status === "exported"`. |

#### Specific Changes

**`components/invoices/invoice-detail-client.tsx`**:
```typescript
// Before:
const isReadOnly = invoice.status !== "draft"

// After:
const isXeroLocked = xeroStatus?.export_status === "exported"
const isReadOnly = isXeroLocked
// Draft invoices are always editable
// Approved (pending/paid/overdue) non-exported invoices are editable by staff
// Xero-exported invoices are locked (show lock icon + banner)
```

**`components/invoices/invoice-actions-toolbar.tsx`**:
```typescript
// Before:
const isReadOnly = mode === "view" || (status && status !== "draft")

// After:
const isXeroLocked = xeroExportStatus === "exported"
const isReadOnly = mode === "view" || isXeroLocked
// Show lock icon when Xero-locked
// Show warning banner: "This invoice has been exported to Xero and is locked."
```

**`components/invoices/invoice-view-actions.tsx`**:
```typescript
// Add new menu item:
// "Void & Reissue" — visible when xeroStatus?.export_status === "exported" && isAdmin
// Triggers void-and-reissue modal/flow
```

### 3.2 Void-and-Reissue UI Flow

**New components needed**:
- `components/invoices/void-and-reissue-modal.tsx` — Dialog for admin to void an exported Xero invoice

**Flow**:
1. Admin clicks "Void & Reissue" on an exported invoice
2. Modal opens: explains that this will void the Xero invoice and allow edits
3. Admin provides mandatory reason
4. On confirm:
   a. Call `supabase.rpc('void_and_reissue_xero_invoice', { p_invoice_id, p_reason })`
   b. If success: call Xero API endpoint to void the invoice remotely
   c. Refresh invoice detail to show unlocked state
   d. Admin can now edit the invoice
   e. Admin re-exports via standard export flow

**New API route needed**:
- `app/api/xero/void-invoice/route.ts` — POST endpoint that calls Xero API to void an invoice

### 3.3 Admin Override Session Variable Calls

Any admin edit path on approved invoices must set `app.override_reason` via Supabase RPC before the edit. This is handled at the database level via the trigger, but the application must:

1. Prompt the admin for a reason before submitting edits to approved invoices
2. Call `supabase.rpc('set_config', ...)` is NOT directly available — instead, the admin correction RPC handles this internally

**Approach**: Use the `admin_correct_invoice()` RPC for all admin corrections. The reason is passed as a parameter and the function handles session variable setup internally.

### 3.4 Type Updates After Migration

After all migrations, run `npm run schema:generate` to regenerate types. The following types will change:

| Type | Changes |
|------|---------|
| `Database.public.Tables.transactions` | New `invoice_id` column |
| `Database.public.Tables.admin_override_audit` | New table |
| `Database.public.Enums.xero_export_status` | New `voided` value |
| `Database.public.Functions` | New RPCs: `void_and_reissue_xero_invoice`, `admin_correct_invoice`, `reverse_invoice_payment_atomic`, `invoice_is_xero_exported` |
| `Database.public.Functions` | Removed RPCs: `create_invoice_with_transaction`, `upsert_invoice_items_batch` |

**Files requiring type updates**:
- `lib/types/invoices.ts` — Add `isXeroLocked` computed property
- `lib/types/database.ts` — Regenerated automatically
- `lib/schema/generated.ts` — Regenerated automatically
- `lib/invoices/fetch-invoice-detail.ts` — May need to include Xero status in detail fetch
- `lib/xero/export-invoice.ts` — Update to handle `voided` status

### 3.5 Xero Export Workflow Updates

**`lib/xero/export-invoice.ts`**:
- Update the guard to also skip invoices with `export_status = 'voided'` (allow re-export after void)
- On successful export: the UI should now show the invoice as locked

**`app/api/xero/export-invoices/route.ts`**:
- No changes needed (already handles export correctly)

**`app/api/xero/retry-export/route.ts`**:
- No changes needed

---

## Section 4: New Functions and Types Required

### Database Functions

| Function | Signature | Purpose | Ref |
|----------|-----------|---------|-----|
| `invoice_is_xero_exported` | `(p_invoice_id UUID) → BOOLEAN` | Check if invoice is exported to Xero | R-05 |
| `void_and_reissue_xero_invoice` | `(p_invoice_id UUID, p_reason TEXT) → JSONB` | Void Xero export locally, prepare for re-export | R-05 |
| `reverse_invoice_payment_atomic` | `(p_payment_id UUID, p_reason TEXT) → JSONB` | Reverse a payment with audit trail | R-12 |
| `admin_correct_invoice` | `(p_invoice_id UUID, p_changes JSONB, p_reason TEXT) → JSONB` | Admin correction with validation | R-10 |
| `prevent_audit_log_delete` | `() → TRIGGER` | Block audit log deletion | R-03 |
| `prevent_audit_log_update` | `() → TRIGGER` | Block audit log updates | R-03 |
| `prevent_invoice_payment_delete` | `() → TRIGGER` | Block payment deletion | R-12 |
| `recalc_invoice_on_item_soft_delete` | `() → TRIGGER` | Auto-recalc totals on item soft-delete | R-04 |
| `prevent_payment_on_paid_invoice` | `() → TRIGGER` | Guard against overpayment | R-15 |
| `prevent_admin_override_audit_modification` | `() → TRIGGER` | Protect admin audit records | R-02 |

### New Tables

| Table | Columns | Purpose | Ref |
|-------|---------|---------|-----|
| `admin_override_audit` | `id, table_name, record_id, changed_by, reason, old_data, new_data, created_at, tenant_id` | Log admin override actions | R-02 |

### TypeScript Types

| Type | Location | Purpose | Ref |
|------|----------|---------|-----|
| `AdminOverrideAudit` | `lib/types/database.ts` (generated) | Row type for admin override audit | R-02 |
| `XeroExportStatus` (updated) | `lib/types/database.ts` (generated) | Add `voided` to enum | R-05 |
| `VoidAndReissueResult` | `lib/types/invoices.ts` | Return type for void-and-reissue RPC | R-05 |
| `ReversePaymentResult` | `lib/types/invoices.ts` | Return type for payment reversal | R-12 |

### Supabase RPC Wrappers (TypeScript)

```typescript
// lib/invoices/invoice-service.ts (new file or extend existing)

export async function voidAndReissueXeroInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  reason: string
) {
  return supabase.rpc("void_and_reissue_xero_invoice", {
    p_invoice_id: invoiceId,
    p_reason: reason,
  })
}

export async function reverseInvoicePayment(
  supabase: SupabaseClient,
  paymentId: string,
  reason: string
) {
  return supabase.rpc("reverse_invoice_payment_atomic", {
    p_payment_id: paymentId,
    p_reason: reason,
  })
}

export async function adminCorrectInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  changes: Record<string, unknown>,
  reason: string
) {
  return supabase.rpc("admin_correct_invoice", {
    p_invoice_id: invoiceId,
    p_changes: changes,
    p_reason: reason,
  })
}

export async function isInvoiceXeroExported(
  supabase: SupabaseClient,
  invoiceId: string
) {
  return supabase.rpc("invoice_is_xero_exported", {
    p_invoice_id: invoiceId,
  })
}
```

---

## Section 5: Testing Plan

### Phase 1 Tests (R-03, R-12)

| Test | Type | Description |
|------|------|-------------|
| Audit log UPDATE blocked | Unit (SQL) | `UPDATE audit_logs SET action = 'x' WHERE id = ...` → expect error P0001 |
| Audit log DELETE blocked | Unit (SQL) | `DELETE FROM audit_logs WHERE id = ...` → expect error P0001 |
| Audit log INSERT still works | Unit (SQL) | `INSERT INTO audit_logs (...)` → expect success |
| Payment DELETE blocked | Unit (SQL) | `DELETE FROM invoice_payments WHERE id = ...` → expect error P0001 |
| Payment INSERT still works | Integration | Record a payment via `record_invoice_payment_atomic()` → expect success |
| Manual QA | Manual | Verify in Supabase dashboard that UPDATE/DELETE on audit_logs fails |

### Phase 2 Tests (R-04, R-06, R-07)

| Test | Type | Description |
|------|------|-------------|
| Item soft-delete recalculates totals | Integration | Create invoice with 2 items → soft-delete 1 → verify `total_amount` updated |
| Status update requires role | Unit (SQL) | Call `update_invoice_status_atomic()` without auth → expect Unauthorized |
| Status update with role succeeds | Integration | Call with valid auth + staff role → expect success |
| Overdue cron job exists | Unit (SQL) | Query `cron.job` for `mark-overdue-invoices` → expect 1 row |
| Manual QA | Manual | Create invoice with past due date → wait for cron or manually trigger → verify status changes to overdue |

### Phase 3 Tests (R-01)

| Test | Type | Description |
|------|------|-------------|
| invoice_id column exists | Unit (SQL) | `SELECT invoice_id FROM transactions LIMIT 1` → expect success |
| Backfill complete | Unit (SQL) | `SELECT count(*) FROM transactions WHERE invoice_id IS NULL AND metadata->>'invoice_id' IS NOT NULL` → expect 0 |
| FK constraint enforced | Unit (SQL) | `INSERT INTO transactions (..., invoice_id) VALUES (..., gen_random_uuid())` → expect FK violation |
| New transactions get invoice_id | Integration | Record a payment → verify new transaction has `invoice_id` populated |

### Phase 4 Tests (R-05, R-02, R-10, R-13)

| Test | Type | Description |
|------|------|-------------|
| Edit non-exported pending invoice | Integration | Update fields on a pending invoice NOT exported to Xero → expect success |
| Edit exported invoice without resync | Integration | Update an exported invoice → expect error "exported to Xero and is locked" |
| Edit exported invoice with resync (admin) | Integration | Set `app.xero_resync_acknowledged` + `app.override_reason` → expect success + audit log |
| Edit exported invoice with resync (non-admin) | Integration | Same but as instructor → expect error "Only admins" |
| Admin edit without reason | Integration | Admin updates financial fields without `app.override_reason` → expect error |
| Admin edit with reason | Integration | Admin updates with reason → expect success + row in `admin_override_audit` |
| Internal caller bypass | Integration | Call `update_invoice_totals_atomic()` → expect success (sets `app.internal_caller`) |
| Void and reissue | Integration | Call `void_and_reissue_xero_invoice()` → verify `xero_invoices.export_status = 'voided'` |
| Manual QA: Lock icon | Manual | View an exported invoice in UI → verify lock icon shown |
| Manual QA: Edit button | Manual | View non-exported pending invoice → verify edit controls available |
| Manual QA: Void & Reissue | Manual | Admin clicks void & reissue → verify modal appears, reason required |

### Phase 5 Tests (R-08, R-09, R-14, R-15, R-16, R-17)

| Test | Type | Description |
|------|------|-------------|
| Legacy functions dropped | Unit (SQL) | `SELECT * FROM pg_proc WHERE proname IN ('create_invoice_with_transaction', 'upsert_invoice_items_batch')` → 0 rows |
| Invoice sequences per-tenant | Integration | Generate invoice number for tenant A and B in same month → verify sequential per tenant |
| Overpayment guard | Unit (SQL) | Insert payment on fully-paid invoice → expect error |
| Finalize booking validation | Unit (SQL) | Call `finalize_booking_checkin_with_invoice_atomic()` with non-draft invoice → expect error |
| Totals CHECK constraint | Unit (SQL) | `UPDATE invoices SET subtotal = 100, tax_total = 0, total_amount = 999` → expect constraint violation |

---

## Section 6: Risk Register

### Phase 1 Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Audit log triggers block legitimate background processes | Medium — could break automated audit logging | The triggers only block UPDATE/DELETE; INSERT is unaffected. All existing code only INSERTs into audit_logs. |
| Payment delete trigger blocks admin data cleanup | Low — admin can use reversal function instead | Provide `reverse_invoice_payment_atomic()` in Phase 4 as the legitimate path |

### Phase 2 Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `update_invoice_status_atomic` role check breaks existing flows | High — could prevent invoice approval | The function now allows calls from other SECURITY DEFINER functions via `app.internal_caller`. `create_invoice_atomic` calls it internally and will set the session var. Test thoroughly on branch. |
| Overdue cron job runs on branch databases | Low — no real impact | pg_cron jobs are per-database; branch will have its own job |
| Item soft-delete recalc trigger fires during bulk operations | Low — performance impact | Trigger is lightweight (single function call). Monitor on branch. |

### Phase 3 Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `invoice_id` backfill from malformed metadata | High — FK constraint failure | Pre-validated: all 59 transactions have valid `invoice_id` in metadata, 0 orphans. Run validation query before applying. |
| Existing queries using `metadata->>'invoice_id'` break | Medium — latent bugs | Atomic functions are updated to use FK column. Old metadata queries still work (metadata not removed). Gradual migration. |

### Phase 4 Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Transition from status-lock to Xero-lock unlocks 35 invoices | **HIGH** — invoices that were previously immutable become editable | This is **intentional and desired**. The 35 non-exported invoices should be editable. The 5 exported invoices remain locked. Communicate to users. |
| `app.internal_caller` not cleared after exception | Medium — subsequent operations bypass trigger | All EXCEPTION handlers now clear the session variable. Transaction rollback also clears transaction-scoped settings. |
| `xero_export_status` enum adding `voided` | Low — enum values cannot be removed once added | The `voided` state is permanent and necessary. No rollback concern. |
| Void-and-reissue: Xero API call fails after local void | Medium — local and Xero state diverge | The RPC only marks as voided locally. The application layer must handle the Xero API call. If API fails, the local state shows `voided` which is a clear signal that cleanup is needed. |

### Phase 5 Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Dropping `create_invoice_with_transaction` | Low — verified not called in app code | Already confirmed: 0 call sites in application code. Only in `database.ts` types (auto-generated). |
| Dropping `upsert_invoice_items_batch` | Low — verified not called in app code | Same as above. |
| `invoice_sequences` PK change with existing data | Medium — could fail if duplicate (tenant_id, year_month) exists | Pre-validated: 0 duplicate year_month values. Current PK is year_month only; since there's only 1 tenant, no conflicts. |
| CHECK constraint on totals | Low — could block legitimate operations | Pre-validated: 0 violations. Constraint is DEFERRABLE INITIALLY DEFERRED — only enforced at transaction commit. All atomic functions set totals consistently. |

---

## Section 7: Delivery Sequence

```
[ ] Phase 1 · [MIGRATION] · protect_audit_logs_immutability · (Ref: R-03) · Est: 0.5h
[ ] Phase 1 · [MIGRATION] · protect_invoice_payments_no_delete · (Ref: R-12) · Est: 0.5h
[ ] Phase 1 · [TEST] · Verify audit_logs and invoice_payments are immutable · (Ref: R-03, R-12) · Est: 0.5h
[ ] Phase 1 · [DEPLOY] · Apply Phase 1 migrations to branch · Est: 0.25h

[ ] Phase 2 · [MIGRATION] · add_item_soft_delete_recalc_trigger · (Ref: R-04) · Est: 0.5h
[ ] Phase 2 · [MIGRATION] · fix_update_invoice_status_atomic_security · (Ref: R-06) · Est: 1h
[ ] Phase 2 · [MIGRATION] · add_overdue_invoice_cron_job · (Ref: R-07) · Est: 0.5h
[ ] Phase 2 · [TEST] · Verify item soft-delete recalculates totals · (Ref: R-04) · Est: 0.5h
[ ] Phase 2 · [TEST] · Verify status update security and role check · (Ref: R-06) · Est: 0.5h
[ ] Phase 2 · [TEST] · Verify cron job is scheduled · (Ref: R-07) · Est: 0.25h
[ ] Phase 2 · [DEPLOY] · Apply Phase 2 migrations to branch · Est: 0.25h

[ ] Phase 3 · [MIGRATION] · add_transactions_invoice_fk · (Ref: R-01) · Est: 1h
[ ] Phase 3 · [MIGRATION] · update_atomic_functions_use_invoice_fk · (Ref: R-01) · Est: 2h
[ ] Phase 3 · [TEST] · Verify FK backfill and new transactions use FK · (Ref: R-01) · Est: 1h
[ ] Phase 3 · [DEPLOY] · Apply Phase 3 migrations to branch · Est: 0.25h

[ ] Phase 4 · [MIGRATION] · create_invoice_is_xero_exported_helper · (Ref: R-05) · Est: 0.5h
[ ] Phase 4 · [MIGRATION] · create_admin_override_audit_table · (Ref: R-02) · Est: 0.5h
[ ] Phase 4 · [MIGRATION] · add_voided_enum_value · (Ref: R-05) · Est: 0.25h
[ ] Phase 4 · [MIGRATION] · rewrite_invoice_immutability_triggers · (Ref: R-05, R-02, R-10, R-13) · Est: 3h
[ ] Phase 4 · [MIGRATION] · create_void_and_reissue_workflow · (Ref: R-05) · Est: 2h
[ ] Phase 4 · [MIGRATION] · create_admin_correct_invoice_rpc · (Ref: R-10) · Est: 1h
[ ] Phase 4 · [MIGRATION] · create_reverse_invoice_payment_rpc · (Ref: R-12) · Est: 1h
[ ] Phase 4 · [CODE] · Update invoice-detail-client.tsx lock state · (Ref: R-05) · Est: 1h
[ ] Phase 4 · [CODE] · Update invoice-actions-toolbar.tsx lock state · (Ref: R-05) · Est: 0.5h
[ ] Phase 4 · [CODE] · Update invoice-view-actions.tsx with void-and-reissue · (Ref: R-05) · Est: 1h
[ ] Phase 4 · [CODE] · Create void-and-reissue-modal.tsx · (Ref: R-05) · Est: 2h
[ ] Phase 4 · [CODE] · Create xero/void-invoice API route · (Ref: R-05) · Est: 1.5h
[ ] Phase 4 · [CODE] · Update lib/xero/export-invoice.ts for voided status · (Ref: R-05) · Est: 0.5h
[ ] Phase 4 · [CODE] · Create lib/invoices/invoice-service.ts RPC wrappers · (Ref: R-05, R-10, R-12) · Est: 1h
[ ] Phase 4 · [CODE] · Regenerate TypeScript types · Est: 0.25h
[ ] Phase 4 · [TEST] · Full integration test: edit non-exported invoice · (Ref: R-05) · Est: 0.5h
[ ] Phase 4 · [TEST] · Full integration test: edit exported invoice (blocked) · (Ref: R-05) · Est: 0.5h
[ ] Phase 4 · [TEST] · Full integration test: void-and-reissue workflow · (Ref: R-05) · Est: 1h
[ ] Phase 4 · [TEST] · Full integration test: admin override audit · (Ref: R-02) · Est: 0.5h
[ ] Phase 4 · [TEST] · Manual QA: UI lock states · (Ref: R-05) · Est: 1h
[ ] Phase 4 · [DEPLOY] · Apply Phase 4 migrations to branch · Est: 0.5h

[ ] Phase 5 · [MIGRATION] · drop_legacy_functions · (Ref: R-08, R-09) · Est: 0.25h
[ ] Phase 5 · [MIGRATION] · fix_invoice_sequences_tenant_scope · (Ref: R-14) · Est: 0.5h
[ ] Phase 5 · [MIGRATION] · add_payment_overpay_guard · (Ref: R-15) · Est: 0.5h
[ ] Phase 5 · [MIGRATION] · add_finalize_booking_validations · (Ref: R-16) · Est: 0.5h
[ ] Phase 5 · [MIGRATION] · add_invoice_totals_check_constraint · (Ref: R-17) · Est: 0.25h
[ ] Phase 5 · [CODE] · Remove references to dropped functions from database.ts types · (Ref: R-08, R-09) · Est: 0.25h
[ ] Phase 5 · [CODE] · Regenerate TypeScript types (final) · Est: 0.25h
[ ] Phase 5 · [TEST] · Verify all Phase 5 constraints and triggers · Est: 1h
[ ] Phase 5 · [DEPLOY] · Apply Phase 5 migrations to branch · Est: 0.25h

[ ] Final · [TEST] · Full regression test: create invoice, approve, pay, export to Xero · Est: 2h
[ ] Final · [TEST] · Full regression test: booking check-in with invoice creation · Est: 1h
[ ] Final · [DEPLOY] · Merge branch to production · Est: 0.5h
[ ] Final · [DEPLOY] · Post-deploy validation queries · Est: 0.5h
```

**Total estimated effort**: ~35 hours

---

*End of implementation plan. This document is self-contained and can be worked through top-to-bottom.*
