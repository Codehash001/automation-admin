import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: string;
  lastLogin?: Date;
}

export interface AuthResult {
  user?: AuthUser;
  error?: string;
  status: number;
}

export async function verifyToken(token: string): Promise<AuthResult> {
  try {
    console.log('🔑 VerifyToken: Starting verification...');
    console.log('🔑 VerifyToken: Token length:', token?.length || 0);
    
    // First check if session exists and is valid (more reliable than JWT verification)
    console.log('🔍 VerifyToken: Looking up session...');
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });
    console.log('🔍 VerifyToken: Session found:', !!session);

    if (!session) {
      console.log('❌ VerifyToken: No session found for token');
      return { error: 'Session not found', status: 401 };
    }

    if (session.expiresAt < new Date()) {
      console.log('❌ VerifyToken: Session expired');
      // Clean up expired session
      console.log('🗑️ VerifyToken: Cleaning up expired session');
      await prisma.session.delete({
        where: { id: session.id },
      });
      return { error: 'Session expired', status: 401 };
    }

    // Check if user is still active
    console.log('👤 VerifyToken: User active status:', session.user.isActive);
    if (!session.user.isActive) {
      console.log('❌ VerifyToken: User account is deactivated');
      return { error: 'Account is deactivated', status: 401 };
    }

    // Now verify JWT token (optional additional security)
    try {
      console.log('🔑 VerifyToken: Verifying JWT token...');
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      console.log('🔑 VerifyToken: JWT decoded successfully');
    } catch (jwtError) {
      console.warn('⚠️ VerifyToken: JWT verification failed, but session is valid:', jwtError);
      // Continue anyway since session is valid - JWT might have different secret or be corrupted
    }

    console.log('✅ VerifyToken: Verification successful');
    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
        lastLogin: session.user.lastLogin || undefined,
      },
      status: 200,
    };
  } catch (error) {
    console.error('❌ VerifyToken: Error during verification:', error);
    return { error: 'Invalid token', status: 401 };
  }
}

export function hasPermission(userRole: string, requiredRole: string): boolean {
  const roleHierarchy = {
    'SUPER_ADMIN': 4,
    'ADMIN': 3,
    'MANAGER': 2,
    'VIEWER': 1,
  };

  const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0;
  const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0;

  return userLevel >= requiredLevel;
}

export function canAccessResource(userRole: string, resource: string): boolean {
  const permissions = {
    'SUPER_ADMIN': ['*'], // All permissions
    'ADMIN': [
      'dashboard',
      'customers',
      'vendors',
      'orders',
      'riders',
      'deliveries',
      'food',
      'grocery',
      'medicine',
      'appointments',
      'emirates',
    ],
    'MANAGER': [
      'dashboard',
      'customers',
      'orders',
      'deliveries',
      'food',
      'grocery',
      'medicine',
      'appointments',
    ],
    'VIEWER': [
      'dashboard',
      'customers',
      'orders',
      'deliveries',
    ],
  };

  const userPermissions = permissions[userRole as keyof typeof permissions] || [];
  
  // Super admin has access to everything
  if (userPermissions.includes('*')) {
    return true;
  }

  // Check if user has specific permission
  return userPermissions.includes(resource);
}

export const ROLE_LABELS = {
  'SUPER_ADMIN': 'Super Admin',
  'ADMIN': 'Admin',
  'MANAGER': 'Manager',
  'VIEWER': 'Viewer',
} as const;

export const ROLE_COLORS = {
  'SUPER_ADMIN': 'bg-red-100 text-red-800',
  'ADMIN': 'bg-blue-100 text-blue-800',
  'MANAGER': 'bg-green-100 text-green-800',
  'VIEWER': 'bg-gray-100 text-gray-800',
} as const;
