import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { randomBytes, createHash } from 'crypto';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name: string;
}

export interface AuthResult {
  user: AuthUser | null;
  error: string | null;
  status?: number;
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');
const TOKEN_EXPIRY = '1d';

// Only import Prisma client when needed to avoid client-side issues
async function getPrisma() {
  const { PrismaClient } = await import('@prisma/client');
  return new PrismaClient();
}

export async function createSessionToken(user: AuthUser): Promise<string> {
  return await new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifySession(token: string): Promise<AuthResult> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    // Handle both 'id' and 'userId' for backward compatibility
    const userId = payload.userId || payload.id;
    if (!userId) {
      console.error('No user ID found in JWT payload');
      return { user: null, error: 'Invalid token: missing user ID' };
    }

    return {
      user: {
        id: String(userId), // Ensure ID is always a string
        email: payload.email as string || '',
        role: payload.role as string || '',
        name: (payload.name as string) || '',
      },
      error: null,
    };
  } catch (error) {
    console.error('Session verification failed:', error);
    return { user: null, error: 'Invalid or expired session' };
  }
}

function generateApiKey(): { key: string; hashedKey: string } {
  // Generate a random API key
  const key = `sk_${randomBytes(32).toString('hex')}`;
  // Hash the key for storage
  const hashedKey = createHash('sha256').update(key).digest('hex');
  return { key, hashedKey };
}

export async function createApiKey(userId: string | number, name: string) {
  const prisma = await getPrisma();
  
  try {
    console.log(`Creating API key for user ${userId} with name: ${name}`);
    
    // Generate API key and hash
    const { key, hashedKey } = generateApiKey();
    
    // Create the API key in the database with the hashed key
    const apiKey = await prisma.apiKey.create({
      data: {
        key: hashedKey, // Store only the hashed key
        name,
        userId: Number(userId), // Ensure userId is a number
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
    });

    console.log(`Successfully created API key with ID: ${apiKey.id}`);
    
    // Return the plaintext key only once during creation
    return {
      ...apiKey,
      key, // Return the plaintext key only once
    };
  } catch (error) {
    console.error('Error creating API key:', error);
    throw error;
  } finally {
    if (prisma) {
      await prisma.$disconnect().catch(console.error);
    }
  }
}

export async function verifyApiKey(apiKey: string): Promise<AuthResult> {
  if (!apiKey) {
    console.error('No API key provided');
    return { user: null, error: 'API key is required' };
  }

  const prisma = await getPrisma();
  
  try {
    console.log('Verifying API key. First 5 chars:', apiKey.substring(0, 5) + '...');
    
    // Hash the provided API key for comparison
    const hashedApiKey = createHash('sha256').update(apiKey).digest('hex');
    console.log('Hashed API key:', hashedApiKey.substring(0, 10) + '...');
    
    // Find the API key record with the hashed key and include the user data
    const now = new Date();
    console.log('Current time:', now);
    
    const apiKeyRecord = await prisma.apiKey.findFirst({
      where: { 
        key: hashedApiKey,
        revoked: false,
        OR: [
          // Check for non-expired keys
          {
            expiresAt: {
              gte: now
            }
          },
        ]
      },
      include: { 
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            name: true
          }
        } 
      },
    });

    console.log('API key record found:', !!apiKeyRecord);

    if (!apiKeyRecord) {
      console.error('No valid API key found for hash:', hashedApiKey.substring(0, 10) + '...');
      return { user: null, error: 'Invalid or expired API key' };
    }

    if (!apiKeyRecord.user) {
      console.error('No user associated with API key:', apiKeyRecord.id);
      return { user: null, error: 'No user associated with this API key' };
    }

    console.log('API key user:', {
      id: apiKeyRecord.user.id,
      email: apiKeyRecord.user.email,
      role: apiKeyRecord.user.role
    });

    // Update last used timestamp
    await prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      user: {
        id: apiKeyRecord.user.id.toString(),
        email: apiKeyRecord.user.email,
        role: apiKeyRecord.user.role,
        name: apiKeyRecord.user.name || '',
      },
      error: null,
    };
  } catch (error) {
    console.error('Error in verifyApiKey:', error);
    return { user: null, error: 'Failed to verify API key' };
  } finally {
    await prisma.$disconnect().catch(error => {
      console.error('Error disconnecting Prisma:', error);
    });
  }
}

export async function getUserApiKeys(userId: string | number | undefined) {
  const prisma = await getPrisma();
  
  try {
    // Validate userId
    if (userId === undefined || userId === null) {
      throw new Error('User ID is required');
    }
    
    const numericUserId = Number(userId);
    if (isNaN(numericUserId)) {
      throw new Error('Invalid user ID');
    }
    
    console.log(`Fetching API keys for user ${numericUserId}`);
    
    const apiKeys = await prisma.apiKey.findMany({
      where: { 
        userId: numericUserId,
        revoked: false,
        OR: [
          { expiresAt: { gte: new Date() } },
        ]
      },
      select: {
        id: true,
        name: true,
        key: false, // Never return the hashed key in a list
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    
    return apiKeys.map(key => ({
      ...key,
      expiresAt: key.expiresAt ? key.expiresAt.toISOString() : null,
      createdAt: key.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error('Error in getUserApiKeys:', error);
    throw error; // Re-throw to be handled by the caller
  } finally {
    await prisma.$disconnect().catch(console.error);
  }
}

export async function revokeApiKey(id: string | number, userId: string | number) {
  const prisma = await getPrisma();
  
  try {
    console.log(`Revoking API key ${id} for user ${userId}`);
    
    // First, verify the API key belongs to the user
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: Number(id) },
    });

    if (!apiKey) {
      throw new Error('API key not found');
    }

    if (apiKey.userId != Number(userId)) {
      throw new Error('Unauthorized');
    }

    // Mark the key as revoked
    await prisma.apiKey.update({
      where: { id: Number(id) },
      data: { revoked: true },
    });

    console.log(`Successfully revoked API key ${id}`);
  } catch (error) {
    console.error('Error revoking API key:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

export async function getCurrentUserFromRequest(req: NextRequest): Promise<AuthUser | null> {
  // First try to get user from session cookie
  const sessionToken = req.cookies.get('auth-token')?.value;
  if (sessionToken) {
    const result = await verifySession(sessionToken);
    if (result.user) return result.user;
  }

  // Then try API key from Authorization header
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const apiKey = authHeader.split(' ')[1];
    const result = await verifyApiKey(apiKey);
    if (result.user) return result.user;
  }

  return null;
}