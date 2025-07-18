'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestLoginPage() {
  const [email, setEmail] = useState('pintoroyson@gmail.com');
  const [password, setPassword] = useState('pintoroyson@gmail.com');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testLogin = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      console.log('🧪 Testing login with:', { email, password: password.length + ' chars' });
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      
      setResult({
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        data: data,
        cookies: document.cookie
      });
      
      console.log('🧪 Test result:', {
        status: response.status,
        ok: response.ok,
        data: data
      });
      
    } catch (error) {
      console.error('🧪 Test error:', error);
      setResult({
        error: error as string
      });
    } finally {
      setLoading(false);
    }
  };

  const testAuthMe = async () => {
    try {
      console.log('🧪 Testing /api/auth/me');
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      
      console.log('🧪 Auth me result:', {
        status: response.status,
        data: data
      });
      
      setResult({
        endpoint: '/api/auth/me',
        status: response.status,
        ok: response.ok,
        data: data
      });
      
    } catch (error) {
      console.error('🧪 Auth me error:', error);
      setResult({
        endpoint: '/api/auth/me',
        error: error as string
      });
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>🧪 Login API Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2">
              <Button onClick={testLogin} disabled={loading}>
                {loading ? 'Testing...' : 'Test Login'}
              </Button>
              <Button onClick={testAuthMe} variant="outline">
                Test Auth Me
              </Button>
            </div>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Test Result</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Open browser developer tools (F12)</li>
              <li>Go to Console tab</li>
              <li>Click "Test Login" button</li>
              <li>Check console logs for detailed debugging info</li>
              <li>Check Network tab for API request details</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
