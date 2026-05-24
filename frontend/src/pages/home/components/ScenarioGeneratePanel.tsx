import { useState } from "react";
import { usePanelGeneration } from "@/hooks/usePanelGeneration";

// ⚠️ 검증용 임시 hardcoded episodeId
// TODO(1-C): Episode CRUD를 backend로 통합한 후 — 하단 timeline의 episodeId(현재 Supabase string UUID)를
//            backend Long으로 전환 → 이 상수 제거, 활성 에피소드에서 가져오기.
// 사용 전 사용자 측 준비:
//   curl POST /api/projects {title,genre} → projectId
//   curl POST /api/projects/{id}/episodes {epNumber,epTitle} → episodeId
//   그 episodeId를 아래 상수로 교체.
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

  const isRunning = status === "pending" || status === "processing";
  const trimmedLen = scenarioText.trim().length;
  const tooShort = trimmedLen < MIN_SCENARIO_LENGTH;

  const handleGenerate = () => {
    if (tooShort || isRunning) return;
    start(VERIFY_EPISODE_ID, {
      scenarioText: scenarioText.trim(),
      characters: [],
    });
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* 헤더 — 하단 timeline과 별개 명시 */}
      <div className="px-3 py-2 border-b border-[#2a2a2a] shrink-0">
        <p className="text-[10px] text-[#888]">
          backend 시나리오→컷 파이프라인 검증용
        </p>
        <p className="text-[9px] text-[#555] mt-0.5">
          episodeId: {VERIFY_EPISODE_ID} · 하단 timeline과는 별개 시스템
        </p>
      </div>

      {/* 입력 + 컨트롤 */}
      <div className="p-3 space-y-2 shrink-0 border-b border-[#2a2a2a]">
        <p className="text-[9px] text-[#555] uppercase tracking-wider font-medium">
          시나리오
        </p>
        <textarea
          value={scenarioText}
          onChange={(e) => setScenarioText(e.target.value)}
          placeholder="50자 이상의 시나리오를 입력하세요. backend가 6~14컷으로 자동 분해합니다."
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
