import { vi } from "vitest";

// Mock server-only so modules that import it can run under Vitest.
vi.mock("server-only", () => ({}));

// Add project-specific module mocks below (e.g. auth, next/cache).
