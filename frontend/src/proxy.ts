import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// ENABLE_AUTH=true の場合のみ認証を必須にする。
// false(既定)の場合は誰でもアクセス可能(開発・検証用)。
// Next.js 16でmiddleware.tsはproxy.tsに名称変更された(挙動は同じ)。
export async function proxy(request: NextRequest) {
  if (process.env.ENABLE_AUTH !== "true") {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (token) {
    return NextResponse.next();
  }

  const signInUrl = new URL("/login", request.url);
  signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};
