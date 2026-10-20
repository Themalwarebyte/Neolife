import type { NextRequest } from "next/server";
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { isPublicOfficeSignUpPath } from "@/lib/crm-login-policy";

// Better Auth still manages all credentials and cookies. Public account
// creation is disabled at the HTTP boundary; only server-side Owner-approved
// provisioning can call auth.api.signUpEmail directly.
const handler = toNextJsHandler(auth);
export const GET = handler.GET;
export async function POST(request: NextRequest) {
  if (isPublicOfficeSignUpPath(new URL(request.url).pathname)) {
    return Response.json({ message: "Public office registration is not available." }, {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }
  return handler.POST(request);
}
