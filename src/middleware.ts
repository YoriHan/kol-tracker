import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Hotfix 2026-05-27: previously every request — including unauthenticated
 * `/` hits — invoked `supabase.auth.getUser()` from the edge runtime. From
 * Vercel's Tokyo edge (hnd1) the round-trip to Supabase plus a cold-start
 * exceeded the middleware timeout, returning 504 MIDDLEWARE_INVOCATION_TIMEOUT.
 *
 * Cookie-presence short-circuit:
 * - No Supabase auth cookie → user is definitely unauthenticated; skip the
 *   network call, redirect non-login paths to /login, let /login render.
 * - Cookie present → fall through to the original Supabase session check
 *   (its result also drives redirect-away-from-login when authed).
 *
 * Supabase's SSR helper stores the session in cookies prefixed `sb-` (the
 * exact name embeds the project ref). Pattern-match the prefix; never trust
 * the cookie's contents — `getUser()` still validates server-side below.
 */
function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => c.name.startsWith('sb-'))
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isLogin = pathname.startsWith('/login')

  // Fast path: no auth cookie → skip Supabase entirely.
  if (!hasSupabaseAuthCookie(request)) {
    if (isLogin) return NextResponse.next({ request })
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Cookie present but invalid/expired — treat as unauthenticated.
  if (!user && !isLogin) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated user on /login → bounce to root.
  if (user && isLogin) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
