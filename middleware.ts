import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for public routes and API routes that don't need auth
  if (
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/auth/verify') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname === '/'
  ) {
    return NextResponse.next();
  }

  // Check if accessing dashboard routes
  if (pathname.startsWith('/dashboard')) {
    console.log('🚪 Middleware: Checking dashboard access for:', pathname);
    const token = request.cookies.get('auth-token')?.value;
    console.log('🍪 Middleware: Token present:', !!token);
    console.log('🍪 Middleware: Token length:', token?.length || 0);

    if (!token) {
      console.log('❌ Middleware: No token, redirecting to login');
      // Redirect to login if no token
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      console.log('🔍 Middleware: Verifying token via API...');
      
      // Call the verification API endpoint
      const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      console.log('🔍 Middleware: Verification API response status:', verifyResponse.status);

      if (!verifyResponse.ok) {
        console.log('❌ Middleware: Token verification failed, redirecting to login');
        // Clear invalid token and redirect to login
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.delete('auth-token');
        return response;
      }

      const { user } = await verifyResponse.json();
      console.log('✅ Middleware: Token valid, allowing access');

      // Add user info to headers for use in components
      const response = NextResponse.next();
      response.headers.set('x-user-id', user.id.toString());
      response.headers.set('x-user-email', user.email);
      response.headers.set('x-user-role', user.role);
      response.headers.set('x-user-name', user.name);
      
      return response;
    } catch (error) {
      console.error('❌ Middleware: Token verification error:', error);
      // Clear invalid token and redirect to login
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('auth-token');
      return response;
    }
  }

  // For API routes that need authentication
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/login') && !pathname.startsWith('/api/auth/verify')) {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    try {
      // Call the verification API endpoint
      const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (!verifyResponse.ok) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }

      const { user } = await verifyResponse.json();

      // Add user info to headers for use in API routes
      const response = NextResponse.next();
      response.headers.set('x-user-id', user.id.toString());
      response.headers.set('x-user-email', user.email);
      response.headers.set('x-user-role', user.role);
      response.headers.set('x-user-name', user.name);
      
      return response;
    } catch (error) {
      console.error('API middleware error:', error);
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};