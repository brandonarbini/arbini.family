# File templates — worked discounts example

Read this when scaffolding the files of a route or domain. It is a full worked example: a discounts domain (`/lib/discounts/`) consumed by an admin route (`/app/system/discount-codes/`). The shared layer owns cache tags, a query used by both checkout and admin, a service that owns the write, and a pure calculator. The admin route owns its own listing query, form schema, thin actions, and page.

> The imports below — `@/lib/auth`, `zod`, `swr` — are illustrative. Use whatever the project already has. If it has nothing, ask the user before scaffolding (see SKILL.md, "When to ask the user"). In a non-interactive run, match whatever the lockfile shows.

## `/lib/discounts/cache.ts`

Shared tag builders — the single source of truth for tags touched outside one route.

```ts
/**
 * Sentinel for the "all organizations" listing (system admin view).
 * Mutations bump this tag alongside the specific org's tag so the
 * unfiltered list updates immediately.
 */
export const ALL_ORGS_TAG = "ALL" as const;

export const DISCOUNT_TAGS = {
  discountCodes: (organizationId: string) => `discount-codes:${organizationId}`,
  allDiscountCodes: () => `discount-codes:${ALL_ORGS_TAG}`,
  discountCode: (id: string) => `discount-code:${id}`,
  discountRedemptions: (discountCodeId: string) =>
    `discount-redemptions:${discountCodeId}`,
} as const;
```

## `/lib/discounts/data.ts`

```ts
import "server-only";
import { db } from "@/lib/db";

/**
 * Read used by checkout's atomic-claim path. Intentionally NOT cached —
 * a stale redemptionCount would defeat the atomic-claim guarantee. For an
 * intentionally-uncached read that is called multiple times per render,
 * React.cache() is the correct per-render dedup tool (do not add
 * "use cache" here — that would reintroduce the staleness).
 */
export async function getDiscountCodeByCode(
  code: string,
  organizationId: string,
) {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  return db.discountCode.findUnique({
    where: { organizationId_code: { organizationId, code: normalized } },
  });
}

export type DiscountCodeRow = Awaited<ReturnType<typeof getDiscountCodeByCode>>;
```

Shared `data.ts` queries may opt out of `"use cache"` when correctness demands fresh reads. Document why next to the function.

## `/lib/discounts/service.ts`

Write-path business logic lives here — auth-free, takes the resolved actor/tenant as parameters. The route action is a thin shell that calls in.

```ts
import "server-only";
import { db } from "@/lib/db";

/**
 * The service owns its input contract — never import types from /app
 * (Rule 14). The route's validation schema produces data satisfying it.
 */
export type CreateDiscountCodeData = {
  code: string;
  organizationId: string;
  discountType: "PERCENT" | "FIXED_AMOUNT";
  percentOff: number | null;
  amountOffCents: number | null;
  maxRedemptions: number | null;
  expiresAt: Date | null;
  isActive: boolean;
};

/**
 * Owns the discount-code write. Assumes the caller already authorized the
 * operation and validated `input`. Testable without any route plumbing.
 */
export async function createDiscountCode(
  actorUserId: string,
  input: CreateDiscountCodeData,
) {
  return db.discountCode.create({
    data: {
      ...input,
      code: input.code.trim().toUpperCase(),
      createdById: actorUserId,
    },
  });
}
```

If the domain accumulates several such contracts, move them to `/lib/<domain>/types.ts`. When the schema itself is shared across routes, promote it to `/lib/<domain>/validations.ts` and derive the type there instead.

## `/lib/discounts/calculator.ts` (pure logic, domain-named)

```ts
import type { DiscountCode } from "@/lib/db/types";

export type DiscountInvalidReason =
  | "NOT_FOUND"
  | "INACTIVE"
  | "EXPIRED"
  | "EXHAUSTED"
  | "WRONG_ORG"
  | "INVALID_DEFINITION"
  | "EXCEEDS_PARTNER_MARGIN";

export type DiscountResult =
  | { valid: false; reason: DiscountInvalidReason }
  | {
      valid: true;
      discountCodeId: string;
      amountCents: number;
      finalChargeCents: number;
    };

/** Pure discount math. Performs no I/O. */
export function calculateDiscount(input: {
  code: DiscountCode | null;
  organizationId: string;
  subtotalCents: number;
  partnerMarginCapCents: number | null;
  now?: Date;
}): DiscountResult {
  // ...branching over the input, return a DiscountResult...
}
```

