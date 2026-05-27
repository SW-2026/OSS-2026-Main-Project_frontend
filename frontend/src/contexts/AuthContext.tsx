import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export interface User {
  id: string;
  email: string;
  nickname: string;
  avatar?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, nickname: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = session.user;
        setUser({
          id: u.id,
          email: u.email ?? "",
          nickname: (u.user_metadata?.nickname as string) || "사용자",
          avatar: ((u.user_metadata?.nickname as string) || "사용자")?.charAt(0).toUpperCase(),
          createdAt: u.created_at,
        });
      }
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const u = session.user;
        setUser({
          id: u.id,
          email: u.email ?? "",
          nickname: (u.user_metadata?.nickname as string) || "사용자",
          avatar: ((u.user_metadata?.nickname as string) || "사용자")?.charAt(0).toUpperCase(),
          createdAt: u.created_at,
        });
      } else {
        setUser(null);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes("Invalid login")) {
          return { success: false, error: "이메일 또는 비밀번호가 올바르지 않습니다." };
        }
        return { success: false, error: error.message };
      }
      if (data.user) {
        setUser({
          id: data.user.id,
          email: data.user.email ?? "",
          nickname: (data.user.user_metadata?.nickname as string) || "사용자",
          avatar: ((data.user.user_metadata?.nickname as string) || "사용자")?.charAt(0).toUpperCase(),
          createdAt: data.user.created_at,
        });
      }
      return { success: true };
    } catch {
      return { success: false, error: "로그인 중 오류가 발생했습니다." };
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, nickname: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nickname },
        },
      });
      if (error) {
        if (error.message.includes("already registered") || error.message.includes("중복")) {
          return { success: false, error: "이미 가입된 이메일입니다." };
        }
        return { success: false, error: error.message };
      }
      if (data.user?.identities?.length === 0) {
        return { success: false, error: "이미 가입된 이메일입니다." };
      }
      return { success: true };
    } catch {
      return { success: false, error: "회원가입 중 오류가 발생했습니다." };
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}