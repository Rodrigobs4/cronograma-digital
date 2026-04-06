import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";

export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    const client = getSupabaseClient();

    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          setSession(null);
          setLoading(false);
          return;
        }

        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        setSession(null);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signInWithPassword(email: string, password: string) {
    const client = getSupabaseClient();

    return client.auth.signInWithPassword({
      email,
      password,
    });
  }

  async function signUpWithPassword(email: string, password: string) {
    const client = getSupabaseClient();

    return client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
  }

  async function resetPassword(email: string) {
    const client = getSupabaseClient();

    return client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
  }

  async function signOut() {
    const client = getSupabaseClient();
    return client.auth.signOut();
  }

  return {
    session,
    loading,
    signInWithPassword,
    signUpWithPassword,
    resetPassword,
    signOut,
  };
}
