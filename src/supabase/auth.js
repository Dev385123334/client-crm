import { supabase } from './client';

export async function signIn(email, password) {
  if (!supabase) {
    return { error: { message: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.' } };
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error };
  return { data };
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

export async function getUserRole(userId) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data.role;
}

export async function signUp(email, password) {
  if (!supabase) {
    return { error: { message: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.' } };
  }
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error };
  return { data };
}

export async function createUserRole(userId, email, role) {
  if (!supabase) return { error: { message: 'Supabase not configured' } };
  const { error } = await supabase.rpc('create_user_role', {
    p_user_id: userId,
    p_email: email,
    p_role: role,
  });
  if (error) return { error };
  return { success: true };
}

export function onAuthStateChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return data?.subscription?.unsubscribe || (() => {});
}
