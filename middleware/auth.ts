import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth';

// List of public paths that don't require authentication
const publicPaths = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/public',
];

// List of admin paths that require admin role
const adminPaths = [
  '/api/admin',
  '/api/auth/users',
  '/api/auth/api-keys'
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Get the auth token from cookies
  const token = request.cookies.get('auth-token')?.value;
  
  if (!token) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Verify the session
  const result = await verifySession(token);
  
  if (result.error || !result.user) {
    return NextResponse.json(
      { error: result.error || 'Invalid session' },
      { status: result.status || 401 }
    );
  }

  // Check admin access for admin paths
  const isAdminPath = adminPaths.some(path => pathname.startsWith(path));
  if (isAdminPath && result.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  // Add user to request headers for API routes to access
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', result.user.id.toString());
  requestHeaders.set('x-user-role', result.user.role);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
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
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
