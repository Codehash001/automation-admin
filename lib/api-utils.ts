import { NextRequest, NextResponse } from 'next/server';
import { AuthUser } from './auth';

type Handler = (
  req: NextRequest,
  context: { params: Record<string, string>; user: AuthUser }
) => Promise<NextResponse>;

type RouteConfig = {
  public?: boolean;
  roles?: string[];
  handler: Handler;
};

export function withAuth(routeConfig: RouteConfig) {
  return async function (
    req: NextRequest,
    { params }: { params: Record<string, string> }
  ) {
    // Skip auth for public routes
    if (routeConfig.public) {
      return routeConfig.handler(req, { params, user: null! });
    }

    // Get user from request headers (set by middleware)
    const userHeader = req.headers.get('x-user');
    
    if (!userHeader) {
      // If no user in headers, check for API key
      const authHeader = req.headers.get('authorization');
      
      if (authHeader?.startsWith('Bearer ')) {
        const apiKey = authHeader.split(' ')[1];
        try {
          // Import dynamically to avoid Prisma client in middleware
          const { verifyApiKey } = await import('./auth');
          const result = await verifyApiKey(apiKey);
          
          if (result.error || !result.user) {
            return NextResponse.json(
              { error: result.error || 'Invalid API key' },
              { status: 401 }
            );
          }
          
          // Check role-based access for API key
          if (routeConfig.roles?.length && !routeConfig.roles.includes(result.user.role)) {
            return NextResponse.json(
              { error: 'Insufficient permissions' },
              { status: 403 }
            );
          }
          
          return routeConfig.handler(req, { params, user: result.user });
          
        } catch (error) {
          return handleApiError(error);
        }
      }
      
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Parse user from headers
    const user = JSON.parse(userHeader) as AuthUser;
    
    // Check role-based access for session user
    if (routeConfig.roles?.length && !routeConfig.roles.includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }
    
    return routeConfig.handler(req, { params, user });
  };
}

export function handleApiError(error: any) {
  console.error('API Error:', error);
  
  if (error instanceof Error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
  
  return NextResponse.json(
    { error: 'An unknown error occurred' },
    { status: 500 }
  );
}
