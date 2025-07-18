const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function verifyUser(email) {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('✅ User found in database:');
    console.log('🆔 ID:', user.id);
    console.log('📧 Email:', user.email);
    console.log('👤 Name:', user.name);
    console.log('🔐 Role:', user.role);
    console.log('✅ Active:', user.isActive);
    console.log('📅 Created:', user.createdAt);
    console.log('🔄 Updated:', user.updatedAt);
    console.log('🕐 Last Login:', user.lastLogin || 'Never');

    // Test password verification
    const isPasswordValid = await bcrypt.compare('pintoroyson@gmail.com', user.password);
    console.log('🔑 Password Test:', isPasswordValid ? '✅ Valid' : '❌ Invalid');

  } catch (error) {
    console.error('❌ Error verifying user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line argument or use default
const email = process.argv[2] || 'pintoroyson@gmail.com';
verifyUser(email);
