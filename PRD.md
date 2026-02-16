# Flight Desk Pro — Aero Club / Flight School Management (PRD)

Date: 2026-02-15  
Status: High-level draft (derived from current codebase)

## 1) Summary
Flight Desk Pro is a multi-tenant web app for aero clubs / flight schools to manage members, aircraft, bookings/scheduling, training progress, invoicing, equipment, and staff rosters, with strong role-based access control and database-enforced privacy.

## 1.1) Current Product Surface (from the app UI)
- Dashboard (summary cards + bookings snapshot)
- Scheduler (resource timeline)
- Bookings (filters + operational status)
- Aircraft (fleet list + details)
- Members (segmented member/instructor/staff/contact views)
- Staff (instructors/staff records)
- Invoices (invoice list + details)
- Training (training overview “command centre”)
- Equipment (inventory + issue/return/update)
- Rosters (availability rules scheduler)
- Reports (time-series chart + “coming soon” cards)
- Settings (owner/admin only; tabbed categories)

## 2) Problem Statement
Small-to-mid aero clubs and flight schools often run operations across spreadsheets, disparate booking tools, and manual billing/training records. This creates avoidable admin load, poor visibility, and safety/compliance risk (missing expiries, incomplete training records, inconsistent aircraft times/maintenance tracking).

## 3) Goals
- Provide a single operational system for day-to-day scheduling + member/admin workflows.
- Enforce privacy and least-privilege access across staff, instructors, members, and students.
- Make “booking → flight activity → check-in → billing → training record” a single workflow.
- Support multiple organizations (tenants) with tenant-scoped data and settings.
- Be DST/timezone-safe with an explicit “school timezone” model.

## 4) Non-Goals (for this PRD)
- Full accounting/ERP replacement (general ledger, bank reconciliation).
- Complex dispatch ops (load sheets, weight & balance, flight following).
- Pilot logbook replacement (beyond training-centric recording).
- Multi-currency tax jurisdiction engine (beyond tenant-configured tax settings).

## 5) Primary Users & Roles
Roles (in ascending privilege): `student` → `member` → `instructor` → `admin` → `owner`.

- Owner: organization setup, full admin, security and settings.
- Admin: operations admin (members, aircraft, invoicing, training oversight).
- Instructor: manages bookings/training records for assigned students; staff tooling.
- Member: books aircraft/lessons, sees own bookings/invoices/training info (as permitted).
- Student: similar to member, typically training-focused and more restricted.

## 6) Tenancy Model
- A “Tenant” represents an aero club/organization.
- Users can belong to one or more tenants (tenant membership + role per tenant).
- Tenant settings are applied via defaults + per-tenant overrides.

## 7) Core Objects (conceptual)
- Tenant, TenantUser (membership + role)
- User (member profile), Instructor
- Aircraft, AircraftType, AircraftComponent, MaintenanceVisit
- Booking (scheduler entry + flight-log/check-in fields)
- Lesson, Syllabus, Enrollment, LessonProgress
- Exam / ExamResults, Endorsements, Licenses, ExperienceTypes, FlightExperience entries
- ChargeableType, Chargeable, Rates (incl. landing fees), TaxRates
- Invoice, InvoiceItems, Payments (where applicable)
- Equipment, EquipmentIssuance, EquipmentUpdates
- RosterRule (instructor availability rules)
- Audit logs (security-critical)

## 8) Key Workflows (high level)
### 8.1 Onboarding (new tenant)
- User signs up / logs in.
- If no tenant membership exists, user creates an organization (tenant) and becomes `owner`.
- Owner configures baseline settings (hours, booking rules, invoicing, memberships, training).

### 8.2 Scheduling & Bookings
- Users view a resource timeline scheduler.
- Create bookings with: aircraft (optional for some booking types), instructor (optional), start/end time, purpose, notes, type (flight/groundwork/maintenance/other).
- Booking status lifecycle supports operational states (e.g., unconfirmed → confirmed → briefing → flying → complete; cancelled).
- Privacy: scheduler feeds may mask sensitive fields (e.g., purpose) for lower-privilege viewers.

### 8.3 Check-out / Check-in + Flight Recording
- A booking can capture flight metrics (Hobbs/Tacho/Airswitch), route/passengers, fuel, ETA, remarks.
- Supports dual/solo time split and booking-linked lesson progress.
- Billing basis + billing hours are captured/derived for invoicing correctness.
- Aircraft TTIS is updated via controlled “delta tracking” to reduce corruption risk.

### 8.4 Members & Memberships
- Maintain member profiles (contact, medical/licence metadata, next of kin, activity flags).
- Memberships: types, purchase/start/expiry, active/expired classification, optional invoicing linkage.
- Member list views and segmentation (member/instructor/staff/contact).

### 8.5 Training Management
- Define syllabi and lessons (ordering, stages, required flags).
- Enroll students and track progress summaries (completed/total/%).
- Record lesson outcomes and instructor notes per booking (lesson progress).
- Track exams, endorsements, licences, and “experience” entries with units (hours/count/landings).
- Provide a training “command centre” overview: active/at-risk/stale activity status driven by last flight/enrollment timing.

