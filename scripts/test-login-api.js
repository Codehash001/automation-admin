const fetch = require('node-fetch');

async function testLoginAPI() {
  try {
    console.log('🧪 Testing login API endpoint...');
    
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'pintoroyson@gmail.com',
        password: 'pintoroyson@gmail.com'
      }),
    });

    console.log('📊 Response Status:', response.status);
    console.log('📊 Response Headers:', Object.fromEntries(response.headers.entries()));

    const data = await response.text();
    console.log('📊 Response Body:', data);

    if (response.ok) {
      console.log('✅ Login API test successful!');
      try {
        const jsonData = JSON.parse(data);
        console.log('👤 User Data:', jsonData.user);
      } catch (e) {
        console.log('⚠️ Response is not JSON');
      }
    } else {
      console.log('❌ Login API test failed');
    }

  } catch (error) {
    console.error('❌ Error testing login API:', error.message);
    console.log('💡 Make sure the development server is running on http://localhost:3000');
  }
}

testLoginAPI();
