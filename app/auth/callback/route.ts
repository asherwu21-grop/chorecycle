import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  let message = request.nextUrl.searchParams.get("error_description") ?? "The confirmation link is missing its code. Please sign in or sign up again.";
  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) message = error.message;
      else return NextResponse.redirect(new URL("/", request.url));
    } catch (error) {
      message = error instanceof Error ? error.message : "Could not confirm your email. Please try again.";
    }
  }
  const url = new URL("/login", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}
