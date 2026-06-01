import { useEffect, useState } from "react";
import { usePanelGeneration } from "@/hooks/usePanelGeneration";
import {
  listCharacters,
  type CharacterModelSummary,
} from "@/lib/characterApi";
import {
  listBackgrounds,
  type BackgroundAssetSummary,
} from "@/lib/backgroundApi";

// 1컷 생성 패널 — 다컷(ScenarioGeneratePanel) UI 축소판. 캐릭터/배경 단일선택(라디오)
interface OneCutPanelProps {
  projectId: string | null;
  episodeId: string;
  // 생성 COMPLETED 시 호출 — page.tsx에서 handleSave→refreshCuts→setActiveCut 수행
  onSingleCutComplete: (newPanelId: number, episodeId: number) => void | Promise<void>;
}

const MIN_SCENARIO_LENGTH = 10;

export default function OneCutPanel({
  projectId,
  episodeId,
  onSingleCutComplete,
}: OneCutPanelProps) {
  const projectIdNum = projectId != null ? Number(projectId) : NaN;
  const episodeIdNum = Number(episodeId);
  const isValidProject = !Number.isNaN(projectIdNum);
  const isValidEpisode = !Number.isNaN(episodeIdNum);

  const [scenarioText, setScenarioText] = useState("");
  const { status, progress, error, startSingle } = usePanelGeneration();

  const [characters, setCharacters] = useState<CharacterModelSummary[]>([]);
  const [selectedCharId, setSelectedCharId] = useState<number | null>(null);
  const [charactersError, setCharactersError] = useState<string | null>(null);

  const [backgrounds, setBackgrounds] = useState<BackgroundAssetSummary[]>([]);
  const [selectedBgId, setSelectedBgId] = useState<number | null>(null);
  const [backgroundsError, setBackgroundsError] = useState<string | null>(null);

  useEffect(() => {
    if (!isValidProject) return;
    listCharacters(projectIdNum)
      .then((list) => setCharacters(list))
      .catch((e) =>
        setCharactersError(e instanceof Error ? e.message : "캐릭터 목록 조회 실패")
      );
  }, [projectIdNum, isValidProject]);

  useEffect(() => {
    listBackgrounds()
      .then((list) => setBackgrounds(list))
      .catch((e) =>
        setBackgroundsError(e instanceof Error ? e.message : "배경 목록 조회 실패")
      );
  }, []);

  const isRunning = status === "pending" || status === "processing";
  const trimmedLen = scenarioText.trim().length;
  const tooShort = trimmedLen < MIN_SCENARIO_LENGTH;

  const handleGenerate = () => {
    if (tooShort || isRunning || !isValidEpisode) return;
    startSingle(
      episodeIdNum,
      {
        scenarioText: scenarioText.trim(),
        characterIds: selectedCharId != null ? [selectedCharId] : [],
        backgroundAssetId: selectedBgId,
      },
      (newPanelId) => onSingleCutComplete(newPanelId, episodeIdNum)
    );
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* 헤더 */}
      <div className="px-3 py-2 border-b border-[#2a2a2a] shrink-0">
        <p className="text-[10px] text-[#888]">1컷 생성 (한 장면 → 새 컷)</p>
        <p className="text-[9px] text-[#555] mt-0.5">
          episodeId: {isValidEpisode ? episodeIdNum : "—"} · projectId:{" "}
          {isValidProject ? projectIdNum : "—"}
        </p>
      </div>

      {/* 시나리오 입력 */}
      <div className="p-3 space-y-2 shrink-0 border-b border-[#2a2a2a]">
        <p className="text-[9px] text-[#555] uppercase tracking-wider font-medium">
          시나리오 (1컷)
        </p>
        <textarea
          value={scenarioText}
          onChange={(e) => setScenarioText(e.target.value)}
          placeholder="한 장면을 묘사하세요. 예: 카페에서 창밖을 보며 미소 짓는다."
          rows={3}
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

      {/* 캐릭터 단일선택 (라디오) */}
      <div className="p-3 space-y-2 shrink-0 border-b border-[#2a2a2a]">
        <p className="text-[9px] text-[#555] uppercase tracking-wider font-medium">
          캐릭터 (1명 선택)
        </p>
        {charactersError ? (
          <p className="text-[10px] text-red-400">{charactersError}</p>
        ) : characters.length === 0 ? (
          <p className="text-[10px] text-[#555]">등록된 캐릭터가 없습니다.</p>
        ) : (
          <div className="max-h-28 overflow-y-auto space-y-1">
            {characters.map((ch) => {
              const isSelected = selectedCharId === ch.modelId;
              return (
                <button
                  key={ch.modelId}
                  type="button"
                  onClick={() =>
                    setSelectedCharId(isSelected ? null : ch.modelId)
                  }
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-orange-500/15 border border-orange-500/30"
                      : "bg-[#1e1e1e] border border-[#2a2a2a] hover:border-[#444]"
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                      isSelected ? "border-orange-500" : "border-[#444]"
                    }`}
                  >
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                    )}
                  </span>
                  <span className="flex-1 min-w-0 text-[11px] text-[#ccc] truncate">
                    {ch.modelName}
                  </span>
                  <span className="text-[8px] text-[#666]">{ch.status}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 배경 단일선택 (라디오, 없음 허용) */}
      <div className="p-3 space-y-2 shrink-0 border-b border-[#2a2a2a]">
        <p className="text-[9px] text-[#555] uppercase tracking-wider font-medium">
          배경 (1개 선택, 선택 안 함 가능)
        </p>
        {backgroundsError ? (
          <p className="text-[10px] text-red-400">{backgroundsError}</p>
        ) : backgrounds.length === 0 ? (
          <p className="text-[10px] text-[#555]">
            등록된 배경이 없습니다. 좌측 배경 탭에서 등록하세요.
          </p>
        ) : (
          <div className="max-h-28 overflow-y-auto space-y-1">
            {backgrounds.map((b) => {
              const isSelected = selectedBgId === b.assetId;
              return (
                <button
                  key={b.assetId}
                  type="button"
                  onClick={() => setSelectedBgId(isSelected ? null : b.assetId)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-orange-500/15 border border-orange-500/30"
                      : "bg-[#1e1e1e] border border-[#2a2a2a] hover:border-[#444]"
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                      isSelected ? "border-orange-500" : "border-[#444]"
                    }`}
                  >
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                    )}
                  </span>
                  <span className="flex-1 min-w-0 text-[11px] text-[#ccc] truncate">
                    #{b.assetName}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <p className="text-[10px] text-[#555] text-center pt-2">
          {status === "completed"
            ? "생성 완료 — 새 컷이 트랙에 추가되었습니다."
            : "생성하면 새 컷으로 추가됩니다."}
        </p>
      </div>
    </div>
  );
}