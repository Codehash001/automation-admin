import { NextRequest, NextResponse } from 'next/server';
import { verifySession, verifyApiKey } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header. Use Bearer token.' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 401 }
      );
    }

    // Try to verify as API key first (API keys start with 'sk_')
    if (token.startsWith('sk_')) {
      const authResult = await verifyApiKey(token);
      
      if (authResult.error || !authResult.user) {
        console.error('API key verification failed:', authResult.error);
        return NextResponse.json(
          { error: authResult.error || 'Invalid API key' },
          { status: 401 }
        );
      }

      return NextResponse.json({
        user: {
          id: authResult.user.id,
          email: authResult.user.email || '',
          role: authResult.user.role || '',
          name: authResult.user.name || ''
        }
      });
    }
    
    // If not an API key, try to verify as session token
    const authResult = await verifySession(token);
    
    if (authResult.error || !authResult.user) {
      console.error('Session verification failed:', authResult.error);
      return NextResponse.json(
        { error: authResult.error || 'Invalid token' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: {
        id: authResult.user.id,
        email: authResult.user.email || '',
        role: authResult.user.role || '',
        name: authResult.user.name || ''
      }
    });
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error during verification' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
