const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createSuperAdmin() {
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'pintoroyson@gmail.com' }
    });

    if (existingUser) {
      console.log('❌ User with email pintoroyson@gmail.com already exists');
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash('pintoroyson@gmail.com', 10);

    // Create the Super Admin user
    const user = await prisma.user.create({
      data: {
        email: 'pintoroyson@gmail.com',
        password: hashedPassword,
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        isActive: true,
      }
    });

    console.log('✅ Super Admin user created successfully!');
    console.log('📧 Email:', user.email);
    console.log('👤 Name:', user.name);
    console.log('🔐 Role:', user.role);
    console.log('🆔 User ID:', user.id);
    console.log('📅 Created:', user.createdAt);

  } catch (error) {
    console.error('❌ Error creating Super Admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSuperAdmin();
