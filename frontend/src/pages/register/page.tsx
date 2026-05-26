import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function RegisterPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password || !nickname) {
      setError("모든 필수 항목을 입력해주세요.");
      return;
    }

    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setIsLoading(true);
    const result = await signup(email, password, nickname);
    setIsLoading(false);

    if (result.success) {
      navigate("/login");
    } else {
      setError(result.error || "오류가 발생했습니다.");
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center bg-[#0d0d0d] relative overflow-hidden"
      style={{ fontFamily: "'Inter', 'Noto Sans KR', sans-serif" }}
    >
      {/* 배경 장식 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-120px] left-[-120px] w-[500px] h-[500px] rounded-full bg-orange-500/10 blur-[100px]" />
        <div className="absolute bottom-[-80px] right-[-80px] w-[400px] h-[400px] rounded-full bg-pink-500/10 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-orange-400/5 blur-[120px]" />
      </div>

      {/* 배경 그리드 패턴 */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* 로고 */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center mb-4">
            <i className="ri-quill-pen-line text-white text-2xl" />
          </div>
          <h1 className="text-white text-2xl font-bold tracking-wide">
            WEBTOON<span className="text-orange-500">.AI</span>
          </h1>
          <p className="text-[#666] text-sm mt-1">AI 웹툰 제작 플랫폼</p>
        </div>

        {/* 카드 */}
        <div className="bg-[#111] border border-[#222] rounded-2xl p-8">
          <h2 className="text-white text-lg font-semibold mb-6 text-center">회원가입</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* 닉네임 */}
            <div>
              <label className="block text-xs text-[#888] mb-1.5">닉네임</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                  <i className="ri-user-line text-[#555] text-sm" />
                </div>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="사용할 닉네임"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            {/* 이메일 */}
            <div>
              <label className="block text-xs text-[#888] mb-1.5">이메일</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                  <i className="ri-mail-line text-[#555] text-sm" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일 주소"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-xs text-[#888] mb-1.5">비밀번호</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                  <i className="ri-lock-line text-[#555] text-sm" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6자 이상 입력"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl pl-9 pr-10 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-orange-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-[#555] hover:text-[#888] cursor-pointer"
                >
                  <i className={showPassword ? "ri-eye-off-line text-sm" : "ri-eye-line text-sm"} />
                </button>
              </div>
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label className="block text-xs text-[#888] mb-1.5">비밀번호 확인</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                  <i className="ri-lock-2-line text-[#555] text-sm" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="비밀번호 재입력"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2.5">
                <i className="ri-error-warning-line text-red-400 text-sm" />
                <span className="text-red-400 text-xs">{error}</span>
              </div>
            )}

            {/* 제출 버튼 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 mt-1"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>가입 중...</span>
                </>
              ) : (
                <span>회원가입</span>
              )}
            </button>
          </form>

          {/* 하단 안내 */}
          <p className="text-center text-xs text-[#555] mt-5">
            이미 계정이 있으신가요?{" "}
            <Link to="/login" className="text-orange-400 hover:text-orange-300 cursor-pointer">
              로그인
            </Link>
          </p>
        </div>

        <p className="text-center text-[#444] text-xs mt-6">
          &copy; 2026 WEBTOON.AI · 모든 권리 보유
        </p>
      </div>
    </div>
  );
}