import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Every Better Auth endpoint — sign-in, magic-link verify, passkey registration, sign-out —
// is served from this one catch-all.
export const { POST, GET } = toNextJsHandler(auth);
