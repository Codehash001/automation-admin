import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyApiKey } from '@/lib/auth';

export async function withApiKeyAuth(request: NextRequest) {
  // Skip auth for OPTIONS requests (preflight)
  if (request.method === 'OPTIONS') {
    return NextResponse.next();
  }

  // Get API key from Authorization header
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing or invalid Authorization header' },
      { status: 401 }
    );
  }

  const apiKey = authHeader.split(' ')[1];
  if (!apiKey) {
    return NextResponse.json(
      { error: 'API key is required' },
      { status: 401 }
    );
  }

  // Verify the API key
  const verification = await verifyApiKey(apiKey);
  if (verification.error || !verification.user) {
    return NextResponse.json(
      { error: verification.error || 'Invalid API key' },
      { status: 401 }
    );
  }

  // Add user info to the request headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', String(verification.user.id));
  requestHeaders.set('x-user-email', verification.user.email || '');
  requestHeaders.set('x-user-role', verification.user.role || '');

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}
