import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock } from 'lucide-react';

const LoginPage = () => {
  const { login } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = login(username, password);
    if (!ok) setError('Invalid credentials. Try chef/chef123 or admin/admin123');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-sm w-full animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Staff Login</h1>
          <p className="text-muted-foreground text-sm mt-1">Kitchen or Admin access</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-destructive text-sm text-center">{error}</p>}
          <Button type="submit" className="w-full">Login</Button>
        </form>

        <div className="mt-6 p-3 bg-muted rounded-lg text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Demo Credentials:</p>
          <p>Chef: <code className="font-mono">chef / chef123</code></p>
          <p>Admin: <code className="font-mono">admin / admin123</code></p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
