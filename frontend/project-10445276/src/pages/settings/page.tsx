import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-[#ccc]" style={{ fontFamily: "'Inter', 'Noto Sans KR', sans-serif" }}>
      {/* 헤더 */}
      <header className="h-14 bg-[#111111] border-b border-[#2a2a2a] flex items-center px-4 shrink-0">
        <button
          onClick={() => navigate("/editor")}
          className="flex items-center gap-2 text-[#888] hover:text-white transition-colors cursor-pointer"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-arrow-left-line text-sm" />
          </div>
          <span className="text-xs font-medium whitespace-nowrap">에디터로 돌아가기</span>
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center">
            <i className="ri-quill-pen-line text-white text-sm" />
          </div>
          <span className="text-white font-bold text-sm tracking-wide whitespace-nowrap">
            WEBTOON<span className="text-orange-500">.AI</span>
          </span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-white text-xl font-bold mb-8">계정 설정</h1>

        {/* 프로필 섹션 */}
        <section className="bg-[#111] border border-[#222] rounded-2xl p-6 mb-4">
          <h2 className="text-white text-sm font-semibold mb-5 flex items-center gap-2">
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-user-line text-orange-500 text-sm" />
            </div>
            프로필 정보
          </h2>

          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white text-xl font-bold">
                {user.avatar}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#2a2a2a] border border-[#333] rounded-full flex items-center justify-center cursor-pointer hover:bg-[#333] transition-colors"
              >
                <div className="w-3 h-3 flex items-center justify-center">
                  <i className="ri-camera-line text-[#888] text-xs" />
                </div>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" />
            </div>
            <div>
              <p className="text-white text-sm font-semibold">{user.nickname}</p>
              <p className="text-[#666] text-xs mt-0.5">{user.email}</p>
              <p className="text-[#444] text-[10px] mt-1">가입일: {new Date(user.createdAt).toLocaleDateString("ko-KR")}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#888] mb-1.5">닉네임</label>
              <input
                type="text"
                defaultValue={user.nickname}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-[#888] mb-1.5">이메일</label>
              <input
                type="email"
                defaultValue={user.email}
                readOnly
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-[#666] cursor-not-allowed"
              />
            </div>
          </div>
        </section>

        {/* 비밀번호 변경 */}
        <section className="bg-[#111] border border-[#222] rounded-2xl p-6 mb-4">
          <h2 className="text-white text-sm font-semibold mb-5 flex items-center gap-2">
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-lock-line text-orange-500 text-sm" />
            </div>
            비밀번호 변경
          </h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs text-[#888] mb-1.5">현재 비밀번호</label>
              <input
                type="password"
                placeholder="현재 비밀번호 입력"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[#888] mb-1.5">새 비밀번호</label>
                <input
                  type="password"
                  placeholder="6자 이상"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-[#888] mb-1.5">새 비밀번호 확인</label>
                <input
                  type="password"
                  placeholder="비밀번호 재입력"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 계정 관리 */}
        <section className="bg-[#111] border border-[#222] rounded-2xl p-6 mb-6">
          <h2 className="text-white text-sm font-semibold mb-5 flex items-center gap-2">
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-shield-line text-orange-500 text-sm" />
            </div>
            계정 관리
          </h2>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-xs text-[#ccc] hover:bg-[#222] transition-colors cursor-pointer whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-logout-box-r-line text-[#888] text-sm" />
              </div>
              로그아웃
            </button>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-delete-bin-line text-red-400 text-sm" />
              </div>
              계정 삭제
            </button>
          </div>
        </section>

        {/* 저장 버튼 */}
        <div className="flex justify-end gap-3">
          <button
            onClick={() => navigate("/editor")}
            className="px-5 py-2.5 rounded-xl bg-[#2a2a2a] text-xs text-[#ccc] hover:bg-[#333] transition-colors cursor-pointer whitespace-nowrap"
          >
            취소
          </button>
          <button
            onClick={() => { /* 저장 로직 - 추후 구현 */ }}
            className="px-5 py-2.5 rounded-xl bg-orange-500 text-xs text-white hover:bg-orange-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            변경사항 저장
          </button>
        </div>
      </div>

      {/* 계정 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-[#111] border border-[#333] rounded-2xl p-6 w-full max-w-sm">
            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-6 h-6 flex items-center justify-center">
                <i className="ri-alert-line text-red-400 text-xl" />
              </div>
            </div>
            <h3 className="text-white text-sm font-semibold text-center mb-2">계정을 삭제하시겠어요?</h3>
            <p className="text-[#888] text-xs text-center mb-6">
              모든 프로젝트와 데이터가 영구적으로 삭제되며 복구할 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#2a2a2a] text-xs text-[#ccc] hover:bg-[#333] transition-colors cursor-pointer whitespace-nowrap"
              >
                취소
              </button>
              <button
                onClick={() => { logout(); navigate("/login"); }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-xs text-white hover:bg-red-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}