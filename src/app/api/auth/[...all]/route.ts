import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Better Auth handler — exposes sign-in/sign-out/session endpoints under /api/auth.
export const { GET, POST } = toNextJsHandler(auth);
