import { useState, useEffect } from "react";
import { usePanelGeneration } from "@/hooks/usePanelGeneration";
import {
  listCharacters,
  getCharacter,
  createCharacter,
  type CharacterModelSummary,
  type CharacterModelDetail,
} from "@/lib/characterApi";

// ⚠️ 검증용 임시 hardcoded
// TODO(1-C): Episode/Project CRUD를 backend로 통합한 후 — 하단 timeline의 episodeId(Supabase string UUID)를
//            backend Long으로 전환 → 두 상수 모두 제거, 활성 프로젝트/에피소드에서 가져오기.
// 사용 전 사용자 측 준비:
//   curl POST /api/projects {title,genre} → projectId
//   curl POST /api/projects/{id}/episodes {epNumber,epTitle} → episodeId
//   두 ID를 아래 상수로 교체.
const VERIFY_PROJECT_ID = 1;
const VERIFY_EPISODE_ID = 1;

const MIN_SCENARIO_LENGTH = 50;
const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:8080";

function resolveImageUrl(path: string): string {
  return path.startsWith("http") ? path : `${BASE_URL}${path}`;
}

export default function ScenarioGeneratePanel() {
  const [scenarioText, setScenarioText] = useState("");
  const { status, progress, panels, error, start } = usePanelGeneration();

  // 캐릭터 목록 + 선택 + detail 캐시 (Q3: 등록 시 캐싱 B + 기존 선택 시 lazy GET A)
  const [characters, setCharacters] = useState<CharacterModelSummary[]>([]);
  const [characterDetailCache, setCharacterDetailCache] = useState<
    Record<number, CharacterModelDetail>
  >({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [charactersError, setCharactersError] = useState<string | null>(null);
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(true);

  // 등록 폼 state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTrigger, setNewTrigger] = useState("");
  const [newLoraPath, setNewLoraPath] = useState("");
  const [newImage, setNewImage] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    listCharacters(VERIFY_PROJECT_ID)
      .then((list) => setCharacters(list))
      .catch((e) =>
        setCharactersError(
          e instanceof Error ? e.message : "캐릭터 목록 조회 실패"
        )
      )
      .finally(() => setIsLoadingCharacters(false));
  }, []);

  const toggleCharacter = async (modelId: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(modelId)) {
      newSelected.delete(modelId);
    } else {
      newSelected.add(modelId);
      // lazy detail GET — Summary에는 triggerWord/loraModelPath 없으므로
      if (!characterDetailCache[modelId]) {
        try {
          const detail = await getCharacter(modelId);
          setCharacterDetailCache((prev) => ({ ...prev, [modelId]: detail }));
        } catch {
          // detail 못 가져와도 modelId만으로 backend enrichment가 loraModelPath는 보강
        }
      }
    }
    setSelectedIds(newSelected);
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newImage || isCreating) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const created = await createCharacter(
        VERIFY_PROJECT_ID,
        {
          modelName: newName.trim(),
          triggerWord: newTrigger.trim() || undefined,
          loraModelPath: newLoraPath.trim() || undefined,
        },
        [newImage]
      );
      setCharacters((prev) => [
        ...prev,
        {
          modelId: created.modelId,
          modelName: created.modelName,
          status: created.status,
          createdAt: created.createdAt,
        },
      ]);
      setCharacterDetailCache((prev) => ({
        ...prev,
        [created.modelId]: created,
      }));
      setSelectedIds((prev) => new Set(prev).add(created.modelId));
      setNewName("");
      setNewTrigger("");
      setNewLoraPath("");
      setNewImage(null);
      setShowCreateForm(false);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "캐릭터 등록 실패");
    } finally {
      setIsCreating(false);
    }
  };

  const isRunning = status === "pending" || status === "processing";
  const trimmedLen = scenarioText.trim().length;
  const tooShort = trimmedLen < MIN_SCENARIO_LENGTH;

  const handleGenerate = () => {
    if (tooShort || isRunning) return;
    const mentions = [...selectedIds].map((id) => {
      const detail = characterDetailCache[id];
      const summary = characters.find((c) => c.modelId === id);
      return {
        name: detail?.modelName ?? summary?.modelName ?? "",
        modelId: id,
        triggerWord: detail?.triggerWord ?? "",
        loraModelPath: detail?.loraModelPath ?? null,
      };
    });
    start(VERIFY_EPISODE_ID, {
      scenarioText: scenarioText.trim(),
      characters: mentions,
    });
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* 헤더 */}
      <div className="px-3 py-2 border-b border-[#2a2a2a] shrink-0">
        <p className="text-[10px] text-[#888]">
          backend 시나리오→컷 파이프라인 검증용
        </p>
        <p className="text-[9px] text-[#555] mt-0.5">
          projectId: {VERIFY_PROJECT_ID} · episodeId: {VERIFY_EPISODE_ID} · 하단 timeline과는 별개
        </p>
      </div>

      {/* 캐릭터 섹션 */}
      <div className="p-3 space-y-2 shrink-0 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between">
          <p className="text-[9px] text-[#555] uppercase tracking-wider font-medium">
            캐릭터 (선택 시 LoRA 적용)
          </p>
          {!showCreateForm && (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="text-[10px] text-orange-400 hover:text-orange-300 cursor-pointer"
            >
              + 새 캐릭터
            </button>
          )}
        </div>
        {isLoadingCharacters ? (
          <p className="text-[10px] text-[#555]">로딩 중...</p>
        ) : charactersError ? (
          <p className="text-[10px] text-red-400">{charactersError}</p>
        ) : characters.length === 0 && !showCreateForm ? (
          <p className="text-[10px] text-[#555]">
            등록된 캐릭터가 없습니다. 위 버튼으로 등록하세요.
          </p>
        ) : (
          <div className="space-y-1">
            {characters.map((c) => (
              <label
                key={c.modelId}
                className="flex items-center gap-2 cursor-pointer text-[10px] text-[#ccc] hover:bg-[#1e1e1e] rounded px-1 py-0.5"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(c.modelId)}
                  onChange={() => toggleCharacter(c.modelId)}
                  className="accent-orange-500"
                />
                <span>{c.modelName}</span>
                <span className="text-[9px] text-[#555] ml-auto">{c.status}</span>
              </label>
            ))}
          </div>
        )}

        {showCreateForm && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-2 space-y-1.5">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="이름 (예: 소년) *"
              className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded p-1.5 text-[10px] text-white placeholder-[#444] focus:outline-none focus:border-orange-500"
            />
            <input
              type="text"
              value={newTrigger}
              onChange={(e) => setNewTrigger(e.target.value)}
              placeholder="triggerWord (예: anya_v1_5080)"
              className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded p-1.5 text-[10px] text-white placeholder-[#444] focus:outline-none focus:border-orange-500"
            />
            <input
              type="text"
              value={newLoraPath}
              onChange={(e) => setNewLoraPath(e.target.value)}
              placeholder="loraModelPath (예: anya_v1_5080)"
              className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded p-1.5 text-[10px] text-white placeholder-[#444] focus:outline-none focus:border-orange-500"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setNewImage(e.target.files?.[0] ?? null)}
              className="w-full text-[10px] text-[#aaa] file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-orange-500 file:text-white file:cursor-pointer hover:file:bg-orange-600"
            />
            {newImage && (
              <div className="w-full h-20 bg-[#1e1e1e] rounded overflow-hidden">
                <img
                  src={URL.createObjectURL(newImage)}
                  alt="preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            {createError && (
              <p className="text-[10px] text-red-400">{createError}</p>
            )}
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newName.trim() || !newImage || isCreating}
                className="flex-1 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] font-semibold rounded cursor-pointer"
              >
                {isCreating ? "등록 중..." : "등록"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateError(null);
                }}
                className="flex-1 py-1.5 bg-[#2a2a2a] hover:bg-[#333] text-[#aaa] text-[10px] font-semibold rounded cursor-pointer"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 시나리오 입력 + 컨트롤 */}
      <div className="p-3 space-y-2 shrink-0 border-b border-[#2a2a2a]">
        <p className="text-[9px] text-[#555] uppercase tracking-wider font-medium">
          시나리오
        </p>
        <textarea
          value={scenarioText}
          onChange={(e) => setScenarioText(e.target.value)}
          placeholder="50자 이상의 시나리오를 입력하세요. @캐릭터명으로 멘션하면 LoRA가 적용됩니다."
          rows={6}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-2 text-xs text-white placeholder-[#444] focus:outline-none focus:border-orange-500 resize-none"
        />
        <div className="flex items-center justify-between text-[10px]">
          <span className={tooShort ? "text-[#666]" : "text-orange-400"}>
            {trimmedLen} / {MIN_SCENARIO_LENGTH}+
          </span>
          <span className="text-[#555]">상태: {status}</span>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={tooShort || isRunning}
          className="w-full py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
        >
          {isRunning ? `생성 중... ${progress}%` : "생성"}
        </button>
        {isRunning && (
          <div className="w-full h-1 bg-[#222] rounded overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-2 py-1.5">
            <span className="text-red-400 text-[10px]">{error}</span>
          </div>
        )}
      </div>

      {/* 결과 */}
      <div className="flex-1 overflow-y-auto p-3">
        {panels.length === 0 ? (
          <p className="text-[10px] text-[#555] text-center pt-4">
            {status === "completed" ? "패널 0개" : "결과가 여기 표시됩니다"}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {[...panels]
              .sort((a, b) => a.panelOrder - b.panelOrder)
              .map((p) => (
                <div
                  key={p.panelId}
                  className="rounded-lg overflow-hidden border border-[#2a2a2a] bg-[#1e1e1e]"
                >
                  <div className="w-full aspect-[3/4] bg-[#1a1a1a]">
                    {p.finalImageUrl ? (
                      <img
                        src={resolveImageUrl(p.finalImageUrl)}
                        alt={`panel ${p.panelOrder}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#444] text-[10px]">
                        no image
                      </div>
                    )}
                  </div>
                  <p className="text-[9px] text-[#666] p-1.5">컷 {p.panelOrder}</p>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
