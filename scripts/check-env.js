// Check environment variables and database connection
const { PrismaClient } = require('@prisma/client');

async function checkEnvironment() {
  console.log('🔍 Checking environment variables...');
  
  // Check JWT_SECRET
  const jwtSecret = process.env.JWT_SECRET;
  console.log('🔑 JWT_SECRET:', jwtSecret ? '✅ Set' : '❌ Not set');
  
  // Check DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  console.log('🗄️ DATABASE_URL:', databaseUrl ? '✅ Set' : '❌ Not set');
  
  // Check NODE_ENV
  console.log('🌍 NODE_ENV:', process.env.NODE_ENV || 'not set');
  
  // Test database connection
  console.log('\n🔍 Testing database connection...');
  const prisma = new PrismaClient();
  
  try {
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Count users
    const userCount = await prisma.user.count();
    console.log('👥 Total users in database:', userCount);
    
    // Check if our test user exists
    const testUser = await prisma.user.findUnique({
      where: { email: 'pintoroyson@gmail.com' }
    });
    
    if (testUser) {
      console.log('✅ Test user exists:', {
        id: testUser.id,
        email: testUser.email,
        role: testUser.role,
        isActive: testUser.isActive
      });
    } else {
      console.log('❌ Test user not found');
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkEnvironment();
