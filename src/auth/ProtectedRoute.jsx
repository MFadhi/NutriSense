import { Navigate, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function ProtectedRoute({ children }) {
  const { auth } = useApp();
  const location = useLocation();

  if (!auth?.isAuthenticated) {
    return <Navigate to="/" state={{ from: location, needAuth: true }} replace />;
  }

  return children;
}
