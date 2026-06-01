import { useState, useEffect } from "react";
import {
  listBackgrounds,
  uploadBackground,
  deleteBackground,
  type BackgroundAssetSummary,
} from "@/lib/backgroundApi";

// 이미지 URL — backend assetUrl이 상대 경로(/images/background/...)면 BASE_URL 합성
const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:8080";

function resolveImageUrl(path: string): string {
  return path.startsWith("http") ? path : `${BASE_URL}${path}`;
}

export default function BackgroundLibraryPanel() {
  const [backgrounds, setBackgrounds] = useState<BackgroundAssetSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // 등록 폼 state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newImage, setNewImage] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    listBackgrounds()
      .then((list) => setBackgrounds(list))
      .catch((e) =>
        setListError(e instanceof Error ? e.message : "배경 목록 조회 실패")
      )
      .finally(() => setIsLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newName.trim() || !newImage || isCreating) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      await uploadBackground({ assetName: newName.trim() }, newImage);
      // 목록 재조회로 새 항목 반영
      const list = await listBackgrounds();
      setBackgrounds(list);
      // 폼 리셋
      setNewName("");
      setNewImage(null);
      setShowCreateForm(false);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "배경 등록 실패");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (assetId: number) => {
    try {
      await deleteBackground(assetId);
      setBackgrounds((prev) => prev.filter((b) => b.assetId !== assetId));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[BackgroundLibraryPanel] 삭제 실패:", e);
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* 헤더 */}
      <div className="px-3 py-2 border-b border-[#2a2a2a] shrink-0">
        <p className="text-[10px] text-[#888]">배경 라이브러리</p>
        <p className="text-[9px] text-[#555] mt-0.5">
          시나리오 #배경 멘션과 연동 (Member 단위)
        </p>
      </div>

      {/* 등록 컨트롤 */}
      <div className="p-3 space-y-2 shrink-0 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between">
          <p className="text-[9px] text-[#555] uppercase tracking-wider font-medium">
            내 배경 ({backgrounds.length})
          </p>
          {!showCreateForm && (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="text-[10px] text-orange-400 hover:text-orange-300 cursor-pointer"
            >
              + 새 배경
            </button>
          )}
        </div>

        {showCreateForm && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-2 space-y-1.5">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="이름 (예: 교실) *"
              className="w-full bg-[#1e1e1e] border border-[#333] rounded px-2 py-1.5 text-xs text-white placeholder-[#555] focus:outline-none focus:border-orange-500"
            />
            <div className="flex items-center gap-2">
              <label className="flex-1 flex items-center gap-1.5 bg-[#1e1e1e] border border-dashed border-[#333] rounded px-2 py-1.5 text-xs text-[#666] hover:border-orange-500/50 cursor-pointer transition-colors">
                <i className="ri-image-add-line text-sm" />
                {newImage ? newImage.name : "이미지 업로드 *"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewImage(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newName.trim() || !newImage || isCreating}
                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs rounded cursor-pointer whitespace-nowrap"
              >
                {isCreating ? "등록 중..." : "등록"}
              </button>
            </div>
            {createError && (
              <span className="text-red-400 text-[10px]">{createError}</span>
            )}
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false);
                setNewName("");
                setNewImage(null);
                setCreateError(null);
              }}
              className="text-[10px] text-[#555] hover:text-[#888] cursor-pointer"
            >
              취소
            </button>
          </div>
        )}
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <p className="text-[10px] text-[#555] text-center pt-4">로딩 중...</p>
        ) : listError ? (
          <p className="text-[10px] text-red-400 text-center pt-4">{listError}</p>
        ) : backgrounds.length === 0 ? (
          <p className="text-[10px] text-[#555] text-center pt-4">
            등록된 배경이 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {backgrounds.map((bg) => (
              <div
                key={bg.assetId}
                className="group relative bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden"
              >
                <div className="w-full aspect-[4/3] bg-[#111] overflow-hidden">
                  <img
                    src={resolveImageUrl(bg.assetUrl)}
                    alt={bg.assetName}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div className="p-1.5 flex items-center justify-between">
                  <p className="text-[10px] text-[#ccc] truncate flex-1">{bg.assetName}</p>
                  <button
                    type="button"
                    onClick={() => handleDelete(bg.assetId)}
                    className="w-5 h-5 flex items-center justify-center text-[#555] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0"
                    title="삭제"
                  >
                    <i className="ri-delete-bin-line text-xs" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}