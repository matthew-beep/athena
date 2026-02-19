import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/auth.store";
import { GlassCard } from "../ui/GlassCard";
import { GlassInput } from "../ui/GlassInput";
import { GlassButton } from "../ui/GlassButton";
import type { TokenResponse, User } from "../../types";

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const tokenRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!tokenRes.ok) {
        const data = await tokenRes.json().catch(() => ({}));
        setError((data as { detail?: string }).detail ?? "Invalid credentials");
        return;
      }

      const { access_token } = (await tokenRes.json()) as TokenResponse;

      const userRes = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const user = (await userRes.json()) as User;

      setAuth(access_token, user);
      navigate("/");
    } catch {
      setError("Connection error. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm px-4 animate-scale-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center animate-float">
            <span className="text-3xl font-bold text-primary">A</span>
          </div>
          <h1 className="text-2xl font-bold">Athena</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Personal AI Infrastructure
          </p>
        </div>

        <GlassCard variant="strong" className="p-6">
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
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <GlassButton
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              loading={loading}
            >
              Sign In
            </GlassButton>
          </form>
        </GlassCard>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Default: admin / athena
        </p>
      </div>
    </div>
  );
}
