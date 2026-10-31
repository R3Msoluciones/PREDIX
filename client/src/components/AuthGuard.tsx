import { useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = "/";
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="text-cyan-400 text-sm">Verificando sesión...</div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
