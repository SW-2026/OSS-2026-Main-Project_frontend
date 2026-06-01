import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import axios from "axios";
import { api, tokenStorage } from "@/lib/api";

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

interface MemberDetail {
  memberId: number;
  email: string;
  nickname: string;
  createdAt?: string;
}

function memberDetailToUser(m: MemberDetail): User {
  return {
    id: String(m.memberId),
    email: m.email,
    nickname: m.nickname,
    avatar: m.nickname.charAt(0).toUpperCase(),
    createdAt: m.createdAt,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = tokenStorage.get();
    if (!token) {
      setIsLoading(false);
      return;
    }
    api.get<MemberDetail>("/api/members/me")
      .then((res) => setUser(memberDetailToUser(res.data)))
      .catch(() => {
        tokenStorage.clear();
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const tokenRes = await api.post<{ accessToken: string; tokenType: string }>(
        "/api/members/login",
        { email, password }
      );
      tokenStorage.set(tokenRes.data.accessToken);
      const meRes = await api.get<MemberDetail>("/api/members/me");
      setUser(memberDetailToUser(meRes.data));
      return { success: true };
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        return { success: false, error: "이메일 또는 비밀번호가 올바르지 않습니다." };
      }
      return { success: false, error: "로그인 중 오류가 발생했습니다." };
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, nickname: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.post("/api/members/register", { email, password, nickname });
      return { success: true };
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 409) {
          return { success: false, error: "이미 가입된 이메일입니다." };
        }
        if (status === 400) {
          return { success: false, error: "입력값이 올바르지 않습니다." };
        }
      }
      return { success: false, error: "회원가입 중 오류가 발생했습니다." };
    }
  }, []);

  const logout = useCallback(async () => {
    tokenStorage.clear();
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