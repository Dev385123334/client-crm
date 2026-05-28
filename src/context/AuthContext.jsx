import React, { createContext, useState, useEffect, useCallback } from 'react';
import { getSession, getUserRole, onAuthStateChange, signOut as authSignOut } from '../supabase/auth';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = useCallback(async (userId) => {
    const role = await getUserRole(userId);
    if (role) {
      setUserRole(role);
      localStorage.setItem('crm_user_role', role);
    } else {
      setUserRole(null);
      localStorage.removeItem('crm_user_role');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const s = await getSession();
      if (cancelled) return;
      if (s) {
        setSession(s);
        setUser(s.user);
        await fetchRole(s.user.id);
      }
      setLoading(false);
    }

    init();

    const unsubscribe = onAuthStateChange(async (event, s) => {
      if (cancelled) return;
      if (s) {
        setSession(s);
        setUser(s.user);
        await fetchRole(s.user.id);
      } else {
        setSession(null);
        setUser(null);
        setUserRole(null);
        localStorage.removeItem('crm_user_role');
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [fetchRole]);

  const logout = useCallback(async () => {
    await authSignOut();
    setSession(null);
    setUser(null);
    setUserRole(null);
    localStorage.removeItem('crm_user_role');
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, userRole, loading, logout, fetchRole }}>
      {children}
    </AuthContext.Provider>
  );
}
