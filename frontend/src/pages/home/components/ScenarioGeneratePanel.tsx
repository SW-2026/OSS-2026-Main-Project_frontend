import { useState, useEffect } from "react";
import { usePanelGeneration } from "@/hooks/usePanelGeneration";
import {
  listCharacters,
  getCharacter,
  createCharacter,
  listLoras,
  type CharacterModelSummary,
  type CharacterModelDetail,
  type LoraCatalogItem,
} from "@/lib/characterApi";
import {
  listBackgrounds,
  type BackgroundAssetSummary,
} from "@/lib/backgroundApi";

// 활성 프로젝트/에피소드 ID — useEditorState에서 LeftPanel → 본 컴포넌트로 prop 전달
interface ScenarioGeneratePanelProps {
  projectId: string | null;   // useEditorState.activeProjectId (URL에서 옴, string)
  episodeId: string;          // useEditorState.activeEpisodeId (string, 가짜는 "ep-..." prefix)
  pendingCharacter: CharacterModelDetail | null;   // 소재 탭에서 LoRA 클릭 → 자동 등록된 캐릭터
  onConsumePendingCharacter: () => void;            // pendingCharacter 소비 후 초기화 콜백
  pendingBackgroundAssetId: number | null;          // 소재 탭에서 배경 카드 클릭 → 자동 선택
  onConsumePendingBackground: () => void;           // pendingBackgroundAssetId 소비 후 초기화 콜백
}

const MIN_SCENARIO_LENGTH = 50;

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:8080";

function resolveImageUrl(path: string): string {
  return path.startsWith("http") ? path : `${BASE_URL}${path}`;
}

