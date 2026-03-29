import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChefHat, ArrowRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const SignupPage = () => {
  const { auth, checkAuth } = useStore();
  const navigate = useNavigate();

  const [step, setStep] = useState<'account' | 'restaurant'>('account');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Account fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Restaurant fields
  const [restaurantName, setRestaurantName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (auth.isAuthenticated && auth.role === 'admin') {
      navigate('/admin');
    }
  }, [auth, navigate]);

  const handleAccountStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Auto sign-in after signup
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError('Account created but sign-in failed. Please go to login.');
      setLoading(false);
      return;
    }

    setStep('restaurant');
    setLoading(false);
  };

  const handleRestaurantStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (restaurantName.trim().length < 2) {
      setError('Restaurant name must be at least 2 characters');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Session expired. Please log in again.');
        setLoading(false);
        return;
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || `https://${projectId}.supabase.co`;

      const res = await fetch(`${supabaseUrl}/functions/v1/restaurant-signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          restaurant_name: restaurantName,
          phone,
          address,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        setError(result.error || 'Failed to create restaurant');
        setLoading(false);
        return;
      }

      toast.success('Restaurant created! Redirecting to setup...');
      await checkAuth();
      navigate(`/setup?restaurant_id=${result.restaurant_id}`);
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
            <ChefHat className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">
            {step === 'account' ? 'Create Your Account' : 'Set Up Your Restaurant'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {step === 'account'
              ? 'Step 1 of 2 — Create your admin account'
              : 'Step 2 of 2 — Tell us about your restaurant'}
          </p>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-6">
          <div className={`h-1.5 flex-1 rounded-full ${step === 'account' ? 'bg-primary' : 'bg-primary'}`} />
          <div className={`h-1.5 flex-1 rounded-full ${step === 'restaurant' ? 'bg-primary' : 'bg-muted'}`} />
        </div>

        {step === 'account' ? (
          <form onSubmit={handleAccountStep} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@restaurant.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm Password</Label>
              <Input id="confirm" type="password" placeholder="Repeat password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            {error && <p className="text-destructive text-sm text-center">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating...' : 'Continue'} <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <button type="button" className="text-primary underline" onClick={() => navigate('/login')}>Log in</button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleRestaurantStep} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rname">Restaurant Name *</Label>
              <Input id="rname" placeholder="e.g. Bella Italia" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" placeholder="+1 555 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addr">Address</Label>
              <Input id="addr" placeholder="123 Main St, City" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            {error && <p className="text-destructive text-sm text-center">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep('account')}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? 'Creating...' : 'Create Restaurant'} <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default SignupPage;
