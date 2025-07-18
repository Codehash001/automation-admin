// Check JWT_SECRET configuration
const jwt = require('jsonwebtoken');

console.log('🔍 Checking JWT_SECRET configuration...');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

console.log('🔑 JWT_SECRET from env:', process.env.JWT_SECRET ? 'Set' : 'Not set');
console.log('🔑 JWT_SECRET being used:', JWT_SECRET);
console.log('🔑 JWT_SECRET length:', JWT_SECRET.length);

// Test JWT creation and verification
console.log('\n🧪 Testing JWT creation and verification...');

try {
  const testPayload = { userId: 1, email: 'test@example.com' };
  
  // Create token
  const token = jwt.sign(testPayload, JWT_SECRET, { expiresIn: '1h' });
  console.log('✅ JWT token created successfully');
  console.log('🔑 Token length:', token.length);
  
  // Verify token
  const decoded = jwt.verify(token, JWT_SECRET);
  console.log('✅ JWT token verified successfully');
  console.log('📋 Decoded payload:', decoded);
  
} catch (error) {
  console.error('❌ JWT test failed:', error.message);
}

console.log('\n🔍 Environment variables:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