The filename `calculator.ts` reflects what the discounts domain does; a different domain might have `pricing.ts`, `parser.ts`, `state-machine.ts`. Pair with a sibling `calculator.test.ts` that tests the function in isolation — no DB, no mocking.

## `/app/system/discount-codes/data.ts`

```ts
import "server-only";
import { cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { ALL_ORGS_TAG, DISCOUNT_TAGS } from "@/lib/discounts/cache";

/** Admin listing. Pass `null` to list across all organizations. */
export async function getDiscountCodes(organizationId: string | null) {
  "use cache";
  cacheTag(DISCOUNT_TAGS.discountCodes(organizationId ?? ALL_ORGS_TAG));

  return db.discountCode.findMany({
    where: organizationId ? { organizationId } : undefined,
    include: {
      organization: { select: { id: true, name: true, subdomain: true } },
      _count: { select: { redemptions: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export type DiscountCodeListItem = Awaited<
  ReturnType<typeof getDiscountCodes>
>[number];
```

The query's `include` shape is admin-specific — it stays in `/app`. The tag constants come from `/lib/discounts/cache` because the same tags are bumped by webhook redemption events. `select` only the columns the view renders — never pass full rows with sensitive fields across the RSC boundary to a client component.

## `/app/system/discount-codes/validations.ts`

Neutral file — no `"use server"`, no `"use client"`. Imported by `actions.ts` server-side and by client components for form validation.

```ts
import { z } from "zod";

export const createDiscountCodeSchema = z.object({
  code: z.string().min(1).max(64),
  organizationId: z.string().uuid(),
  discountType: z.enum(["PERCENT", "FIXED_AMOUNT"]),
  percentOff: z.number().int().min(1).max(100).nullable(),
  amountOffCents: z.number().int().positive().nullable(),
  maxRedemptions: z.number().int().positive().nullable(),
  expiresAt: z.coerce.date().nullable(),
  isActive: z.boolean(),
});

export type CreateDiscountCodeInput = z.infer<typeof createDiscountCodeSchema>;
```

## `/app/system/discount-codes/actions.ts`

Thin shell: auth → `safeParse` → call the service → invalidate tags. Returns a typed result object so the client can render field errors; validation failures never throw to the client. See the `next-server-actions` skill (`.agents/skills/next-server-actions/SKILL.md`) for the full error-handling and form-wiring pattern.

```ts
"use server";

import { updateTag } from "next/cache";
import { requireSystemAdminForAction } from "@/lib/auth/require-auth";
import { DISCOUNT_TAGS } from "@/lib/discounts/cache";
import { createDiscountCode as createDiscountCodeSvc } from "@/lib/discounts/service";
import { createDiscountCodeSchema } from "./validations";

export type CreateDiscountCodeResult =
  | { ok: true; id: string }
  | { ok: false; fieldErrors: Record<string, string[]> };

export async function createDiscountCode(
  input: unknown,
): Promise<CreateDiscountCodeResult> {
  const session = await requireSystemAdminForAction();

  const parsed = createDiscountCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const code = await createDiscountCodeSvc(session.user.id, parsed.data);

  updateTag(DISCOUNT_TAGS.discountCodes(parsed.data.organizationId));
  updateTag(DISCOUNT_TAGS.allDiscountCodes());
  return { ok: true, id: code.id };
}
```

The action does no DB work itself — `/lib/discounts/service.ts` owns the write, so the domain logic is testable without route plumbing and isn't hidden inside `/app`. A single trivial ORM call may inline in the action, but prefer the service.

## `/app/system/discount-codes/page.tsx`

```tsx
import { requireSystemAdmin } from "@/lib/auth/require-auth";
import { getDiscountCodes } from "./data";
import { DiscountCodesTable } from "./discount-codes-table";

// This page awaits searchParams and calls cookie-reading auth, so under
// Cache Components it accesses uncached data during render. A sibling
// loading.tsx (below) or a parent <Suspense> is REQUIRED — without one,
// `next build` fails with the blocking-route error. See SKILL.md Rule 12.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string }>;
}) {
  await requireSystemAdmin();
  const { orgId } = await searchParams;
  const codes = await getDiscountCodes(orgId ?? null);
  return <DiscountCodesTable codes={codes} orgId={orgId ?? null} />;
}
```

