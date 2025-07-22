import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth';

// List of public paths that don't require authentication
const publicPaths = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/public',
  '/_next',
  '/favicon.ico',
];

// Paths that require API key authentication
const apiKeyPaths = [
  '/api/food/cuisine',
  // Add other API paths that should use API key auth
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for public paths and static files
  if (
    publicPaths.some(path => pathname.startsWith(path)) ||
    pathname.includes('.') ||
    pathname.startsWith('/_next') ||
    pathname === '/api/auth/verify' // Skip verification endpoint
    || pathname === '/login'
    || pathname === '/'
    || pathname === '/dashboard'
  ) {
    return NextResponse.next();
  }

  // Check if this is an API key authenticated path
  const isApiKeyPath = apiKeyPaths.some(path => pathname.startsWith(path));
  
  // Handle API key authentication
  if (isApiKeyPath) {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header. Use Bearer token.' },
        { status: 401 }
      );
    }

    try {
      // Call our verification endpoint
      // const verificationUrl = new URL('/api/auth/verify', request.url);
      const verificationResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/verify`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      });

      if (!verificationResponse.ok) {
        const error = await verificationResponse.json();
        return NextResponse.json(
          { error: error.error || 'Invalid API key' },
          { status: 401 }
        );
      }

      const { user } = await verificationResponse.json();
      
      // Clone the request headers and add user info
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', String(user.id));
      requestHeaders.set('x-user-email', user.email || '');
      requestHeaders.set('x-user-role', user.role || '');
      requestHeaders.set('x-user-name', user.name || '');
      requestHeaders.set('x-auth-method', 'api-key');

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    } catch (error) {
      console.error('API key verification failed:', error);
      return NextResponse.json(
        { error: 'Failed to verify API key' },
        { status: 500 }
      );
    }
  }

  // Handle session-based authentication for other protected routes
  const sessionToken = request.cookies.get('auth-token')?.value;
  
  if (!sessionToken) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Verify the session
  const authResult = await verifySession(sessionToken);
  
  if (authResult.error || !authResult.user) {
    // Clear invalid session cookie
    const response = NextResponse.json(
      { error: authResult.error || 'Invalid session' },
      { status: 401 }
    );
    response.cookies.delete('auth-token');
    return response;
  }

  // Ensure we have a valid user ID
  const userId = authResult.user?.id;
  if (!userId) {
    console.error('No user ID in auth result:', authResult);
    return NextResponse.json(
      { error: 'Invalid user session' },
      { status: 401 }
    );
  }

  // Add user info to the request headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', String(userId));
  requestHeaders.set('x-user-email', authResult.user.email || '');
  requestHeaders.set('x-user-role', authResult.user.role || '');
  requestHeaders.set('x-user-name', authResult.user.name || '');
  requestHeaders.set('x-auth-method', 'session');

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
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};