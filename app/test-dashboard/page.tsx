'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function TestDashboardPage() {
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      console.log('🔍 Checking authentication status...');
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      
      setAuthStatus({
        status: response.status,
        ok: response.ok,
        data: data,
        cookies: document.cookie
      });
      
      console.log('🔍 Auth status:', {
        status: response.status,
        ok: response.ok,
        data: data
      });
      
    } catch (error) {
      console.error('🔍 Auth check error:', error);
      setAuthStatus({
        error: error as string
      });
    } finally {
      setLoading(false);
    }
  };

  const goToDashboard = () => {
    window.location.href = '/dashboard';
  };

  const goToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>🧪 Dashboard Access Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={checkAuth}>
                Refresh Auth Status
              </Button>
              <Button onClick={goToDashboard} variant="outline">
                Go to Dashboard
              </Button>
              <Button onClick={goToLogin} variant="outline">
                Go to Login
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Authentication Status</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading...</p>
            ) : (
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(authStatus, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Browser Info</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify({
                currentUrl: window.location.href,
                cookies: document.cookie,
                userAgent: navigator.userAgent
              }, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
