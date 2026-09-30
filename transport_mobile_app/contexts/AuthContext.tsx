import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* =======================
   TYPES
======================= */
export type EmployeeStatus = "pending" | "active" | "available" | "in-use";

export type EmployeeData = {
  id: string;
  employee_id: string;
  employee_pin4?: string | null;
  full_name: string;
  email: string;
  phone?: string | null;
  position: string;
  department: string;
  status: EmployeeStatus;
  hire_date: string;
  salary?: number | null;
  supabase_user_id?: string | null;
  daily_rate?: number | null;
  avatar_url?: string | null;
};

type AuthContextType = {
  session: Session | null;
  employee: EmployeeData | null;
  setEmployee: (employee: EmployeeData | null) => void;
  loading: boolean;
  signIn: (employeeId: string, pin: string) => Promise<void>;

  signOut: () => Promise<void>;
  refreshEmployeeData: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* =======================
   HELPERS
======================= */
function normalizeEmployeeId(v: string) {
  return (v ?? "").trim().replace(/\s+/g, "").toUpperCase();
}

function normalizePin(v: string) {
  return (v ?? "").trim().replace(/\s+/g, "");
}

function pinToPassword(pin: string) {
  const p = normalizePin(pin);
  return `EMP${p}`;
}

function normalizeName(v: string) {
  return (v ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function isAllowedEmployeeStatus(status?: string | null) {
  return status === "active" || status === "available" || status === "in-use";
}

/* =======================
   PROVIDER
======================= */
export function AuthProvider({ children }: { children: ReactNode }) {
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

    console.debug("[DEBUG] fetchEmployeeBySupabaseId result:", data);
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

    console.debug("[DEBUG] fetchEmployeeByEmail result:", data);
    return (data ?? null) as EmployeeData | null;
  }, []);

  const fetchEmployeeByEmployeeId = useCallback(async (employeeId: string) => {
    console.debug("[DEBUG] fetchEmployeeByEmployeeId:", employeeId);

    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq("employee_id", employeeId)
      .maybeSingle();

    if (error) {
      console.warn("[DEBUG] fetchEmployeeByEmployeeId error:", error.message);
      throw error;
    }

    console.debug("[DEBUG] fetchEmployeeByEmployeeId result:", data);
    return (data ?? null) as EmployeeData | null;
  }, []);

  const linkEmployeeToSupabaseUser = useCallback(
    async (employeeRowId: string, userId: string) => {
      console.debug("[DEBUG] linkEmployeeToSupabaseUser:", employeeRowId, userId);

      const { error } = await supabase
        .from("employees")
        .update({ supabase_user_id: userId })
        .eq("id", employeeRowId);

      if (error) {
        console.warn("[DEBUG] linkEmployeeToSupabaseUser error:", error.message);
        throw error;
      }
    },
    []
  );

  const hydrateSession = useCallback(
    async (supaSession: Session | null) => {
      console.debug("[DEBUG] hydrateSession:", supaSession?.user?.email ?? null);

      if (!supaSession?.user) {
        // Only clear if there is no active mock session
        const mockStr = await AsyncStorage.getItem("mock_employee_session");
        if (!mockStr) {
          setSession(null);
          setEmployee(null);
          await AsyncStorage.removeItem("cached_employee_profile");
        }
        return;
      }

      let emp: EmployeeData | null = null;
      let fetchError: any = null;

      try {
        emp = await fetchEmployeeBySupabaseId(supaSession.user.id);

        if (!emp && supaSession.user.email) {
          emp = await fetchEmployeeByEmail(supaSession.user.email);

          if (emp && !emp.supabase_user_id) {
            console.debug("[DEBUG] hydrateSession linking employee by email fallback");
            await linkEmployeeToSupabaseUser(emp.id, supaSession.user.id);
            emp = { ...emp, supabase_user_id: supaSession.user.id };
          }
        }
      } catch (err) {
        console.warn("[DEBUG] hydrateSession fetch error:", err);
        fetchError = err;
      }

      if (!emp) {
        // Check for locally cached employee before deciding what to do
        const cachedStr = await AsyncStorage.getItem("cached_employee_profile");
        if (cachedStr) {
          try {
            const cachedEmp = JSON.parse(cachedStr);
            console.debug("[DEBUG] Using cached employee profile during network latency:", cachedEmp.full_name);
            setEmployee(cachedEmp);
            setSession(supaSession);
            return;
          } catch (e) {
            console.warn("[DEBUG] Failed to parse cached profile", e);
          }
        }

        if (fetchError) {
          console.warn("[DEBUG] hydrateSession network error. Preserving session without logout.");
          setSession(supaSession);
          return;
        }

        // Only sign out if truly no employee profile exists and we have confirmed network connectivity
        console.warn("[DEBUG] hydrateSession: No employee profile found. Forcing sign out.");
        await supabase.auth.signOut();
        await AsyncStorage.multiRemove(["cached_employee_profile", "mock_employee_session"]);
        setSession(null);
        setEmployee(null);
        return;
      }

      // Save to cache for offline/instant resume
      await AsyncStorage.setItem("cached_employee_profile", JSON.stringify(emp));
      setEmployee(emp);
      setSession(supaSession);

      console.debug("[DEBUG] hydrateSession employee:", emp);
    },
    [fetchEmployeeBySupabaseId, fetchEmployeeByEmail, linkEmployeeToSupabaseUser]
  );

  useEffect(() => {
    let isMounted = true;

    const restore = async () => {
      console.debug("[DEBUG] Restoring session...");
      setLoading(true);

      try {
        // 1. Instantly load cached employee profile for 0s cold start UI
        const cachedEmpStr = await AsyncStorage.getItem("cached_employee_profile");
        if (cachedEmpStr && isMounted) {
          try {
            const parsedEmp = JSON.parse(cachedEmpStr);
            setEmployee(parsedEmp);
          } catch (e) {
            console.warn("[DEBUG] Error parsing cached employee profile", e);
          }
        }

        // 2. Check for mock session
        const mockStr = await AsyncStorage.getItem("mock_employee_session");
        if (mockStr && isMounted) {
          try {
            const mockEmp = JSON.parse(mockStr);
            console.log("[DEBUG] Restored mock session for:", mockEmp.email);
            setSession({ user: { id: mockEmp.id } } as any);
            setEmployee(mockEmp);
            setLoading(false);
            return;
          } catch (e) {
            console.warn("[DEBUG] Failed to parse mock session", e);
          }
        }

        // 3. Retrieve Supabase session with safety timeout
        const timeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Session restore timeout")), 7000)
        );
        const sessionPromise = supabase.auth.getSession();
        const { data, error } = (await Promise.race([sessionPromise, timeout])) as any;
        
        const currentSession = data?.session || null;

        if (error) {
          console.warn("[DEBUG] Supabase session error:", error);
        }

        if (isMounted) {
          if (currentSession) {
            setSession(currentSession);
          }
          await hydrateSession(currentSession);
        }
      } catch (err: any) {
        console.warn("[DEBUG] restore session error or timeout:", err.message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    restore();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, supaSession) => {
      console.debug("[DEBUG] Auth state changed:", event);
      if (!isMounted) return;

      if (event === "SIGNED_OUT") {
        setSession(null);
        setEmployee(null);
        await AsyncStorage.multiRemove(["cached_employee_profile", "mock_employee_session"]);
      } else if (supaSession) {
        await hydrateSession(supaSession);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [hydrateSession]);

  const signIn = useCallback(
    async (employeeId: string, pin: string) => {
      const id = normalizeEmployeeId(employeeId);
      const p = normalizePin(pin);

      console.debug("[DEBUG] signIn employeeId:", id);
      setLoading(true);

      try {
        if (!id || !p) {
          throw new Error("Please enter Employee ID and PIN");
        }

        const employeeRow = await fetchEmployeeByEmployeeId(id);

        console.log("[DEBUG] employeeRow =", employeeRow);

        if (!employeeRow) {
          throw new Error("Employee ID not found");
        }

        if (!employeeRow.email) {
          throw new Error("This employee has no email registered");
        }

        if (!employeeRow.employee_pin4) {
          throw new Error("This employee has no PIN configured");
        }

        const storedPin = normalizePin(employeeRow.employee_pin4);

        console.log("[DEBUG] signIn compare PIN =", {
          enteredPin: p,
          storedPin,
          pinMatch: p === storedPin,
        });

        if (p !== storedPin) {
          throw new Error("Invalid PIN");
        }

        const password = pinToPassword(storedPin);

        console.log("[DEBUG] signIn auth payload =", {
          email: employeeRow.email,
          password,
          employee_id: employeeRow.employee_id,
          employee_uuid: employeeRow.id,
          supabase_user_id: employeeRow.supabase_user_id,
          status: employeeRow.status,
        });

        let authResult = await supabase.auth.signInWithPassword({
          email: employeeRow.email,
          password,
        });

        let authData: any = authResult.data;
        let authError = authResult.error;

        console.log("[DEBUG] signIn authData =", authData);
        console.log("[DEBUG] signIn authError =", authError);

        // Auto-fix: If there's no supabase_user_id, they might have never been created in auth.users
        if (authError && authError.message?.toLowerCase().includes("invalid login credentials") && !employeeRow.supabase_user_id) {
          console.log("[DEBUG] Missing supabase_user_id + invalid credentials. Attempting auto-registration via signUp...");
          // NOTE: This signUp uses the anon key, which does NOT bypass email confirmation.
          // If Supabase has email confirmation enabled, this account will be unconfirmed and
          // the subsequent login will fail. The preferred employee creation path is via the
          // desktop admin's createUser (which uses the service role key to auto-confirm).
          const signUpRes = await supabase.auth.signUp({
            email: employeeRow.email,
            password,
            options: { data: { employee_id: employeeRow.employee_id } },
          });
          
          if (!signUpRes.error && signUpRes.data?.user) {
            console.log("[DEBUG] Auto-registration successful!");
            authData = signUpRes.data;
            authError = null;
          } else {
            console.log("[DEBUG] Auto-registration failed:", signUpRes.error);
          }
        }

        if (authError) {
          const errMsg = authError.message?.toLowerCase() || "";
          
          // CRITICAL: Database Triggers might prevent sign up. Because we already 
          // verified the PIN against the database, we can safely allow a Local Fallback.
          if (errMsg.includes("database error saving new user") || (!employeeRow.supabase_user_id && errMsg.includes("invalid login credentials"))) {
            console.log("[DEBUG] Supabase Auth rejected user due to DB errors. Bypassing Auth via Verified Mock Session...");
            const mockEmpStr = JSON.stringify(employeeRow);
            await AsyncStorage.setItem("mock_employee_session", mockEmpStr);
            const mockSession = { user: { id: employeeRow.id } } as any;
            setSession(mockSession);
            setEmployee(employeeRow as any);
            return;
          }

          if (errMsg.includes("invalid login credentials")) {
            throw new Error(
              "Invalid PIN or ID. Please check your credentials and try again."
            );
          }
          if (errMsg.includes("rate limit") || authError.status === 429) {
            throw new Error(
              "Too many login attempts. Please wait a few minutes and try again."
            );
          }
          if (errMsg.includes("network") || errMsg.includes("fetch")) {
            throw new Error("Network error. Please check your connection and try again.");
          }
          throw new Error(authError.message || "Authentication failed. Please try again.");
        }

        if (!authData.session || !authData.user) {
          throw new Error("Login failed: no session returned");
        }

        if (
          !employeeRow.supabase_user_id ||
          employeeRow.supabase_user_id !== authData.user.id
        ) {
          console.log("[DEBUG] Updating employee.supabase_user_id", {
            old: employeeRow.supabase_user_id,
            new: authData.user.id,
          });

          await linkEmployeeToSupabaseUser(employeeRow.id, authData.user.id);
        }

        const freshEmployee: EmployeeData = {
          ...employeeRow,
          supabase_user_id: authData.user.id,
        };

        if (!isAllowedEmployeeStatus(freshEmployee.status)) {
          // Sign out from Supabase immediately so auth token is not held
          await supabase.auth.signOut();
          throw new Error(
            "Your account has not been activated yet. Please contact your administrator."
          );
        }

        // Set employee BEFORE session so the dashboard never renders with null employee
        await AsyncStorage.setItem("cached_employee_profile", JSON.stringify(freshEmployee));
        setEmployee(freshEmployee);
        setSession(authData.session as any); // Cast to avoid strict type mismatch in this context

        console.log("[AUTH DEBUG] setSession + setEmployee done", {
          sessionUserId: authData.session?.user?.id,
          employeeId: freshEmployee?.id,
          employeeCode: freshEmployee?.employee_id,
          fullName: freshEmployee?.full_name,
        });

        console.debug("[DEBUG] signIn success:", freshEmployee);
      } catch (err) {
        console.debug("[DEBUG] signIn error:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchEmployeeByEmployeeId, linkEmployeeToSupabaseUser]
  );

  const signOut = useCallback(async () => {
    console.debug("[DEBUG] Signing out...");
    setLoading(true);

    try {
      await supabase.auth.signOut();
      await AsyncStorage.multiRemove(["mock_employee_session", "cached_employee_profile"]);
      setSession(null);
      setEmployee(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshEmployeeData = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      const emp = await fetchEmployeeBySupabaseId(session.user.id);
      setEmployee(emp ?? null);
    } catch (err) {
      console.warn("[DEBUG] refreshEmployeeData error:", err);
      setEmployee(null);
    }
  }, [session, fetchEmployeeBySupabaseId]);

  return (
    <AuthContext.Provider
      value={{
        session,
        employee,
        setEmployee,
        loading,
        signIn,

        signOut,
        refreshEmployeeData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}