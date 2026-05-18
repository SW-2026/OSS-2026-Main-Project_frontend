import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

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

function sessionToUser(session: Session): User {
  const meta = session.user.user_metadata ?? {};
  const email = session.user.email ?? "";
  const nickname = meta.nickname ?? meta.name ?? email.split("@")[0];
  return {
    id: session.user.id,
    email,
    nickname,
    avatar: nickname.charAt(0).toUpperCase(),
    createdAt: session.user.created_at,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 현재 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session ? sessionToUser(session) : null);
      setIsLoading(false);
    });

    // 인증 상태 변경 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session ? sessionToUser(session) : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          return { success: false, error: "이메일 또는 비밀번호가 올바르지 않습니다." };
        }
        if (error.message.includes("Email not confirmed")) {
          return { success: false, error: "이메일 인증이 필요합니다. 받은 편지함을 확인해주세요." };
        }
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch {
      return { success: false, error: "로그인 중 오류가 발생했습니다." };
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, nickname: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nickname },
        },
      });
      if (error) {
        if (error.message.includes("already registered") || error.message.includes("User already registered")) {
          return { success: false, error: "이미 가입된 이메일입니다." };
        }
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch {
      return { success: false, error: "회원가입 중 오류가 발생했습니다." };
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
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