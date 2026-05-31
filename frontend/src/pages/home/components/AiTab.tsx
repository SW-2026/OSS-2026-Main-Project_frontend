import { useState } from "react";
import ScenarioGeneratePanel from "./ScenarioGeneratePanel";
import OneCutPanel from "./OneCutPanel";
import type { CharacterModelDetail } from "@/lib/characterApi";

// AI 탭 래퍼 — [다컷/1컷] 서브탭. 다컷은 ScenarioGeneratePanel 그대로(무손상), 1컷은 OneCutPanel.
// props는 LeftPanel → 본 래퍼 → ScenarioGeneratePanel로 그대로 포워딩 (소재 탭 auto-push 유지)
interface AiTabProps {
  projectId: string | null;
  episodeId: string;
  pendingCharacter: CharacterModelDetail | null;
  onConsumePendingCharacter: () => void;
  pendingBackgroundAssetId: number | null;
  onConsumePendingBackground: () => void;
}

type SubTab = "multi" | "single";

export default function AiTab(props: AiTabProps) {
  const [sub, setSub] = useState<SubTab>("multi");

  const subTabs: { key: SubTab; label: string }[] = [
    { key: "multi", label: "다컷" },
    { key: "single", label: "1컷" },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* 서브탭 세그먼트 */}
      <div className="flex gap-1 p-2 border-b border-[#2a2a2a] shrink-0">
        {subTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSub(t.key)}
            className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              sub === t.key
                ? "bg-orange-500 text-white"
                : "bg-[#222] text-[#888] hover:bg-[#2a2a2a]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 다컷은 항상 마운트 유지(상태 보존), 1컷일 때만 숨김 */}
      {sub === "multi" ? (
        <ScenarioGeneratePanel {...props} />
      ) : (
        <OneCutPanel />
      )}
    </div>
  );
}
