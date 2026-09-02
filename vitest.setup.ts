import { vi } from "vitest";

// Mock server-only so modules that import it can run under Vitest.
vi.mock("server-only", () => ({}));

// Add project-specific module mocks below (e.g. auth, next/cache).

// BEGIN dev-env:prisma-test-cleanup
import {
  afterAll as devEnvAfterAll,
  afterEach as devEnvAfterEach,
} from "vitest";

// Reset database state between tests. No-op in pure-unit files that never import the app's
// Prisma singleton — truncateAllTables is gated on globalThis.prisma.
devEnvAfterEach(async () => {
  const { truncateAllTables } = await import("./test/db");
  await truncateAllTables();
});
devEnvAfterAll(async () => {
  const { disconnectAppPrisma } = await import("./test/db");
  await disconnectAppPrisma();
});
// END dev-env:prisma-test-cleanup