export default function ScenarioGeneratePanel({
  projectId,
  episodeId,
  pendingCharacter,
  onConsumePendingCharacter,
  pendingBackgroundAssetId,
  onConsumePendingBackground,
}: ScenarioGeneratePanelProps) {
  // backend ID 변환 (string → number). 가짜(`ep-...`/`cut-...`)나 null이면 NaN
  const projectIdNum = projectId != null ? Number(projectId) : NaN;
  const episodeIdNum = Number(episodeId);
  const isValidProject = !Number.isNaN(projectIdNum);
  const isValidEpisode = !Number.isNaN(episodeIdNum);

  const [scenarioText, setScenarioText] = useState("");
  const { status, progress, panels, error, start, seed } = usePanelGeneration();

  // 캐릭터 목록 + 선택 + detail 캐시
  const [characters, setCharacters] = useState<CharacterModelSummary[]>([]);
  const [characterDetailCache, setCharacterDetailCache] = useState<
    Record<number, CharacterModelDetail>
  >({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [charactersError, setCharactersError] = useState<string | null>(null);
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(true);

  // LoRA 카탈로그 — 등록 폼 select용 (마운트 시 1회)
  const [loras, setLoras] = useState<LoraCatalogItem[]>([]);

  // 등록 폼 state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTrigger, setNewTrigger] = useState("");
  const [newLoraPath, setNewLoraPath] = useState("");
  const [newImage, setNewImage] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // 배경 목록 + 선택 (배경-E) — Member 단위, 등록은 배경 탭에서
  const [backgrounds, setBackgrounds] = useState<BackgroundAssetSummary[]>([]);
  const [selectedBgIds, setSelectedBgIds] = useState<Set<number>>(new Set());
  const [backgroundsError, setBackgroundsError] = useState<string | null>(null);
  const [isLoadingBackgrounds, setIsLoadingBackgrounds] = useState(true);

  // LoRA 카탈로그 — 등록 폼 select용 (마운트 시 1회)
  useEffect(() => {
    listLoras()
      .then((list) => setLoras(list))
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error("[ScenarioGeneratePanel] LoRA 목록 조회 실패:", e);
      });
  }, []);

  // 소재 탭에서 배경 카드 클릭 → selectedBgIds에 자동 추가
  useEffect(() => {
    if (pendingBackgroundAssetId != null) {
      setSelectedBgIds((prev) => new Set(prev).add(pendingBackgroundAssetId));
      onConsumePendingBackground();
    }
  }, [pendingBackgroundAssetId, onConsumePendingBackground]);

  // 소재 탭에서 LoRA 카드 클릭으로 자동 등록된 캐릭터 받아들임 → 목록 + 캐시 + 자동선택
  useEffect(() => {
    if (pendingCharacter) {
      const summary: CharacterModelSummary = {
        modelId: pendingCharacter.modelId,
        modelName: pendingCharacter.modelName,
        status: pendingCharacter.status,
        createdAt: pendingCharacter.createdAt,
      };
      setCharacters((prev) =>
        prev.some((c) => c.modelId === summary.modelId) ? prev : [...prev, summary]
      );
      setCharacterDetailCache((prev) => ({ ...prev, [pendingCharacter.modelId]: pendingCharacter }));
      setSelectedIds((prev) => new Set(prev).add(pendingCharacter.modelId));
      onConsumePendingCharacter();
    }
  }, [pendingCharacter, onConsumePendingCharacter]);

  useEffect(() => {
    if (!isValidProject) {
      setIsLoadingCharacters(false);
      return;
    }
    setIsLoadingCharacters(true);
    listCharacters(projectIdNum)
      .then((list) => setCharacters(list))
      .catch((e) =>
        setCharactersError(
          e instanceof Error ? e.message : "캐릭터 목록 조회 실패"
        )
      )
      .finally(() => setIsLoadingCharacters(false));
  }, [projectIdNum, isValidProject]);

  // 배경 목록 — Member 단위 (project 무관)
  useEffect(() => {
    listBackgrounds()
      .then((list) => setBackgrounds(list))
      .catch((e) =>
        setBackgroundsError(
          e instanceof Error ? e.message : "배경 목록 조회 실패"
        )
      )
      .finally(() => setIsLoadingBackgrounds(false));
  }, []);

  // 새로고침 후 결과 패널 복원 — backend listPanels로 panels seed
  useEffect(() => {
    if (isValidEpisode) {
      seed(episodeIdNum);
    }
  }, [episodeIdNum, isValidEpisode, seed]);

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
          // detail GET 실패해도 선택은 유지
        }
      }
    }
    setSelectedIds(newSelected);
  };

  const toggleBackground = (assetId: number) => {
    setSelectedBgIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newImage || isCreating || !isValidProject) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const created = await createCharacter(
        projectIdNum,
        {
          modelName: newName.trim(),
          triggerWord: newTrigger.trim() || undefined,
          loraModelPath: newLoraPath.trim() || undefined,
        },
        [newImage]
      );
      // 캐시에 등록
      setCharacterDetailCache((prev) => ({
        ...prev,
        [created.modelId]: created,
      }));
      // 목록에 추가
      setCharacters((prev) => [
        ...prev,
        {
          modelId: created.modelId,
          modelName: created.modelName,
          status: created.status,
          createdAt: created.createdAt,
        },
      ]);
      // 폼 초기화
      setNewName("");
      setNewTrigger("");
      setNewLoraPath("");
      setNewImage(null);
      setShowCreateForm(false);
      // 자동 선택
      setSelectedIds((prev) => new Set(prev).add(created.modelId));
    } catch (e: any) {
      setCreateError(e?.message ?? "캐릭터 등록 실패");
    } finally {
      setIsCreating(false);
    }
  };

  const isRunning = status === "pending" || status === "processing";
  const trimmedLen = scenarioText.trim().length;
  const tooShort = trimmedLen < MIN_SCENARIO_LENGTH;

  const handleGenerate = () => {
    if (tooShort || isRunning || !isValidEpisode) return;
    const mentions = [...selectedIds].map((id) => {
      const detail = characterDetailCache[id];
      const summary = characters.find((c) => c.modelId === id);
      return {
        modelId: id,
        modelName: summary?.modelName ?? detail?.modelName ?? `캐릭터 ${id}`,
        triggerWord: detail?.triggerWord ?? null,
        loraModelPath: detail?.loraModelPath ?? null,
      };
    });
    const bgMentions = [...selectedBgIds].map((id) => {
      const bg = backgrounds.find((b) => b.assetId === id);
      return {
        name: bg?.assetName ?? "",
        assetId: id,
        assetUrl: bg?.assetUrl ?? null,
      };
    });
    start(episodeIdNum, {
      scenarioText: scenarioText.trim(),
      characters: mentions,
      backgrounds: bgMentions,
    });
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* 헤더 — 활성 프로젝트/에피소드의 backend ID 표시 */}
      <div className="px-3 py-2 border-b border-[#2a2a2a] shrink-0">
        <p className="text-[10px] text-[#888]">
          backend 시나리오→컷 파이프라인
        </p>
        <p className="text-[9px] text-[#555] mt-0.5">
          episodeId: {isValidEpisode ? episodeIdNum : "—"} · projectId: {isValidProject ? projectIdNum : "—"}
        </p>
      </div>

      {/* 배경 섹션 — 배경-E (#배경 멘션 매칭) */}
      <div className="p-3 space-y-2 shrink-0 border-b border-[#2a2a2a]">
        <p className="text-[9px] text-[#555] uppercase tracking-wider font-medium">
          배경 (#배경 멘션 매칭)
        </p>
        {isLoadingBackgrounds ? (
          <p className="text-[10px] text-[#555]">로딩 중...</p>
        ) : backgroundsError ? (
          <p className="text-[10px] text-red-400">{backgroundsError}</p>
        ) : backgrounds.length === 0 ? (
          <p className="text-[10px] text-[#555]">
            등록된 배경이 없습니다. 좌측 배경 탭에서 등록하세요.
          </p>
        ) : (
          <div className="space-y-1">
            {backgrounds.map((b) => (
              <label
                key={b.assetId}
                className="flex items-center gap-2 cursor-pointer text-[10px] text-[#ccc] hover:bg-[#1e1e1e] rounded px-1 py-0.5"
              >
                <input
                  type="checkbox"
                  checked={selectedBgIds.has(b.assetId)}
                  onChange={() => toggleBackground(b.assetId)}
                  className="accent-orange-500"
                />
                <span>#{b.assetName}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 입력 + 컨트롤 */}
      <div className="p-3 space-y-2 shrink-0 border-b border-[#2a2a2a]">
        <p className="text-[9px] text-[#555] uppercase tracking-wider font-medium">
          시나리오
        </p>
        <textarea
          value={scenarioText}
          onChange={(e) => setScenarioText(e.target.value)}
          placeholder="50자 이상의 시나리오를 입력하세요. @캐릭터명/#배경명으로 멘션하면 LoRA/배경이 적용됩니다."
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
          disabled={tooShort || isRunning || !isValidEpisode}
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

      {/* 캐릭터 선택 */}
      <div className="p-3 space-y-2 shrink-0 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between">
          <p className="text-[9px] text-[#555] uppercase tracking-wider font-medium">
            캐릭터
          </p>
          <button
            type="button"
            onClick={() => setShowCreateForm((v) => !v)}
            className="text-[9px] text-orange-400 hover:text-orange-300 cursor-pointer"
          >
            <i
              className={`${
                showCreateForm ? "ri-close-line" : "ri-add-line"
              } mr-0.5`}
            />
            {showCreateForm ? "닫기" : "등록"}
          </button>
        </div>

        {/* 등록 폼 */}
        {showCreateForm && (
          <div className="space-y-2 p-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="캐릭터 이름 *"
              className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 text-xs text-white placeholder-[#555] focus:outline-none focus:border-orange-500"
            />
            <input
              value={newTrigger}
              onChange={(e) => setNewTrigger(e.target.value)}
              placeholder="트리거 워드 (선택)"
              className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 text-xs text-white placeholder-[#555] focus:outline-none focus:border-orange-500"
            />
            <select
              value={newLoraPath}
              onChange={(e) => {
                const fileName = e.target.value;
                setNewLoraPath(fileName);
                // 선택된 LoRA의 triggerWord 자동 채움 (덮어씀)
                const selected = loras.find((l) => l.fileName === fileName);
                if (selected?.triggerWord) {
                  setNewTrigger(selected.triggerWord);
                }
              }}
              className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
            >
              <option value="">LoRA 선택 (선택사항)</option>
              {loras.map((l) => (
                <option key={l.id} value={l.fileName}>{l.displayName}</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <label className="flex-1 flex items-center gap-1.5 bg-[#111] border border-dashed border-[#333] rounded px-2 py-1.5 text-xs text-[#666] hover:border-orange-500/50 cursor-pointer transition-colors">
                <i className="ri-image-add-line text-sm" />
                {newImage ? newImage.name : "참조 이미지 업로드 *"}
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
                disabled={!newName.trim() || !newImage || isCreating || !isValidProject}
                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs rounded cursor-pointer whitespace-nowrap"
              >
                {isCreating ? "등록 중..." : "등록"}
              </button>
            </div>
            {createError && (
              <span className="text-red-400 text-[10px]">{createError}</span>
            )}
          </div>
        )}

        {/* 캐릭터 목록 */}
        {isLoadingCharacters ? (
          <p className="text-[10px] text-[#555] pt-1">로딩 중...</p>
        ) : charactersError ? (
          <p className="text-[10px] text-red-400 pt-1">{charactersError}</p>
        ) : characters.length === 0 ? (
          <p className="text-[10px] text-[#555] pt-1">
            등록된 캐릭터가 없습니다.
          </p>
        ) : (
          <div className="max-h-32 overflow-y-auto space-y-1">
            {characters.map((ch) => {
              const isSelected = selectedIds.has(ch.modelId);
              const detail = characterDetailCache[ch.modelId];
              return (
                <button
                  key={ch.modelId}
                  type="button"
                  onClick={() => toggleCharacter(ch.modelId)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-orange-500/15 border border-orange-500/30"
                      : "bg-[#1e1e1e] border border-[#2a2a2a] hover:border-[#444]"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      isSelected
                        ? "bg-orange-500 border-orange-500"
                        : "border-[#444]"
                    }`}
                  >
                    {isSelected && (
                      <i className="ri-check-line text-white text-[10px]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[#ccc] truncate">
                      {ch.modelName}
                    </p>
                    {detail?.triggerWord && (
                      <p className="text-[9px] text-[#555] truncate">
                        tw: {detail.triggerWord}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-[8px] px-1 py-0.5 rounded shrink-0 ${
                      ch.status === "ACTIVE"
                        ? "bg-green-500/20 text-green-400"
                        : ch.status === "TRAINING"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : ch.status === "FAILED"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-[#333] text-[#777]"
                    }`}
                  >
                    {ch.status}
                  </span>
                </button>
              );
            })}
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
              .map((panel) => (
                <div
                  key={panel.panelId}
                  className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden"
                >
                  {/* 썸네일 */}
                  <div className="w-full aspect-[3/4] bg-[#111] overflow-hidden relative">
                    {panel.imageUrl ? (
                      <img
                        src={resolveImageUrl(panel.imageUrl)}
                        alt={`컷 ${panel.panelOrder}`}
                        className="w-full h-full object-cover object-top"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <i className="ri-image-line text-[#333] text-2xl" />
                      </div>
                    )}
                    {/* 패널 번호 뱃지 */}
                    <div className="absolute top-1 left-1 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded">
                      #{panel.panelOrder}
                    </div>
                  </div>
                  {/* 프롬프트 */}
                  <div className="p-1.5">
                    <p className="text-[10px] text-[#888] truncate">
                      {panel.prompt || `컷 ${panel.panelOrder}`}
                    </p>
                    <p className="text-[8px] text-[#555] mt-0.5">
                      {panel.status}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}