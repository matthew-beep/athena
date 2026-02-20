'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassInput } from '@/components/ui/GlassInput';
import { GlassButton } from '@/components/ui/GlassButton';
import type { TokenResponse, User } from '@/types';

export function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const tokenRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!tokenRes.ok) {
        const data = await tokenRes.json().catch(() => ({}));
        setError((data as { detail?: string }).detail ?? 'Invalid credentials');
        return;
      }

      const { access_token } = (await tokenRes.json()) as TokenResponse;

      const userRes = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const user = (await userRes.json()) as User;

      setAuth(access_token, user);
      router.replace('/chat');
    } catch {
      setError('Connection error. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      {/* Ceiling light */}
      <div
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2"
        style={{
          width: '400px',
          height: '1px',
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.10) 30%, rgba(255,255,255,0.16) 50%, rgba(255,255,255,0.10) 70%, transparent)',
          boxShadow: '0 0 60px 15px rgba(255,255,255,0.03)',
        }}
      />

      <div className="relative w-full max-w-xs px-4 animate-scale-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-foreground/10 border border-foreground/20 flex items-center justify-center">
            <span className="text-2xl font-bold font-display text-foreground">A</span>
          </div>
          <h1 className="text-xl font-display font-bold tracking-tight">Athena</h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            Personal AI Infrastructure
          </p>
        </div>

        <GlassCard variant="strong" className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <GlassInput
              id="username"
              label="Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
            <GlassInput
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <GlassButton
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-1"
              loading={loading}
            >
              Sign In
            </GlassButton>
          </form>
        </GlassCard>

        <p className="text-center text-xs text-muted-foreground/50 font-mono mt-4">
          admin / athena
        </p>
      </div>
    </div>
  );
}
