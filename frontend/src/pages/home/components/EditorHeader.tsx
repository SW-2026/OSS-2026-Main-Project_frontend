import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface EditorHeaderProps {
  saveStatus: "saved" | "saving" | "unsaved";
  onSave: () => void;
  onExport: (format: "png" | "jpeg" | "pdf") => void;
  onProjectExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  scrollEditMode: boolean;
  onToggleScrollEditMode: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  showRuler: boolean;
  onToggleRuler: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  showGuide: boolean;
  onToggleGuide: () => void;
}

export default function EditorHeader({ saveStatus, onSave, onExport, onProjectExport, onUndo, onRedo, canUndo, canRedo, scrollEditMode, onToggleScrollEditMode, zoom, onZoomIn, onZoomOut, onResetZoom, showRuler, onToggleRuler, showGrid, onToggleGrid, showGuide, onToggleGuide }: EditorHeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const isAnyMenuOpen = showFileMenu || showEditMenu || showViewMenu || showProfileMenu || showExportMenu;

  // ESC 키로 모든 메뉴 닫기
  useEffect(() => {
    if (!isAnyMenuOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAllMenus();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isAnyMenuOpen]);

  const closeAllMenus = () => {
    setShowFileMenu(false);
    setShowEditMenu(false);
    setShowViewMenu(false);
    setShowProfileMenu(false);
    setShowExportMenu(false);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const saveLabel = { saved: "저장됨", saving: "저장 중...", unsaved: "저장 안 됨" }[saveStatus];
  const saveColor = { saved: "text-emerald-400", saving: "text-amber-400", unsaved: "text-red-400" }[saveStatus];

  const menuItems = {
    file: [
      { label: "새 캔버스", icon: "ri-file-add-line", shortcut: "Ctrl+N", action: () => { closeAllMenus(); /* TODO */ } },
      { label: "열기", icon: "ri-folder-open-line", shortcut: "Ctrl+O", action: () => { closeAllMenus(); navigate("/projects"); } },
      { label: "저장", icon: "ri-save-line", shortcut: "Ctrl+S", action: () => { closeAllMenus(); onSave(); } },
      { label: "다른 이름으로 저장", icon: "ri-save-2-line", shortcut: "Ctrl+Shift+S", action: () => { closeAllMenus(); onSave(); } },
      null,
      { label: "PNG로 내보내기", icon: "ri-file-image-line", shortcut: "", action: () => { closeAllMenus(); onExport("png"); } },
      { label: "JPEG로 내보내기", icon: "ri-image-line", shortcut: "", action: () => { closeAllMenus(); onExport("jpeg"); } },
      { label: "PDF로 내보내기", icon: "ri-file-pdf-line", shortcut: "", action: () => { closeAllMenus(); onExport("pdf"); } },
    ],
    edit: [
      { label: "실행 취소", icon: "ri-arrow-go-back-line", shortcut: "Ctrl+Z", action: () => { closeAllMenus(); onUndo(); } },
      { label: "다시 실행", icon: "ri-arrow-go-forward-line", shortcut: "Ctrl+Y", action: () => { closeAllMenus(); onRedo(); } },
      null,
      { label: "전체 선택", icon: "ri-checkbox-multiple-line", shortcut: "Ctrl+A", action: () => { closeAllMenus(); } },
      { label: "복사", icon: "ri-file-copy-line", shortcut: "Ctrl+C", action: () => { closeAllMenus(); } },
      { label: "붙여넣기", icon: "ri-clipboard-line", shortcut: "Ctrl+V", action: () => { closeAllMenus(); } },
      null,
      { label: "캔버스 크기 변경", icon: "ri-crop-line", shortcut: "", action: () => { closeAllMenus(); } },
    ],
    view: [
      { label: "확대", icon: "ri-zoom-in-line", shortcut: `Ctrl++ (${zoom}%)`, action: () => { closeAllMenus(); onZoomIn(); } },
      { label: "축소", icon: "ri-zoom-out-line", shortcut: "Ctrl+-", action: () => { closeAllMenus(); onZoomOut(); } },
      { label: "100% 보기", icon: "ri-fullscreen-line", shortcut: "Ctrl+0", action: () => { closeAllMenus(); onResetZoom(); } },
      null,
      { label: "눈금자 표시", icon: "ri-ruler-line", shortcut: "Ctrl+R", action: () => { closeAllMenus(); onToggleRuler(); }, checked: showRuler },
      { label: "격자 표시", icon: "ri-grid-line", shortcut: "Ctrl+'", action: () => { closeAllMenus(); onToggleGrid(); }, checked: showGrid },
      { label: "가이드라인", icon: "ri-guide-line", shortcut: "Ctrl+G", action: () => { closeAllMenus(); onToggleGuide(); }, checked: showGuide },
    ],
  };

  type MenuItem = {
    label: string;
    icon: string;
    shortcut: string;
    action: () => void;
    checked?: boolean;
  };
  type MenuKey = keyof typeof menuItems;

  const renderMenu = (key: MenuKey, isOpen: boolean) => {
    if (!isOpen) return null;
    return (
      <div className="absolute top-full left-0 mt-0.5 w-52 bg-[#1e1e1e] border border-[#333] rounded-xl py-1 shadow-2xl z-[10000]">
        {menuItems[key].map((item, i) =>
          item === null ? (
            <div key={i} className="h-px bg-[#2a2a2a] my-1 mx-2" />
          ) : (
            <button
              key={item.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => item.action?.()}
              className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-[#ccc] hover:bg-[#2a2a2a] transition-colors cursor-pointer whitespace-nowrap"
            >
              <div className="flex items-center gap-2">
                <i className={`${item.icon} ${item.checked ? "text-orange-400" : "text-[#666]"}`} />
                <span>{item.label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {item.checked && <i className="ri-check-line text-orange-400 text-[10px]" />}
                {item.shortcut && <span className="text-[10px] text-[#555]">{item.shortcut}</span>}
              </div>
            </button>
          )
        )}
      </div>
    );
  };

  return (
    <header className="flex items-center h-11 bg-[#111111] border-b border-[#2a2a2a] px-3 shrink-0 gap-2 relative">
      {/* 오버레이 — 메뉴 열렸을 때 클릭하면 모든 메뉴 닫힘 */}
      {isAnyMenuOpen && (
        <div
          className="fixed inset-0 z-[9998]"
          onClick={closeAllMenus}
          onContextMenu={(e) => { e.preventDefault(); closeAllMenus(); }}
        />
      )}

      {/* 로고 */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center">
          <i className="ri-quill-pen-line text-white text-sm" />
        </div>
        <span className="text-white font-bold text-sm tracking-wide whitespace-nowrap">
          WEBTOON<span className="text-orange-500">.AI</span>
        </span>
      </div>

      <div className="w-px h-5 bg-[#2a2a2a] mx-1" />

      {/* 메뉴바 */}
      <div className="flex items-center gap-0.5">
        {/* 파일 메뉴 */}
        <div className="relative">
          <button
            onClick={() => { setShowFileMenu((v) => !v); setShowEditMenu(false); setShowViewMenu(false); }}
            className={`px-2.5 h-7 rounded text-xs cursor-pointer transition-colors whitespace-nowrap ${
              showFileMenu ? "bg-[#2a2a2a] text-[#ccc]" : "text-[#888] hover:bg-[#1e1e1e] hover:text-[#ccc]"
            }`}
          >
            파일
          </button>
          {renderMenu("file", showFileMenu)}
        </div>

        {/* 편집 메뉴 */}
        <div className="relative">
          <button
            onClick={() => { setShowEditMenu((v) => !v); setShowFileMenu(false); setShowViewMenu(false); }}
            className={`px-2.5 h-7 rounded text-xs cursor-pointer transition-colors whitespace-nowrap ${
              showEditMenu ? "bg-[#2a2a2a] text-[#ccc]" : "text-[#888] hover:bg-[#1e1e1e] hover:text-[#ccc]"
            }`}
          >
            편집
          </button>
          {renderMenu("edit", showEditMenu)}
        </div>

        {/* 보기 메뉴 */}
        <div className="relative">
          <button
            onClick={() => { setShowViewMenu((v) => !v); setShowFileMenu(false); setShowEditMenu(false); }}
            className={`px-2.5 h-7 rounded text-xs cursor-pointer transition-colors whitespace-nowrap ${
              showViewMenu ? "bg-[#2a2a2a] text-[#ccc]" : "text-[#888] hover:bg-[#1e1e1e] hover:text-[#ccc]"
            }`}
          >
            보기
          </button>
          {renderMenu("view", showViewMenu)}
        </div>
      </div>

      <div className="w-px h-5 bg-[#2a2a2a] mx-1" />

      {/* 프로젝트명 */}
      <div className="flex items-center gap-1 group cursor-pointer">
        <span className="text-[#bbb] text-xs font-medium whitespace-nowrap">새 에피소드 - 첫 만남</span>
        <i className="ri-pencil-line text-[#555] text-xs opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* 저장 상태 */}
      <div className={`flex items-center gap-1 ml-2 text-[10px] ${saveColor} whitespace-nowrap`}>
        {saveStatus === "saving" && <div className="w-2.5 h-2.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />}
        {saveStatus === "saved" && <i className="ri-checkbox-circle-line" />}
        {saveStatus === "unsaved" && <i className="ri-error-warning-line" />}
        <span>{saveLabel}</span>
      </div>

      {/* 스페이서 */}
      <div className="flex-1" />

      {/* 되돌리기/다시실행 */}
      <div className="flex items-center gap-0.5">
        <button
          title="실행 취소 (Ctrl+Z)"
          onClick={onUndo}
          disabled={!canUndo}
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors cursor-pointer ${
            canUndo ? "text-[#888] hover:bg-[#2a2a2a] hover:text-[#ccc]" : "text-[#444] cursor-not-allowed"
          }`}
        >
          <i className="ri-arrow-go-back-line text-sm" />
        </button>
        <button
          title="다시 실행 (Ctrl+Y)"
          onClick={onRedo}
          disabled={!canRedo}
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors cursor-pointer ${
            canRedo ? "text-[#888] hover:bg-[#2a2a2a] hover:text-[#ccc]" : "text-[#444] cursor-not-allowed"
          }`}
        >
          <i className="ri-arrow-go-forward-line text-sm" />
        </button>
      </div>

      <div className="w-px h-5 bg-[#2a2a2a] mx-1" />

      {/* 세로 보기 모드 토글 */}
      <button
        onClick={onToggleScrollEditMode}
        className={`flex items-center gap-1.5 px-2.5 h-7 rounded text-xs transition-colors cursor-pointer whitespace-nowrap ${
          scrollEditMode
            ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
            : "text-[#888] hover:bg-[#2a2a2a] hover:text-[#ccc]"
        }`}
        title="세로 스크롤 편집 모드"
      >
        <i className={`text-sm ${scrollEditMode ? "ri-layout-column-fill" : "ri-layout-column-line"}`} />
        세로 보기
      </button>

      {/* 저장 */}
      <button
        onClick={onSave}
        className="flex items-center gap-1.5 px-3 h-7 rounded bg-[#2a2a2a] text-xs text-[#ccc] hover:bg-[#333] transition-colors cursor-pointer whitespace-nowrap"
      >
        <i className="ri-save-line" />
        저장
      </button>

      {/* 내보내기 */}
      <div className="relative">
        <button
          onClick={() => setShowExportMenu((v) => !v)}
          className="flex items-center gap-1.5 px-3 h-7 rounded bg-orange-500 text-xs text-white hover:bg-orange-600 transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-export-line" />
          내보내기
          <i className="ri-arrow-down-s-line" />
        </button>
        {showExportMenu && (
          <div className="absolute right-0 top-9 w-48 bg-[#1e1e1e] border border-[#333] rounded-xl py-1 shadow-2xl z-[10000]">
            {[
              { icon: "ri-file-image-line", label: "PNG 이미지", format: "png" as const },
              { icon: "ri-image-line", label: "JPEG 이미지", format: "jpeg" as const },
              { icon: "ri-file-pdf-line", label: "PDF 파일", format: "pdf" as const },
            ].map((item) => (
              <button
                key={item.label}
                onMouseDown={(e) => e.preventDefault()}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#ccc] hover:bg-[#2a2a2a] transition-colors cursor-pointer whitespace-nowrap"
                onClick={() => { onExport(item.format); closeAllMenus(); }}
              >
                <i className={item.icon} />
                {item.label}
              </button>
            ))}
            <div className="h-px bg-[#2a2a2a] my-1 mx-2" />
            <button
              onMouseDown={(e) => e.preventDefault()}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-emerald-400 hover:bg-[#2a2a2a] transition-colors cursor-pointer whitespace-nowrap"
              onClick={() => { onProjectExport(); closeAllMenus(); }}
            >
              <i className="ri-folder-zip-line" />
              프로젝트 ZIP으로 내보내기
            </button>
          </div>
        )}
      </div>

      {/* 프로필 */}
      <div className="relative ml-1 shrink-0">
        <button
          onClick={() => setShowProfileMenu((v) => !v)}
          className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white text-xs font-bold cursor-pointer"
          title={user?.nickname ?? "프로필"}
        >
          {user?.avatar ?? "?"}
        </button>
        {showProfileMenu && (
          <div className="absolute right-0 top-9 w-52 bg-[#1e1e1e] border border-[#333] rounded-xl py-1 shadow-2xl z-[10000]">
            <div className="px-3 py-2.5 border-b border-[#2a2a2a]">
              <p className="text-white text-xs font-semibold truncate">{user?.nickname ?? "사용자"}</p>
              <p className="text-[#666] text-[10px] truncate mt-0.5">{user?.email}</p>
            </div>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { closeAllMenus(); navigate("/settings"); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#ccc] hover:bg-[#2a2a2a] transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-user-settings-line text-[#666]" />
              계정 설정
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { closeAllMenus(); navigate("/projects"); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#ccc] hover:bg-[#2a2a2a] transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-folder-line text-[#666]" />
              내 프로젝트
            </button>
            <div className="h-px bg-[#2a2a2a] my-1 mx-2" />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-[#2a2a2a] transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-logout-box-r-line" />
              로그아웃
            </button>
          </div>
        )}
      </div>
    </header>
  );
}