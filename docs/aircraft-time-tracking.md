# Aircraft Time Tracking System

> **Last updated:** February 2026

This document describes how FlightDesk tracks aircraft flight hours and Total Time In Service (TTIS). It covers every table, column, view, function, trigger, and RLS policy involved, how they interact, and the business rules they enforce.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Core Tables](#2-core-tables)
   - [aircraft](#21-aircraft)
   - [bookings (flight ledger)](#22-bookings-flight-ledger)
   - [aircraft_ttis_audit](#23-aircraft_ttis_audit)
3. [Views](#3-views)
   - [aircraft_ttis_rollup](#31-aircraft_ttis_rollup)
4. [Enums](#4-enums)
5. [Pure Functions](#5-pure-functions)
   - [calculate_applied_aircraft_delta](#51-calculate_applied_aircraft_delta)
6. [Atomic RPC Functions](#6-atomic-rpc-functions)
   - [approve_booking_checkin_atomic](#61-approve_booking_checkin_atomic)
   - [correct_booking_checkin_ttis_atomic](#62-correct_booking_checkin_ttis_atomic)
   - [finalize_booking_checkin_with_invoice_atomic](#63-finalize_booking_checkin_with_invoice_atomic)
7. [Diagnostic / Reporting Functions](#7-diagnostic--reporting-functions)
   - [recompute_aircraft_ttis_from_ledger](#71-recompute_aircraft_ttis_from_ledger)
   - [find_aircraft_with_suspicious_ttis](#72-find_aircraft_with_suspicious_ttis)
   - [get_aircraft_maintenance_cost_report](#73-get_aircraft_maintenance_cost_report)
8. [Triggers](#8-triggers)
   - [Aircraft triggers](#81-aircraft-triggers)
   - [Booking triggers](#82-booking-triggers)
9. [Row-Level Security (RLS)](#9-row-level-security-rls)
10. [Business Logic Walkthrough](#10-business-logic-walkthrough)
    - [Normal check-in flow](#101-normal-check-in-flow)
    - [Post-approval correction flow](#102-post-approval-correction-flow)
    - [Booking deletion with TTIS reversal](#103-booking-deletion-with-ttis-reversal)
11. [Next.js Integration](#11-nextjs-integration)
12. [TTIS Integrity Model](#12-ttis-integrity-model)
13. [Column Reference: Source-of-Truth vs Derived](#13-column-reference-source-of-truth-vs-derived)

---

## 1. System Overview

```
                        ┌──────────────────────────────────┐
                        │         Next.js API Route        │
                        │  POST /api/bookings/[id]/        │
                        │       checkin/approve             │
                        └──────────┬───────────────────────┘
                                   │ supabase.rpc(
                                   │   "approve_booking_checkin_atomic", ...)
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    PostgreSQL (single transaction)                       │
│                                                                         │
│  1. Lock booking row         (SELECT ... FOR UPDATE)                    │
│  2. Lock aircraft row        (SELECT ... FOR UPDATE)                    │
│  3. Compute deltas           (calculate_applied_aircraft_delta)         │
│  4. Create invoice           (create_invoice_atomic)                    │
│  5. Update aircraft TTIS     (total_time_in_service += delta)           │
│  6. Update booking ledger    (write all readings, deltas, snapshots)    │
│  7. Triggers fire:                                                      │
│     ├─ reject_direct_aircraft_total_updates  (bypass flag set)          │
│     ├─ validate_aircraft_ttis_update         (sanity check)             │
│     ├─ log_aircraft_ttis_change              (audit row written)        │
│     └─ prevent_approved_checkin_mutations     (future-proofs record)    │
│                                                                         │
│  All succeed → COMMIT   │   Any fail → full ROLLBACK                    │
└─────────────────────────────────────────────────────────────────────────┘

Verification (offline / admin):
  aircraft_ttis_rollup view  →  initial_ttis + SUM(deltas) == stored TTIS?
  find_aircraft_with_suspicious_ttis()  →  flags discrepancies
```

---

## 2. Core Tables

### 2.1 aircraft

The aircraft table stores the current state of each aircraft, including its time-tracking configuration and cached meter readings.

**Time-tracking columns:**

| Column | Type | Nullable | Default | Role |
|--------|------|----------|---------|------|
| `total_time_method` | `total_time_method` (enum) | YES | — | Configures which meter drives TTIS (see [Enums](#4-enums)) |
| `initial_total_time_in_service` | `numeric` | NO | `0` | Baseline TTIS when the aircraft entered the system. Immutable after setup. Used for ledger-based TTIS verification. |
| `total_time_in_service` | `numeric` | NO | `0` | **Materialized cache** of current TTIS. Updated atomically by RPCs. Protected by triggers. |
| `current_hobbs` | `numeric` | NO | `0` | Last known Hobbs meter reading (snapshot, updated on check-in) |
| `current_tach` | `numeric` | NO | `0` | Last known tachometer reading (snapshot, updated on check-in) |
| `record_tacho` | `boolean` | NO | `false` | Whether this aircraft captures tach readings during check-in |
| `record_hobbs` | `boolean` | NO | `false` | Whether this aircraft captures Hobbs readings during check-in |
| `record_airswitch` | `boolean` | NO | `false` | Whether this aircraft captures airswitch readings during check-in |

**Key relationships:**
- `bookings.checked_out_aircraft_id → aircraft.id` (one-to-many: each booking references the aircraft it flew)
- `aircraft_ttis_audit.aircraft_id → aircraft.id`

---

### 2.2 bookings (flight ledger)

Each completed flight booking is an entry in the flight ledger. The bookings table stores the raw meter readings (source of truth), computed deltas, and a snapshot of what was applied to the aircraft's TTIS.

**Source-of-truth columns (raw readings from the pilot):**

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| `hobbs_start` | `numeric` | YES | Hobbs meter at engine start |
| `hobbs_end` | `numeric` | YES | Hobbs meter at engine stop |
| `tach_start` | `numeric` | YES | Tachometer at engine start |
| `tach_end` | `numeric` | YES | Tachometer at engine stop |
| `airswitch_start` | `numeric` | YES | Airswitch at takeoff |
| `airswitch_end` | `numeric` | YES | Airswitch at landing |
| `solo_end_hobbs` | `numeric` | YES | Hobbs reading where solo portion ended (split flights) |
| `solo_end_tach` | `numeric` | YES | Tach reading where solo portion ended |

**Derived columns (computed by the database, not the client):**

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| `flight_time_hobbs` | `numeric` | YES | `hobbs_end - hobbs_start` |
| `flight_time_tach` | `numeric` | YES | `tach_end - tach_start` |
| `flight_time_airswitch` | `numeric` | YES | `airswitch_end - airswitch_start` |
| `applied_aircraft_delta` | `numeric` | YES | The delta applied to the aircraft's TTIS, computed via `calculate_applied_aircraft_delta()` using the aircraft's `total_time_method` |
| `applied_total_time_method` | `text` | YES | Snapshot of the `total_time_method` in effect when this booking was approved (ensures historical reproducibility) |

**TTIS snapshot columns:**

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| `total_hours_start` | `numeric` | YES | Aircraft TTIS *before* this flight's delta was applied |
| `total_hours_end` | `numeric` | YES | Aircraft TTIS *after* this flight's delta was applied |

**Billing columns:**

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| `billing_basis` | `text` | YES | Which meter is used for billing (`hobbs`, `tacho`, or `airswitch`) |
| `billing_hours` | `numeric` | YES | The billable hours for the flight |
| `dual_time` | `numeric` | YES | Hours of dual instruction |
| `solo_time` | `numeric` | YES | Hours of solo flight |

**Lifecycle / audit columns:**

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| `status` | `booking_status` (enum) | NO | Current state: `unconfirmed`, `confirmed`, `checked_in`, `complete`, `cancelled` |
| `checked_in_at` | `timestamptz` | YES | When the booking was first checked in by the pilot/instructor |
| `checked_in_by` | `uuid` | YES | Who performed the check-in |
| `checkin_approved_at` | `timestamptz` | YES | When an admin/instructor approved the check-in and finalized TTIS |
| `checkin_approved_by` | `uuid` | YES | Who approved |
| `checkin_invoice_id` | `uuid` | YES | FK to the invoice generated at approval |

**Correction columns (for post-approval fixes):**

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| `correction_delta` | `numeric` | YES | The net change in `applied_aircraft_delta` from a correction |
| `corrected_at` | `timestamptz` | YES | When the correction was made |
| `corrected_by` | `uuid` | YES | Who made the correction |
| `correction_reason` | `text` | YES | Mandatory reason for the correction |

---

### 2.3 aircraft_ttis_audit

An append-only audit log. A row is inserted automatically (via trigger) every time an aircraft's `total_time_in_service`, `current_tach`, or `current_hobbs` changes.

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| `id` | `uuid` | NO | Primary key |
| `aircraft_id` | `uuid` | NO | FK to `aircraft` |
| `user_id` | `uuid` | YES | `auth.uid()` at the time of the change |
| `old_ttis` | `numeric` | YES | Previous `total_time_in_service` value |
| `new_ttis` | `numeric` | YES | New `total_time_in_service` value |
| `old_tach` | `numeric` | YES | Previous `current_tach` |
| `new_tach` | `numeric` | YES | New `current_tach` |
| `old_hobbs` | `numeric` | YES | Previous `current_hobbs` |
| `new_hobbs` | `numeric` | YES | New `current_hobbs` |
| `source` | `text` | YES | Where the change came from (e.g., `direct`, or the RPC name) |
| `booking_id` | `uuid` | YES | If the change was triggered by a booking |
| `created_at` | `timestamptz` | YES | Defaults to `now()` |
| `tenant_id` | `uuid` | NO | Multi-tenant isolation |

**RLS:** Read-only access restricted to users within the same tenant (`aircraft_ttis_audit_tenant_select`).

---

## 3. Views

### 3.1 aircraft_ttis_rollup

A read-only verification view that computes TTIS from the flight ledger and compares it to the cached value on the aircraft row.

```sql
SELECT
  a.id                                    AS aircraft_id,
  a.registration,
  a.total_time_method,
  a.total_time_in_service                 AS stored_ttis,
  COALESCE(a.initial_total_time_in_service, 0) AS initial_ttis,
  COALESCE(s.ledger_sum, 0)               AS ledger_delta_sum,
  (initial_ttis + ledger_delta_sum)        AS computed_ttis,
  (stored_ttis - computed_ttis)            AS discrepancy,
  COALESCE(s.flight_count, 0)             AS flight_count,
  a.current_hobbs,
  a.current_tach,
  a.tenant_id
FROM aircraft a
LEFT JOIN (
  SELECT checked_out_aircraft_id AS aircraft_id,
         SUM(applied_aircraft_delta)  AS ledger_sum,
         COUNT(*)                     AS flight_count
  FROM   bookings
  WHERE  checkin_approved_at IS NOT NULL
    AND  applied_aircraft_delta IS NOT NULL
    AND  status = 'complete'
  GROUP BY checked_out_aircraft_id
) s ON s.aircraft_id = a.id;
```

**Key columns:**
- `stored_ttis` — the cached value on `aircraft.total_time_in_service`
- `computed_ttis` — `initial_total_time_in_service + SUM(applied_aircraft_delta)` from the ledger
- `discrepancy` — `stored_ttis - computed_ttis`. Should always be `0`. A non-zero value indicates drift.

**Usage:** Periodic integrity checks, admin dashboards, debugging.

---

## 4. Enums

### `total_time_method`

Defines how an aircraft's TTIS delta is calculated from raw meter readings. Set per-aircraft on `aircraft.total_time_method`.

| Value | Formula |
|-------|---------|
| `hobbs` | `hobbs_end - hobbs_start` |
| `tacho` | `tach_end - tach_start` |
| `airswitch` | `hobbs_end - hobbs_start` (same as hobbs) |
| `hobbs less 5%` | `(hobbs_end - hobbs_start) × 0.95` |
| `hobbs less 10%` | `(hobbs_end - hobbs_start) × 0.90` |
| `tacho less 5%` | `(tach_end - tach_start) × 0.95` |
| `tacho less 10%` | `(tach_end - tach_start) × 0.90` |

### `booking_status`

`unconfirmed` → `confirmed` → `checked_in` → `complete` → (or `cancelled` at any point)

A booking reaches `complete` status only when `approve_booking_checkin_atomic` succeeds.

---

## 5. Pure Functions

### 5.1 calculate_applied_aircraft_delta

```sql
calculate_applied_aircraft_delta(p_method text, p_hobbs_delta numeric, p_tach_delta numeric)
  RETURNS numeric
```

A pure function (no side effects) that applies the `total_time_method` formula to raw deltas.

- Raises an exception if the required delta is `NULL` for the given method.
- Called by all three atomic RPC functions.

---

## 6. Atomic RPC Functions

These are the **only** code paths that modify aircraft TTIS and booking time-tracking fields. They run as a single PostgreSQL transaction with row-level locking.

### 6.1 approve_booking_checkin_atomic

**Purpose:** The primary check-in approval flow. Locks booking + aircraft, computes deltas, creates an invoice, updates both rows atomically.

**Called from:** `POST /api/bookings/[id]/checkin/approve` (Next.js API route)

**Parameters:**

| Parameter | Type | Required | Purpose |
|-----------|------|----------|---------|
| `p_booking_id` | uuid | Yes | The booking being approved |
| `p_checked_out_aircraft_id` | uuid | Yes | Aircraft that flew |
| `p_checked_out_instructor_id` | uuid | No | Instructor (if applicable) |
| `p_flight_type_id` | uuid | Yes | Type of flight |
| `p_hobbs_start/end` | numeric | No | Hobbs readings |
| `p_tach_start/end` | numeric | No | Tach readings |
| `p_airswitch_start/end` | numeric | No | Airswitch readings |
| `p_solo_end_hobbs/tach` | numeric | No | Solo split point |
| `p_dual_time` | numeric | No | Dual instruction hours |
| `p_solo_time` | numeric | No | Solo hours |
| `p_billing_basis` | text | Yes | `hobbs`, `tacho`, or `airswitch` |
| `p_billing_hours` | numeric | Yes | Billable hours |
| `p_tax_rate` | numeric | No | Tax rate for invoice |
| `p_due_date` | text | Yes | Invoice due date |
| `p_reference` | text | No | Invoice reference |
| `p_notes` | text | No | Invoice notes |
| `p_items` | jsonb | Yes | Array of invoice line items |

**Transaction steps:**

1. **Authenticate:** Verify `auth.uid()` is not null and has `admin`, `owner`, or `instructor` role.
2. **Validate inputs:** Check billing_basis, billing_hours, and items array.
3. **Lock booking:** `SELECT ... FROM bookings WHERE id = p_booking_id FOR UPDATE`. Reject if not found, not a flight, cancelled, or already approved.
4. **Check invoice uniqueness:** Reject if an active invoice already exists for this booking.
5. **Lock aircraft:** `SELECT ... FROM aircraft WHERE id = p_checked_out_aircraft_id FOR UPDATE`. Read `total_time_method` and `total_time_in_service`.
6. **Compute deltas:**
   - `flight_time_hobbs = hobbs_end - hobbs_start`
   - `flight_time_tach = tach_end - tach_start`
   - `flight_time_airswitch = airswitch_end - airswitch_start`
   - `applied_aircraft_delta = calculate_applied_aircraft_delta(method, hobbs_delta, tach_delta)`
   - Validate all deltas are non-negative.
7. **Snapshot TTIS:** `v_old_ttis = aircraft.total_time_in_service`, `v_new_ttis = v_old_ttis + applied_delta`
8. **Create invoice:** Call `create_invoice_atomic(...)`. Raises an exception on failure (triggering full rollback).
9. **Update aircraft:** Set `total_time_in_service = v_new_ttis`, `current_hobbs`, `current_tach`. Uses `app.bypass_aircraft_total_check = 'true'` to bypass the `reject_direct_aircraft_total_updates` trigger.
10. **Update booking:** Write all readings, computed deltas, TTIS snapshots, status = `complete`, approval timestamps, invoice reference.
11. **Return:** JSON with `success`, `booking_id`, `invoice_id`, `invoice_number`, `applied_aircraft_delta`, `total_hours_start`, `total_hours_end`.
12. **On any error:** The `EXCEPTION WHEN OTHERS` block catches and returns a failure JSON, causing a full transaction rollback.

### 6.2 correct_booking_checkin_ttis_atomic

**Purpose:** Correct the end-readings on an already-approved booking. Adjusts the aircraft TTIS by the difference between old and new deltas.

**Parameters:** `p_booking_id`, `p_hobbs_end`, `p_tach_end`, `p_airswitch_end`, `p_correction_reason`

**Key behavior:**
- Uses the **original** `applied_total_time_method` snapshot from the booking (not the current aircraft setting), ensuring deterministic recalculation.
- Computes `correction_delta = new_applied_delta - old_applied_delta`.
- Adjusts `aircraft.total_time_in_service` by `correction_delta`.
- Only updates `current_hobbs`/`current_tach` if this is the most recent booking for that aircraft (determined by `end_time` / `checkin_approved_at`).
- Writes `correction_delta`, `corrected_at`, `corrected_by`, and `correction_reason` to the booking row.

### 6.3 finalize_booking_checkin_with_invoice_atomic

**Purpose:** Same as `approve_booking_checkin_atomic`, but accepts an existing `p_invoice_id` instead of creating a new invoice. Used when the invoice was created separately.

**Key difference:** Skips the `create_invoice_atomic` call and instead writes `p_invoice_id` directly to `bookings.checkin_invoice_id`.

---

## 7. Diagnostic / Reporting Functions

### 7.1 recompute_aircraft_ttis_from_ledger

```sql
recompute_aircraft_ttis_from_ledger(p_aircraft_id uuid DEFAULT NULL)
```

Returns a table comparing each aircraft's `stored_ttis` with the `ledger_sum` (SUM of `applied_aircraft_delta` from completed bookings). Optionally filtered to a single aircraft. Returns `discrepancy` = `stored_ttis - ledger_sum`.

### 7.2 find_aircraft_with_suspicious_ttis

```sql
find_aircraft_with_suspicious_ttis()
```

Returns aircraft where:
- `total_time_in_service < 10` (possibly uninitialized), OR
- `|total_time_in_service - ledger_sum| > 0.01` (drift detected)

### 7.3 get_aircraft_maintenance_cost_report

Returns maintenance cost data per aircraft, including `cost_per_hour` calculated as `total_maintenance_cost / total_time_in_service`.

---

## 8. Triggers

### 8.1 Aircraft Triggers

| Trigger | Timing | Event | Function | Purpose |
|---------|--------|-------|----------|---------|
| `reject_direct_aircraft_total_updates` | BEFORE UPDATE | UPDATE | `reject_direct_aircraft_total_updates()` | **Gate keeper.** Blocks any update to `total_time_in_service`, `current_tach`, or `current_hobbs` unless the session variable `app.bypass_aircraft_total_check` is set to `'true'`. Only the atomic RPCs set this flag. Prevents clients from modifying TTIS directly. |
| `aircraft_ttis_validation` | BEFORE UPDATE | UPDATE | `validate_aircraft_ttis_update()` | Rejects TTIS decreases of more than 5 hours (must use correction RPC for larger adjustments). Prevents negative TTIS. |
| `aircraft_ttis_audit_trigger` | AFTER UPDATE | UPDATE | `log_aircraft_ttis_change()` | Writes a row to `aircraft_ttis_audit` whenever `total_time_in_service`, `current_tach`, or `current_hobbs` changes. Records `OLD` and `NEW` values, the acting user, and the source. |
| `set_updated_at_aircraft` | BEFORE UPDATE | UPDATE | `trigger_set_updated_at()` | Standard `updated_at` timestamp maintenance. |

**Trigger execution order (BEFORE UPDATE):**

1. `reject_direct_aircraft_total_updates` — blocks unauthorized changes
2. `aircraft_ttis_validation` — validates the change is sane
3. `set_updated_at_aircraft` — sets `updated_at`

Then AFTER UPDATE:

4. `aircraft_ttis_audit_trigger` — logs the change

### 8.2 Booking Triggers

| Trigger | Timing | Event | Function | Purpose |
|---------|--------|-------|----------|---------|
| `bookings_prevent_approved_checkin_mutations` | BEFORE UPDATE | UPDATE | `prevent_approved_checkin_mutations()` | Once `checkin_approved_at` is set, most fields become immutable. Only the correction RPC can modify time readings (and only if `corrected_at`, `corrected_by`, `correction_reason` are all provided). |
| `bookings_before_delete_ttis_reversal` | BEFORE DELETE | DELETE | `handle_booking_delete_ttis_reversal()` | If a completed booking is deleted, this trigger reverses its `applied_aircraft_delta` from the aircraft's TTIS. Also reverts `current_hobbs`/`current_tach` if this was the most recent booking. |
| `prevent_double_booking_trigger` | BEFORE INSERT/UPDATE | INSERT, UPDATE | `prevent_double_booking_on_bookings()` | Prevents overlapping bookings for the same aircraft/instructor. |
| `bookings_audit_trigger` | AFTER INSERT/UPDATE/DELETE | ALL | `log_booking_audit_improved()` | General booking audit log. |
| `set_updated_at_bookings` | BEFORE UPDATE | UPDATE | `trigger_set_updated_at()` | Standard `updated_at` timestamp maintenance. |

**Immutability rules (prevent_approved_checkin_mutations):**

Once a booking is approved (`checkin_approved_at IS NOT NULL`):

- **Fully immutable fields:** `status`, `checked_out_aircraft_id`, `checked_out_instructor_id`, `flight_type_id`, `billing_basis`, `billing_hours`, `checkin_invoice_id`, `checkin_approved_at`, `checkin_approved_by`, `checked_in_by`
- **Correction path only:** `hobbs_end`, `tach_end`, `airswitch_end`, `flight_time_hobbs/tach/airswitch`, `applied_aircraft_delta`, `total_hours_end`, `correction_delta`, `corrected_at`, `corrected_by`, `correction_reason` — can only change if `corrected_at`, `corrected_by`, and `correction_reason` are all provided in the same UPDATE.
- **Always immutable:** `hobbs_start`, `tach_start`, `airswitch_start`, `total_hours_start`, `applied_total_time_method` — the original readings and method snapshot can never change.

---

## 9. Row-Level Security (RLS)

### Aircraft Policies

| Policy | Command | Rule |
|--------|---------|------|
| `aircraft_tenant_select` | SELECT | `user_belongs_to_tenant(tenant_id)` |
| `aircraft_tenant_insert` | INSERT | `user_belongs_to_tenant(tenant_id)` — further restricted by role policy |
| `aircraft_tenant_update` | UPDATE | `user_belongs_to_tenant(tenant_id)` AND role is `owner`, `admin`, or `instructor` |
| `aircraft_tenant_delete` | DELETE | `user_belongs_to_tenant(tenant_id)` — further restricted by role policy |
| `Authorized roles can create aircraft` | INSERT | Role must be `owner`, `admin`, or `instructor` |
| `Authorized roles can update aircraft` | UPDATE | Role must be `owner`, `admin`, or `instructor` |
| `Owners and admins can delete aircraft` | DELETE | Role must be `owner` or `admin` |

**Net effect:** Only staff roles (owner/admin/instructor) within the same tenant can modify aircraft. Students can only read. Direct client updates to TTIS are additionally blocked by the `reject_direct_aircraft_total_updates` trigger.

### Bookings Policies

| Policy | Command | Rule |
|--------|---------|------|
| `bookings_tenant_select` | SELECT | `user_belongs_to_tenant(tenant_id)` |
| `bookings_tenant_insert` | INSERT | `user_belongs_to_tenant(tenant_id)` |
| `bookings_tenant_update` | UPDATE | `user_belongs_to_tenant(tenant_id)` AND role is `owner`, `admin`, or `instructor` |
| `bookings_tenant_delete` | DELETE | `user_belongs_to_tenant(tenant_id)` |

**Net effect:** Any tenant member can create bookings and view bookings. Only staff can update or delete. Time-tracking fields on approved bookings are additionally protected by the immutability trigger.

### Aircraft TTIS Audit Policies

| Policy | Command | Rule |
|--------|---------|------|
| `aircraft_ttis_audit_tenant_select` | SELECT | `user_belongs_to_tenant(tenant_id)` |

**Net effect:** Read-only. No INSERT/UPDATE/DELETE policies — rows are only created by the database trigger, running as the function owner.

---

## 10. Business Logic Walkthrough

### 10.1 Normal Check-in Flow

```
Instructor/Admin (browser)
    │
    ├─1─▶ Opens check-in page for booking
    │     Next.js loads booking + aircraft data (server component)
    │     Current aircraft hobbs/tach pre-filled from aircraft.current_hobbs/current_tach
    │
    ├─2─▶ Fills in end-readings (hobbs_end, tach_end, etc.)
    │     Selects flight type, billing basis, confirms invoice line items
    │     Client computes billing_hours for preview
    │
    ├─3─▶ Clicks "Approve Check-In & Create Invoice"
    │     POST /api/bookings/[id]/checkin/approve
    │     Payload: all readings, billing info, invoice items
    │
    └─4─▶ API route calls supabase.rpc("approve_booking_checkin_atomic", ...)
          │
          ├─ Transaction begins
          ├─ Booking locked (FOR UPDATE) — prevents concurrent check-ins
          ├─ Aircraft locked (FOR UPDATE) — prevents concurrent TTIS modifications
          ├─ Deltas computed in PostgreSQL:
          │    flight_time_hobbs = hobbs_end - hobbs_start
          │    flight_time_tach  = tach_end  - tach_start
          │    applied_aircraft_delta = calculate_applied_aircraft_delta(method, ...)
          │    total_hours_start = aircraft.total_time_in_service (before)
          │    total_hours_end   = total_hours_start + applied_aircraft_delta
          ├─ Invoice created (create_invoice_atomic)
          ├─ Aircraft updated:
          │    total_time_in_service = total_hours_end
          │    current_hobbs = hobbs_end
          │    current_tach  = tach_end
          ├─ Booking updated:
          │    All readings, deltas, snapshots, status='complete'
          │    checkin_approved_at = now()
          │    checkin_approved_by = auth.uid()
          ├─ Triggers fire (audit log, validation)
          └─ COMMIT (or full ROLLBACK on any error)
```

### 10.2 Post-approval Correction Flow

```
Admin discovers incorrect end-readings
    │
    ├─1─▶ Calls correct_booking_checkin_ttis_atomic(
    │       p_booking_id, p_hobbs_end, p_tach_end,
    │       p_airswitch_end, p_correction_reason)
    │
    └─2─▶ Transaction:
          ├─ Locks booking + aircraft
          ├─ Reads original applied_total_time_method (from booking snapshot)
          ├─ Recomputes delta using the ORIGINAL method:
          │    new_applied_delta = calculate_applied_aircraft_delta(
          │      original_method, new_hobbs_delta, new_tach_delta)
          ├─ correction_delta = new_applied_delta - old_applied_delta
          ├─ Aircraft TTIS adjusted: += correction_delta
          ├─ If most recent booking: current_hobbs/tach updated too
          ├─ Booking updated: new end readings, new deltas,
          │    correction_delta, corrected_at/by, correction_reason
          ├─ Immutability trigger allows this because correction fields are set
          └─ COMMIT
```

### 10.3 Booking Deletion with TTIS Reversal

```
Admin deletes a completed booking
    │
    └─▶ BEFORE DELETE trigger: handle_booking_delete_ttis_reversal
        ├─ Checks: was this booking approved? (checkin_approved_at IS NOT NULL)
        ├─ If yes:
        │    ├─ Subtracts applied_aircraft_delta from aircraft.total_time_in_service
        │    ├─ If most recent booking: reverts current_hobbs/tach to start readings
        │    └─ Sets bypass flag for the aircraft update trigger
        └─ DELETE proceeds
```

---

## 11. Next.js Integration

### API Route: `POST /api/bookings/[id]/checkin/approve`

**Location:** `app/api/bookings/[id]/checkin/approve/route.ts`

This is the sole Next.js endpoint for check-in approval. It:

1. Validates the incoming payload with Zod.
2. Authenticates the user via `getAuthSession()`.
3. Passes all parameters to `supabase.rpc("approve_booking_checkin_atomic", ...)`.
4. Returns the RPC result (invoice ID, applied delta, TTIS start/end).
5. Revalidates relevant Next.js cache paths.

**No business logic runs in Node.js.** All delta computation, TTIS updates, invoice creation, and validation happen inside the PostgreSQL transaction.

### UI Components That Read TTIS

| Component | File | What it reads |
|-----------|------|---------------|
| Aircraft fleet table | `components/aircraft/aircraft-table.tsx` | `aircraft.total_time_in_service` (displays "Total Hours" column) |
| Aircraft detail page | `components/aircraft/aircraft-detail-client.tsx` | `aircraft.total_time_in_service` (displays and compares to maintenance due hours) |
| Aircraft overview tab | `components/aircraft/aircraft-overview-tab.tsx` | `aircraft.total_time_in_service` (displays) |
| Aircraft settings tab | `components/aircraft/aircraft-settings-tab.tsx` | `aircraft.total_time_in_service` (displays in disabled input) |
| Maintenance items tab | `components/aircraft/aircraft-maintenance-items-tab.tsx` | `aircraft.total_time_in_service` (calculates remaining hours until maintenance due) |
| Log maintenance modal | `components/aircraft/log-maintenance-modal.tsx` | `aircraft.total_time_in_service` (pre-fills "hours at visit") |

All of these read from the materialized cache column on the aircraft row. None write to it.

---

## 12. TTIS Integrity Model

The system uses a **materialized cache + ledger verification** pattern:

```
┌────────────────────────────────────────────────────────────────────┐
│                     TTIS Integrity Layers                          │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Layer 1: COMPUTATION                                              │
│    All deltas computed by calculate_applied_aircraft_delta()        │
│    inside a locked transaction. Never computed client-side.         │
│                                                                    │
│  Layer 2: ATOMICITY                                                │
│    Aircraft + booking updated in a single transaction.             │
│    FOR UPDATE locks prevent concurrent modifications.              │
│    Full rollback on any error.                                     │
│                                                                    │
│  Layer 3: PROTECTION                                               │
│    reject_direct_aircraft_total_updates — blocks non-RPC changes   │
│    validate_aircraft_ttis_update — prevents large negative shifts   │
│    prevent_approved_checkin_mutations — locks down approved data    │
│    RLS policies — only staff roles can update                      │
│                                                                    │
│  Layer 4: AUDIT                                                    │
│    aircraft_ttis_audit — every TTIS/meter change logged            │
│    booking correction fields — who, when, why, delta               │
│                                                                    │
│  Layer 5: VERIFICATION                                             │
│    aircraft_ttis_rollup view — compares cache vs ledger            │
│    find_aircraft_with_suspicious_ttis() — flags discrepancies      │
│    recompute_aircraft_ttis_from_ledger() — per-aircraft check      │
│                                                                    │
│  Invariant:                                                        │
│    aircraft.total_time_in_service                                  │
│      == aircraft.initial_total_time_in_service                     │
│       + SUM(bookings.applied_aircraft_delta)                       │
│         WHERE status='complete' AND checkin_approved_at IS NOT NULL │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 13. Column Reference: Source-of-Truth vs Derived

### Aircraft

| Column | Category | Written by |
|--------|----------|------------|
| `total_time_method` | **Configuration** | Admin (direct update) |
| `initial_total_time_in_service` | **Source of truth** | Set once at aircraft creation/onboarding |
| `total_time_in_service` | **Materialized cache** | Atomic RPCs only (trigger-protected) |
| `current_hobbs` | **Materialized snapshot** | Atomic RPCs only (trigger-protected) |
| `current_tach` | **Materialized snapshot** | Atomic RPCs only (trigger-protected) |
| `record_hobbs/tacho/airswitch` | **Configuration** | Admin (direct update) |

### Bookings

| Column | Category | Written by |
|--------|----------|------------|
| `hobbs_start/end` | **Source of truth** | Atomic RPC (from pilot input) |
| `tach_start/end` | **Source of truth** | Atomic RPC (from pilot input) |
| `airswitch_start/end` | **Source of truth** | Atomic RPC (from pilot input) |
| `flight_time_hobbs/tach/airswitch` | **Derived** | Computed in RPC: `end - start` |
| `applied_aircraft_delta` | **Derived** | Computed in RPC via `calculate_applied_aircraft_delta()` |
| `applied_total_time_method` | **Snapshot** | Copied from `aircraft.total_time_method` at approval time |
| `total_hours_start/end` | **Snapshot** | Copied from `aircraft.total_time_in_service` before/after update |
| `billing_basis` | **Source of truth** | From instructor input at check-in |
| `billing_hours` | **Source of truth** | From instructor input at check-in |
| `dual_time` | **Source of truth** | From instructor input at check-in |
| `solo_time` | **Source of truth** | From instructor input at check-in |
| `correction_delta` | **Derived** | Computed in correction RPC |
