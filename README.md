# FlowDesk

FlowDesk is a business operations SaaS application designed for small service businesses to manage customers, jobs, scheduling, invoices, payments, team members, analytics, and business settings from one workspace.

## Features

- Secure sign-in and session handling with Neon Auth.
- A real-data dashboard for active work, today’s schedule, customers, and attention items.
- Customer management with create, edit, archive, search, and status filters.
- Job and work-order management with customer relationships, workflow statuses, and staff assignment.
- Weekly scheduling and rescheduling with operational-status safeguards.
- Invoice creation with line items, calculated totals, and workspace-safe invoice numbering.
- Invoice workflow controls for draft, sent, paid, cancelled, and derived overdue states.
- Payment tracking for operational records, including partial payments and outstanding balances. FlowDesk does not process card payments or real payment transactions.
- A read-only V1 team directory showing workspace members and roles.
- Workspace analytics using real customer, job, invoice, and payment data.
- Business profile and workspace settings for eligible roles.
- A polished responsive interface for desktop, tablet, and mobile.

## Tech Stack

- React 19
- Vite 8
- Neon PostgreSQL
- Neon Auth with the Better Auth React adapter
- Neon Data API via `@neondatabase/neon-js`
- Oxlint

## Security

FlowDesk uses Neon Auth for authentication and PostgreSQL Row Level Security (RLS) to protect workspace data. Frontend role checks support the user experience, while database policies and authenticated RPCs remain the security boundary.

Database passwords, service-role credentials, and other privileged secrets do not belong in frontend code.

## Environment Variables

Create a local `.env` file in the project root with the public Neon endpoint variables:

```env
VITE_NEON_AUTH_URL=
VITE_NEON_DATA_API_URL=
```

Do not commit credentials, tokens, passwords, or secret keys.

## Local Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run lint
npm run build
```

## Deployment

FlowDesk can be deployed as a Vite application. Configure `VITE_NEON_AUTH_URL` and `VITE_NEON_DATA_API_URL` in the hosting platform’s environment settings before building for production. Do not place privileged database credentials in those variables.

## Current V1 Scope

- One active workspace is selected per authenticated session.
- The Team directory is read-only.
- Team invitations and member onboarding are not included.
- Payments are operational records, not payment processing.
- PWA and offline support are not currently included.

## Portfolio Note

FlowDesk is a portfolio SaaS project demonstrating multi-user business workflows, authenticated database-backed CRUD, workspace isolation, scheduling, invoicing and payment tracking, analytics, and a responsive SaaS interface.
