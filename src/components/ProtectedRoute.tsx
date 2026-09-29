import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { EmptyState, LoadingState } from "./ui";
import type { User } from "../types/domain";

export function ProtectedRoute({
  roles,
  children,
}: {
  roles?: User["role"][];
  children: ReactNode;
}) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <LoadingState />;

  if (!user)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (roles && !roles.includes(user.role))
    return (
      <div className="container page">
        <EmptyState
          title="This workspace is for a different role."
          description={`You are signed in as ${user.role}. Sign out and use a ${
            roles.join(" or ")
          } account to open this area.`}
          href="/"
          label="Back to the studio"
        />
      </div>
    );

  return <>{children}</>;
}
