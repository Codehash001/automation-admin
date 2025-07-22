import { NextResponse, NextRequest } from 'next/server';
import { createApiKey, getUserApiKeys, revokeApiKey } from '@/lib/auth';

// GET - Get all API keys for the authenticated user
export async function GET(request: NextRequest) {
  try {
    // Get user ID from headers
    const userId = request.headers.get('x-user-id');
    
    // Log all headers for debugging
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));
    
    if (!userId) {
      console.error('No user ID found in headers');
      return NextResponse.json(
        { error: 'Authentication required. Please log in again.' },
        { status: 401 }
      );
    }

    // Convert to number and validate
    const numericUserId = Number(userId);
    if (isNaN(numericUserId) || numericUserId <= 0) {
      console.error('Invalid user ID format:', userId);
      return NextResponse.json(
        { error: 'Invalid user session. Please log in again.' },
        { status: 401 }
      );
    }

    console.log(`[API Keys] Fetching API keys for user ${numericUserId}`);
    
    try {
      const apiKeys = await getUserApiKeys(numericUserId);
      console.log(`[API Keys] Successfully retrieved ${apiKeys.length} API keys for user ${numericUserId}`);
      return NextResponse.json(apiKeys);
    } catch (error) {
      console.error(`[API Keys] Error in getUserApiKeys for user ${numericUserId}:`, error);
      
      if (error instanceof Error) {
        if (error.message.includes('User ID is required') || error.message.includes('Invalid user ID')) {
          return NextResponse.json(
            { error: 'Invalid user session. Please log in again.' },
            { status: 401 }
          );
        }
      }
      
      return NextResponse.json(
        { error: 'Failed to fetch API keys. Please try again later.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[API Keys] Unexpected error in GET /api/auth/api-keys:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 }
    );
  }
}

// POST - Create a new API key
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { name } = await request.json();
    
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'API key name is required' },
        { status: 400 }
      );
    }

    const numericUserId = Number(userId);
    if (isNaN(numericUserId) || numericUserId <= 0) {
      return NextResponse.json(
        { error: 'Invalid user session' },
        { status: 401 }
      );
    }

    const apiKey = await createApiKey(numericUserId, name);
    return NextResponse.json(apiKey);
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}

// DELETE - Revoke an API key
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await request.json();
    
    if (!id) {
      return NextResponse.json(
        { error: 'API key ID is required' },
        { status: 400 }
      );
    }

    const numericUserId = Number(userId);
    if (isNaN(numericUserId) || numericUserId <= 0) {
      return NextResponse.json(
        { error: 'Invalid user session' },
        { status: 401 }
      );
    }

    await revokeApiKey(id, numericUserId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking API key:', error);
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 }
    );
  }
}

// CORS headers for preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-user-id',
    },
  });
}
