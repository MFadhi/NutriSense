import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getAccessToken, getRefreshToken, setAccessToken, setRefreshToken, clearTokens, hasSession } from "./tokenStore";
import { login as apiLogin, register as apiRegister } from "../api/auth";
import { getMe } from "../api/me";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const initAuth = useCallback(async () => {
    const rt = getRefreshToken();
    if (!rt) {
      setLoading(false);
      return;
    }
    try {
      const me = await getMe();
      setUser({ id: me.id, email: me.email });
      setProfile(me.profile);
      setIsAuthenticated(true);
    } catch {
      clearTokens();
      setUser(null);
      setProfile(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    const handleSignout = () => {
      clearTokens();
      setUser(null);
      setProfile(null);
      setIsAuthenticated(false);
    };
    window.addEventListener("nutrilens:signout", handleSignout);
    return () => window.removeEventListener("nutrilens:signout", handleSignout);
  }, []);

  const login = async (email, password) => {
    const res = await apiLogin(email, password);
    setAccessToken(res.access_token);
    setRefreshToken(res.refresh_token);
    setUser(res.user);
    setIsAuthenticated(true);
    try {
      const me = await getMe();
      setProfile(me.profile);
    } catch {
      // ignore
    }
    return res;
  };

  const register = async (email, password, diet_type) => {
    const res = await apiRegister(email, password, diet_type);
    const loginRes = await apiLogin(email, password);
    setAccessToken(loginRes.access_token);
    setRefreshToken(loginRes.refresh_token);
    setUser(loginRes.user);
    setIsAuthenticated(true);
    try {
      const me = await getMe();
      setProfile(me.profile);
    } catch {
      // ignore
    }
    return loginRes;
  };

  const logout = () => {
    clearTokens();
    setUser(null);
    setProfile(null);
    setIsAuthenticated(false);
    window.dispatchEvent(new CustomEvent("nutrilens:signout"));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAuthenticated,
        loading,
        login,
        register,
        logout,
        reloadProfile: initAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export default AuthContext;
