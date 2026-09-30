import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import type { EmployeeData } from "../contexts/AuthContext";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEmployeeBySupabaseId = useCallback(async (supabaseUserId: string) => {
    console.debug("[DEBUG] fetchEmployeeBySupabaseId:", supabaseUserId);

    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq("supabase_user_id", supabaseUserId)
      .maybeSingle();

    if (error) {
      console.warn("[DEBUG] fetchEmployeeBySupabaseId error:", error.message);
      throw error;
    }

    return (data ?? null) as EmployeeData | null;
  }, []);

  const fetchEmployeeByEmail = useCallback(async (email: string) => {
    console.debug("[DEBUG] fetchEmployeeByEmail:", email);

    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.warn("[DEBUG] fetchEmployeeByEmail error:", error.message);
      throw error;
    }

    return (data ?? null) as EmployeeData | null;
  }, []);

  const hydrateSession = useCallback(
    async (supaSession: Session | null) => {
      console.debug("[DEBUG] hydrateSession called with:", supaSession);

      if (!supaSession?.user) {
        setSession(null);
        setEmployee(null);
        return;
      }

      setSession(supaSession);

      try {
        let emp = await fetchEmployeeBySupabaseId(supaSession.user.id);

        if (!emp && supaSession.user.email) {
          emp = await fetchEmployeeByEmail(supaSession.user.email);
        }

        setEmployee(emp ?? null);
        console.debug("[DEBUG] hydrateSession employee set to:", emp);
      } catch (err) {
        console.warn("[DEBUG] hydrateSession error:", err);
        setEmployee(null);
      }
    },
    [fetchEmployeeBySupabaseId, fetchEmployeeByEmail]
  );

  useEffect(() => {
    const restore = async () => {
      console.debug("[DEBUG] Restoring session...");
      setLoading(true);

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        await hydrateSession(data.session);
      } catch (err) {
        console.warn("[DEBUG] restore error:", err);
        setSession(null);
        setEmployee(null);
      } finally {
        setLoading(false);
      }
    };

    restore();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, supaSession) => {
      console.debug("[DEBUG] onAuthStateChange event:", _event, "new session:", supaSession);
      hydrateSession(supaSession);
    });

    return () => subscription.unsubscribe();
  }, [hydrateSession]);

  const signOut = useCallback(async () => {
    console.debug("[DEBUG] signOut called");
    setLoading(true);

    try {
      await supabase.auth.signOut();
      setSession(null);
      setEmployee(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshEmployee = useCallback(async () => {
    console.debug("[DEBUG] refreshEmployee called");

    if (!session?.user?.id) return;

    try {
      const emp = await fetchEmployeeBySupabaseId(session.user.id);
      setEmployee(emp ?? null);
      console.debug("[DEBUG] Employee data refreshed:", emp);
    } catch (err) {
      console.warn("[DEBUG] refreshEmployee error:", err);
      setEmployee(null);
    }
  }, [session, fetchEmployeeBySupabaseId]);

  return { session, employee, loading, signOut, refreshEmployee };
}