import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import type { AppRole } from '@/types/darwin';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: AppRole[];
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { user, roles, loading, profileStatus } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Wait for profile data to load (Safari race condition fix)
  if (user && profileStatus === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (profileStatus === 'pending') return <Navigate to="/waiting-approval" replace />;
  if (profileStatus === 'rejected') return <Navigate to="/login?error=rejected" replace />;

  if (roles.length === 0 && profileStatus !== 'approved') {
    return <Navigate to="/waiting-approval" replace />;
  }

  if (requiredRoles && !requiredRoles.some((r) => roles.includes(r))) {
    // Allow super_admin to access admin pages
    if (roles.includes('super_admin') && requiredRoles.includes('jv_admin')) {
      return <>{children}</>;
    }
    return <Navigate to="/app/dashboard" replace />;
  }

  return <>{children}</>;
}
