import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Public paths that don't require authentication
  const publicPaths = [
    '/auth/login',
    '/auth/register',
    '/auth/error',
    '/',
  ];

  // Check if current path is public
  const isPublicPath = publicPaths.some(path => pathname === path || pathname.startsWith('/_next') || pathname.startsWith('/api/auth'));

  if (isPublicPath) {
    return NextResponse.next();
  }

  // Protected paths that require authentication
  const protectedPaths = ['/trips', '/profile', '/api/trips', '/api/expenses', '/api/proposals', '/api/lists', '/api/notifications'];
  const isProtected = protectedPaths.some(path => pathname.startsWith(path));

  if (isProtected) {
    // Check for session token in cookies
    const sessionToken = request.cookies.get('next-auth.session-token') || request.cookies.get('__Secure-next-auth.session-token');

    if (!sessionToken) {
      const url = new URL('/auth/login', request.url);
      url.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
