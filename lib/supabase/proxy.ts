import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./config";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  // The page displays a setup error if configuration is missing.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return response;
  const { url, key } = getSupabaseConfig();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        if (headers) Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });
  // Protection also runs in server pages; this call refreshes the cookie.
  const { error } = await supabase.auth.getClaims();
  if (error && error.name !== "AuthSessionMissingError") {
    const message = error.message.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]!);
    const failure = new NextResponse(
      `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>ChoreCycle</title></head><body><main><h1>Could not check your sign-in</h1><p role="alert">${message}</p><a href="${request.nextUrl.pathname}" style="display:inline-block;padding:16px">Try again</a></main></body></html>`,
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } },
    );
    response.cookies.getAll().forEach((cookie) => failure.cookies.set(cookie));
    return failure;
  }
  return response;
}