When a page runs several independent queries, start them in parallel — `const [a, b] = await Promise.all([getA(), getB()])`, or render each section inside its own `<Suspense>` — so they don't waterfall. searchParams-driven pagination/filtering flows through `data.ts` params (which are automatically the cache key); type the page/sort/filter params in `validations.ts`.

## `/app/system/discount-codes/loading.tsx` (required for the page above)

```tsx
export default function Loading() {
  return <div>Loading…</div>;
}
```

## `/app/system/discount-codes/api/route.ts` (only when a client component refetches)

Lives in a child `api/` subfolder because `route.ts` cannot coexist with `page.tsx` at the same segment.

```ts
import { NextRequest } from "next/server";
import { requireSystemAdmin } from "@/lib/auth/require-auth";
import { getDiscountCodes } from "../data";

export async function GET(req: NextRequest) {
  await requireSystemAdmin();
  const orgId = req.nextUrl.searchParams.get("orgId");
  return Response.json(await getDiscountCodes(orgId));
}
```

When one page has multiple distinct client-refresh endpoints, use descriptive sibling subfolders (`orders-feed/route.ts`, `customers-feed/route.ts`) rather than one crowded `api/route.ts`. Each stays a thin wrapper around its `data.ts` function.

## `/app/system/discount-codes/error.tsx`

```tsx
"use client";

// `retry` (stable since Next 16.3) re-runs the Server Component data fetch that failed;
// `reset` only re-renders the boundary's children without re-fetching, which for a failure
// that came from `data.ts` reproduces the same error. Prefer `retry`.
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong</h2>
      <button onClick={retry}>Try again</button>
    </div>
  );
}
```

## Webhook / cron / external invalidation (sketch)

External callers — webhooks, cron jobs, integrations — import the same `DISCOUNT_TAGS` from `/lib/discounts/cache` and use `revalidateTag` (not `updateTag`, which only works in Server Actions):

```ts
// app/api/webhooks/discount-redemption/route.ts
import { revalidateTag } from "next/cache";
import { DISCOUNT_TAGS } from "@/lib/discounts/cache";

export async function POST(req: Request) {
  const event = await verifyWebhook(req);
  const redemption = await db.discountRedemption.create({
    data: event,
    include: { discountCode: { select: { organizationId: true } } },
  });

  // Every tag the write touches -- the same set the Server Action uses. The listing
  // (`discountCodes(orgId)` / `allDiscountCodes()`) includes `_count.redemptions`, so a
  // redemption changes it too; invalidating only the per-code tags leaves that count stale.
  revalidateTag(DISCOUNT_TAGS.discountCode(event.discountCodeId), "max");
  revalidateTag(DISCOUNT_TAGS.discountRedemptions(event.discountCodeId), "max");
  revalidateTag(
    DISCOUNT_TAGS.discountCodes(redemption.discountCode.organizationId),
    "max",
  );
  revalidateTag(DISCOUNT_TAGS.allDiscountCodes(), "max");
  return Response.json({ received: true });
}
```

`'max'` gives stale-while-revalidate semantics — current users see cached data while fresh data loads in the background. Pass `{ expire: 0 }` instead if the external system requires immediate expiration.

## Client list component (sketch — SWR shown as an example)

The server-rendered rows are the `fallbackData`; SWR refetches through the `api/route.ts` handler.

```tsx
"use client";
import useSWR from "swr";
import type { DiscountCodeListItem } from "./data";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function DiscountCodesTable({
  codes,
  orgId,
}: {
  codes: DiscountCodeListItem[];
  orgId: string | null;
}) {
  // The key carries the same filter the server render used. It is also SWR's cache key, so a
  // bare "/system/discount-codes/api" would refetch every organization's codes over the
  // filtered rows and share one cache entry between two organization views.
  const { data } = useSWR<DiscountCodeListItem[]>(
    orgId
      ? `/system/discount-codes/api?orgId=${encodeURIComponent(orgId)}`
      : "/system/discount-codes/api",
    fetcher,
    { fallbackData: codes },
  );
  // ...
}
```

For the form component, see the `next-server-actions` skill (`.agents/skills/next-server-actions/SKILL.md`) — `useActionState` + a native `<form action>` is the default.
