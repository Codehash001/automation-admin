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
  '/api/food',
  '/api/emirates',
  
];



export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for public paths and static files
  if (
    publicPaths.some(path => pathname.startsWith(path)) ||
    pathname.includes('.') ||
    pathname.startsWith('/_next') ||
    pathname === '/api/auth/verify' || // Skip verification endpoint
    pathname === '/login' ||
    pathname === '/' ||
    pathname === '/dashboard'
  ) {
    return NextResponse.next();
  }

  // Check if this is an API key authenticated path
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  
  // Handle API key authentication for protected paths
  if (!isPublicPath) {
    const authHeader = request.headers.get('authorization');
    
    // Try API key authentication if Authorization header is present
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const verificationResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/auth/verify`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
        });

        if (verificationResponse.ok) {
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
        }
      } catch (error) {
        console.error('API key verification failed:', error);
        // Continue to try session auth if API key verification fails
      }
    }

    // If API key auth failed or wasn't attempted, try session auth
    const sessionToken = request.cookies.get('auth-token')?.value;
    if (sessionToken) {
      try {
        const authResult = await verifySession(sessionToken);
        
        if (authResult.user) {
          // Clone the request headers and add user info
          const requestHeaders = new Headers(request.headers);
          requestHeaders.set('x-user-id', String(authResult.user.id));
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
      } catch (error) {
        console.error('Session verification failed:', error);
      }
    }

    // If both authentication methods failed, return 401
    return NextResponse.json(
      { error: 'Authentication required. Please provide a valid API key or session.' },
      { status: 401 }
    );
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