### 8.6 Invoicing & Charges
- Generate and manage invoices (draft/pending/paid/overdue/cancelled/refunded).
- Store invoice totals, tax totals, balance due, and payment metadata.
- Support configurable invoice prefix, payment terms, due dates, reminders, and rounding safeguards.
- Configure chargeables and chargeable types; support a hybrid model (global vs tenant-specific).

### 8.7 Equipment Tracking
- Create equipment items (typed, serialised, status, location, warranty).
- Issue/return equipment to/from users; record expected return and notes.
- Record equipment updates/maintenance with next-due dates.

### 8.8 Rosters (Instructor Availability)
- Define recurring availability rules (day of week, start/end time, effective date range).
- Use roster rules to support planning/staff coverage and (optionally) validate bookings.

### 8.9 Reports & Analytics
- Provide dashboards and time-series views (initial implementation exists; additional report categories are planned).
- Target report areas: fleet utilisation, revenue, training progress, instructor performance, safety/maintenance.

## 9) Functional Requirements (by module)
### 9.1 Authentication & Authorization
- Sign up, log in, log out (Supabase Auth).
- Server-side session resolution for consistent SSR behavior.
- RBAC enforced at multiple layers, with database Row Level Security as the ultimate authority.
- Tenant scoping: users must not access other tenants’ data.

### 9.2 Scheduler
- Timeline view grouped by aircraft/resources.
- Fast navigation by day/week, with explicit school timezone day boundaries (DST-safe).
- Read access must respect role + tenant + privacy masking.

### 9.3 Bookings
- CRUD bookings with validation for time overlap, buffers, business hours, and rules (configurable).
- Status changes with auditable state transitions.
- Cancellation categorisation and reason capture.
- Booking filters: status, type, aircraft, instructor, user, date range, search.

### 9.4 Aircraft & Maintenance
- CRUD aircraft and aircraft types; scheduler ordering; availability flags (on-line/ATO/etc).
- Track total time in service and per-method meters (Hobbs/Tacho/Airswitch).
- Track components with due intervals (hours/calendar/both) and maintenance visits.

### 9.5 People (Members/Staff/Instructors)
- Member profile CRUD with important safety/compliance dates.
- Instructor records and instructor categories/ratings as needed.
- Admin tooling for staff lists and activations/deactivations.

### 9.6 Training
- Manage syllabi, lessons, exams, experience types.
- Student enrollment, progress, and activity status.
- Record lesson progress tied to bookings (instructor comments, pass/not yet competent, etc.).

### 9.7 Invoicing
- Create invoices manually and/or from operational events (e.g., booking check-in) based on settings.
- Maintain invoice items, taxes, rounding correctness, and payment recording.

### 9.8 Settings (tenant-scoped)
- General/business hours and open/closed flags.
- Booking rules: duration min/max, buffers, instructor requirements, advance limits, time slots.
- Invoicing rules: prefix, due days, reminders, footer, late fees, terms.
- Maintenance rules: grounding behavior and buffers/approvals.
- Membership year configuration.
- Security/session policy settings (timeouts, lockouts).

## 10) Non-Functional Requirements
- Security: RLS everywhere; strict tenant isolation; least privilege; audit logging protected.
- Time correctness: explicit timezone strategy; UTC instants in DB; date-only fields remain date-only.
- Reliability: idempotent “financially critical” operations (invoice creation/check-in approval).
- Performance: scheduler and bookings list must remain responsive at org scale.
- Usability: mobile-friendly navigation; role-appropriate UI; avoid “flicker” on auth.

## 11) Constraints & Dependencies
- Tech stack: Next.js App Router + React, Supabase (Postgres + Auth + RLS), React Query, Tailwind/Radix UI.
- PDF generation (account statements/invoices) via React PDF tooling.
- JWT/role propagation may depend on an Edge Function + DB trigger (for faster role reads).

## 12) Milestones (suggested)
- M1: Tenant onboarding + RBAC baseline + core scheduler read/write.
- M2: Booking lifecycle + check-in/out + accurate aircraft time updates.
- M3: Invoicing automation + chargeables + membership billing.
- M4: Training command centre + syllabus/lesson progress at scale.
- M5: Maintenance/components + equipment + roster enforcement.
- M6: Reports/exports + scheduled notifications.

## 13) Open Questions (to resolve before “v1”)
- Payments: is there an intended payment gateway integration or is payment tracking manual-only?
- Data privacy expectations for members/students (what should be masked in scheduler and lists by role)?
- Multi-tenant UX: do users switch tenants via UI, subdomain, or selection on login?
- Booking policy: how strict should roster enforcement be (hard block vs warning)?
- Training: authoritative source of truth (bookings vs lesson progress vs experience entries) for hours/competency.
- Invoicing: tax model (single rate vs per-item rates), refunds/credit notes workflow.
