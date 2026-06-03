import { useState, useEffect } from "react";
import { mockPresets } from "@/mocks/webtoon";
import { listLoras, createCharacterFromLora, type LoraCatalogItem, type CharacterModelDetail } from "@/lib/characterApi";
import { listBackgrounds, type BackgroundAssetSummary } from "@/lib/backgroundApi";
import type { DrawingTool } from "@/hooks/useEditorState";
import BalloonPanel from "./BalloonPanel";
import type { BalloonShape, BalloonItem } from "./BalloonPanel";
import ImagePanel from "./ImagePanel";
import type { AIGeneratedImage } from "./ImagePanel";
import AiTab from "./AiTab";
import BackgroundLibraryPanel from "./BackgroundLibraryPanel";
import LoraRequestModal from "./LoraRequestModal";
import LoraRequestHistoryModal from "./LoraRequestHistoryModal";

type TabType = "tool" | "library" | "image" | "balloon" | "ai" | "background";

interface LeftPanelProps {
  activeTool: DrawingTool;
  brushSize: number;
  onBrushSizeChange: (v: number) => void;
  brushOpacity: number;
  onBrushOpacityChange: (v: number) => void;
  brushHardness: number;
  onBrushHardnessChange: (v: number) => void;
  onSelectTool: (tool: DrawingTool) => void;
  generatedImages: AIGeneratedImage[];
  onApplyImage: (img: AIGeneratedImage) => void;
  onVectorize: (img: AIGeneratedImage) => void;
  onEditCut: (img: AIGeneratedImage) => void;
  onUploadImage: (file: File) => void;
  isVectorizing: boolean;
  onImageLoad?: (id: string) => void;
  // balloon
  balloonShape: BalloonShape;
  onBalloonShapeChange: (s: BalloonShape) => void;
  balloonFontSize: number;
  onBalloonFontSizeChange: (v: number) => void;
  balloonFontFamily: string;
  onBalloonFontFamilyChange: (v: string) => void;
  balloonTailDir: BalloonItem["tailDir"];
  onBalloonTailDirChange: (v: BalloonItem["tailDir"]) => void;
  balloonBorderColor: string;
  onBalloonBorderColorChange: (v: string) => void;
  balloonBgColor: string;
  onBalloonBgColorChange: (v: string) => void;
  balloonTextColor: string;
  onBalloonTextColorChange: (v: string) => void;
  onSelectBalloonTool: () => void;
  selectedBalloonId: string | null;
  updateBalloon: (id: string, updates: Partial<Omit<BalloonItem, "id">>) => void;
  balloons: BalloonItem[];
  // 활성 프로젝트/에피소드 ID (ScenarioGeneratePanel로 전달)
  activeProjectId: string | null;
  activeEpisodeId: string;
  // 1컷 생성 COMPLETED 시 (AiTab→OneCutPanel로 전달)
  onSingleCutComplete: (newPanelId: number, episodeId: number) => void | Promise<void>;
}

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:8080";

const toAbsoluteImageUrl = (path: string | null | undefined): string =>
  !path ? "" : path.startsWith("http") ? path : `${BASE_URL}${path}`;

const BRUSH_PRESETS: { name: string; icon: string; size: number; opacity: number; hardness: number; tool: DrawingTool }[] = [
  { name: "G펜", icon: "ri-pen-nib-line", size: 3, opacity: 100, hardness: 95, tool: "pen" },
  { name: "밀크펜", icon: "ri-pen-nib-line", size: 5, opacity: 90, hardness: 90, tool: "pen" },
  { name: "수채화", icon: "ri-brush-line", size: 20, opacity: 60, hardness: 40, tool: "brush" },
  { name: "에어브러시", icon: "ri-brush-2-line", size: 40, opacity: 30, hardness: 0, tool: "brush" },
  { name: "연필", icon: "ri-pencil-line", size: 4, opacity: 70, hardness: 85, tool: "pencil" },
  { name: "마커", icon: "ri-mark-pen-line", size: 15, opacity: 80, hardness: 55, tool: "marker" },
  { name: "지우개", icon: "ri-eraser-line", size: 20, opacity: 100, hardness: 100, tool: "eraser" },
  { name: "두꺼운 펜", icon: "ri-pen-nib-fill", size: 8, opacity: 100, hardness: 90, tool: "pen" },
];

export default function LeftPanel({
  activeTool,
  brushSize,
  onBrushSizeChange,
  brushOpacity,
  onBrushOpacityChange,
  brushHardness,
  onBrushHardnessChange,
  onSelectTool,
  generatedImages,
  onApplyImage,
  onVectorize,
  onEditCut,
  onUploadImage,
  isVectorizing,
  onImageLoad,
  balloonShape,
  onBalloonShapeChange,
  balloonFontSize,
  onBalloonFontSizeChange,
  balloonFontFamily,
  onBalloonFontFamilyChange,
  balloonTailDir,
  onBalloonTailDirChange,
  balloonBorderColor,
  onBalloonBorderColorChange,
  balloonBgColor,
  onBalloonBgColorChange,
  balloonTextColor,
  onBalloonTextColorChange,
  onSelectBalloonTool,
  selectedBalloonId,
  updateBalloon,
  balloons,
  activeProjectId,
  activeEpisodeId,
  onSingleCutComplete,
}: LeftPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("tool");
  const [selectedBrushPreset, setSelectedBrushPreset] = useState(0);

  // 세로 툴바에서 툴 바뀌면 프리셋도 자동 동기화
  useEffect(() => {
    // 현재 선택된 프리셋이 이미 activeTool과 같은 타입이면 건너뜀
    // (브러시 프리셋 버튼 눌렀을 때 useEffect가 덮어쓰는 것 방지)
    const currentPreset = BRUSH_PRESETS[selectedBrushPreset];
    if (currentPreset && currentPreset.tool === activeTool) return;

    const matchIndex = BRUSH_PRESETS.findIndex((p) => p.tool === activeTool);
    if (matchIndex !== -1) {
      setSelectedBrushPreset(matchIndex);
    }
  }, [activeTool]);

  const [libraryFilter, setLibraryFilter] = useState<"전체" | "캐릭터" | "배경">("전체");
  const [librarySearch, setLibrarySearch] = useState("");
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  const [presetCategory, setPresetCategory] = useState<"emotions" | "actions" | "angles" | "styles">("emotions");

  // LoRA 카탈로그 — 소재 탭 캐릭터 카드용
  const [loras, setLoras] = useState<LoraCatalogItem[]>([]);
  useEffect(() => {
    listLoras()
      .then((list) => setLoras(list))
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error("[LeftPanel] LoRA 목록 조회 실패:", e);
      });
  }, []);

  // 소재 탭에서 LoRA 카드 클릭 → 자동 등록 후 시나리오 탭에 전달
  const [pendingCharacter, setPendingCharacter] = useState<CharacterModelDetail | null>(null);

  // 배경 자산 — 소재 탭 배경 카드 + 자동 선택용 (Member 단위 자기 자산)
  const [backgrounds, setBackgrounds] = useState<BackgroundAssetSummary[]>([]);
  useEffect(() => {
    listBackgrounds()
      .then((list) => setBackgrounds(list))
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error("[LeftPanel] 배경 목록 조회 실패:", e);
      });
  }, []);

  const [pendingBackgroundAssetId, setPendingBackgroundAssetId] = useState<number | null>(null);

  // LoRA 신청/내역 모달 (소재 탭) — Phase 1/1.5
  const [showLoraRequest, setShowLoraRequest] = useState(false);
  const [showLoraHistory, setShowLoraHistory] = useState(false);
  const [loraRefreshKey, setLoraRefreshKey] = useState(0);

  const loraCards = loras.map((l) => ({
    id: `lora-${l.id}`,
    name: l.displayName,
    tags: [] as string[],
    thumbnail: toAbsoluteImageUrl(l.thumbnailUrl),
    description: l.description ?? "",
  }));

  const backgroundCards = backgrounds.map((bg) => ({
    id: `bg-${bg.assetId}`,
    name: bg.assetName,
    tags: [] as string[],
    thumbnail: toAbsoluteImageUrl(bg.assetUrl),
    description: "",
  }));

  const tabs: { key: TabType; icon: string; label: string }[] = [
    { key: "tool", icon: "ri-brush-line", label: "도구" },
    { key: "balloon", icon: "ri-chat-1-line", label: "대사" },
    { key: "library", icon: "ri-image-2-line", label: "소재" },
    { key: "image", icon: "ri-quill-pen-line", label: "선화 편집" },
    { key: "ai", icon: "ri-sparkling-2-line", label: "AI" },
    { key: "background", icon: "ri-landscape-line", label: "배경" },
  ];

  const filteredItems = [
    ...(libraryFilter === "전체" || libraryFilter === "캐릭터" ? loraCards : []),
    ...(libraryFilter === "전체" || libraryFilter === "배경" ? backgroundCards : []),
  ].filter(
    (item) =>
      !librarySearch ||
      item.name.toLowerCase().includes(librarySearch.toLowerCase()) ||
      item.tags.some((t) => t.includes(librarySearch))
  );

  const togglePreset = (id: string, prompt: string) => {
    setSelectedPresets((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleBalloonTabClick = () => {
    setActiveTab("balloon");
    onSelectBalloonTool();
  };

  return (
    <aside className="w-64 bg-[#151515] border-r border-[#2a2a2a] flex flex-col shrink-0 overflow-hidden">
      {/* 탭 */}
      <div className="flex border-b border-[#2a2a2a] shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              if (tab.key === "balloon") {
                handleBalloonTabClick();
              } else {
                if (activeTab === "balloon" && activeTool === "balloon") {
                  onSelectTool("select");
                }
                setActiveTab(tab.key);
              }
            }}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === tab.key
                ? "text-orange-400 border-b-2 border-orange-500 bg-orange-500/5"
                : "text-[#666] hover:text-[#aaa]"
            }`}
          >
            <i className={`${tab.icon} text-sm`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* 도구 탭 */}
      {activeTab === "tool" && (
        <div className="flex flex-col flex-1 overflow-y-auto">
          <div className="p-3 border-b border-[#2a2a2a]">
            <p className="text-[9px] text-[#555] uppercase tracking-wider font-medium mb-2">브러시 프리셋</p>
            <div className="grid grid-cols-4 gap-1">
              {BRUSH_PRESETS.map((preset, i) => (
                <button
                  key={preset.name}
                  onClick={() => {
                    setSelectedBrushPreset(i);
                    onBrushSizeChange(preset.size);
                    onBrushOpacityChange(preset.opacity);
                    onBrushHardnessChange(preset.hardness);
                    onSelectTool(preset.tool);
                  }}
                  title={preset.name}
                  className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg cursor-pointer transition-all ${
                    selectedBrushPreset === i
                      ? "bg-orange-500/20 border border-orange-500/40"
                      : "bg-[#1e1e1e] border border-[#2a2a2a] hover:border-[#444]"
                  }`}
                >
                  <i className={`${preset.icon} text-sm ${selectedBrushPreset === i ? "text-orange-400" : "text-[#888]"}`} />
                  <span className={`text-[8px] whitespace-nowrap ${selectedBrushPreset === i ? "text-orange-400" : "text-[#666]"}`}>
                    {preset.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 border-b border-[#2a2a2a]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] text-[#555] uppercase tracking-wider font-medium">브러시 크기</p>
              <div className="flex items-center gap-1">
                <button onClick={() => onBrushSizeChange(Math.max(1, brushSize - 1))} className="w-5 h-5 flex items-center justify-center bg-[#1e1e1e] rounded text-[#888] hover:text-[#ccc] cursor-pointer text-xs"><i className="ri-subtract-line" /></button>
                <span className="text-xs text-[#ccc] w-8 text-center font-mono">{brushSize}</span>
                <button onClick={() => onBrushSizeChange(Math.min(200, brushSize + 1))} className="w-5 h-5 flex items-center justify-center bg-[#1e1e1e] rounded text-[#888] hover:text-[#ccc] cursor-pointer text-xs"><i className="ri-add-line" /></button>
              </div>
            </div>
            <input type="range" min={1} max={200} value={brushSize} onChange={(e) => onBrushSizeChange(Number(e.target.value))} className="w-full h-1.5 appearance-none rounded-full cursor-pointer" style={{ background: `linear-gradient(to right, #f97316 ${brushSize / 2}%, #2a2a2a ${brushSize / 2}%)` }} />
            <div className="flex items-center justify-center mt-2 h-8">
              <div className="rounded-full bg-[#ccc]" style={{ width: Math.min(brushSize * 0.5, 60), height: Math.min(brushSize * 0.5, 60) }} />
            </div>
          </div>

          <div className="p-3 border-b border-[#2a2a2a]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] text-[#555] uppercase tracking-wider font-medium">불투명도</p>
              <span className="text-xs text-[#ccc] font-mono">{brushOpacity}%</span>
            </div>
            <input type="range" min={1} max={100} value={brushOpacity} onChange={(e) => onBrushOpacityChange(Number(e.target.value))} className="w-full h-1.5 appearance-none rounded-full cursor-pointer" style={{ background: `linear-gradient(to right, #f97316 ${brushOpacity}%, #2a2a2a ${brushOpacity}%)` }} />
          </div>

          <div className="p-3 border-b border-[#2a2a2a]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] text-[#555] uppercase tracking-wider font-medium">경도</p>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-5 h-5 rounded-full bg-[#ccc] transition-all"
                  style={{ filter: brushHardness < 100 ? `blur(${(100 - brushHardness) * 0.05}px)` : undefined }}
                />
                <span className="text-xs text-[#ccc] font-mono">{brushHardness}</span>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={brushHardness}
              onChange={(e) => onBrushHardnessChange(Number(e.target.value))}
              className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
              style={{ background: `linear-gradient(to right, rgba(249,115,22,0.3) ${brushHardness}%, #f97316 ${brushHardness}%)` }}
            />
            <div className="flex justify-between mt-2.5 gap-0.5">
              {[0, 25, 50, 75, 100].map((h) => (
                <button
                  key={h}
                  onClick={() => onBrushHardnessChange(h)}
                  title={`경도 ${h}`}
                  className={`flex items-center justify-center cursor-pointer rounded-md transition-all w-full ${
                    brushHardness === h
                      ? "bg-orange-500/15 ring-1 ring-orange-500/40"
                      : "hover:bg-[#222]"
                  }`}
                  style={{ height: 24 }}
                >
                  <div
                    className="rounded-full bg-[#ccc]"
                    style={{
                      width: 28,
                      height: Math.max(1.5, 5 - h * 0.035),
                      filter: h < 100 ? `blur(${(100 - h) * 0.06}px)` : undefined,
                      opacity: h < 10 ? 0.4 : 0.85,
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 말풍선 탭 */}
      {activeTab === "balloon" && (
        <BalloonPanel
          selectedShape={balloonShape}
          onSelectShape={onBalloonShapeChange}
          fontSize={balloonFontSize}
          onFontSizeChange={onBalloonFontSizeChange}
          fontFamily={balloonFontFamily}
          onFontFamilyChange={onBalloonFontFamilyChange}
          tailDir={balloonTailDir}
          onTailDirChange={onBalloonTailDirChange}
          borderColor={balloonBorderColor}
          onBorderColorChange={onBalloonBorderColorChange}
          bgColor={balloonBgColor}
          onBgColorChange={onBalloonBgColorChange}
          textColor={balloonTextColor}
          onTextColorChange={onBalloonTextColorChange}
          balloons={balloons}
          selectedBalloonId={selectedBalloonId}
          updateBalloon={updateBalloon}
        />
      )}

      {/* 소재 라이브러리 탭 */}
      {activeTab === "library" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="p-3 pb-2 shrink-0">
            <div className="relative">
              <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-[#555] text-sm" />
              <input value={librarySearch} onChange={(e) => setLibrarySearch(e.target.value)} placeholder="소재 검색..." className="w-full h-8 bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg pl-8 pr-3 text-xs text-[#ccc] placeholder-[#444] outline-none focus:border-orange-500/50" />
            </div>
          </div>
          <div className="flex gap-2 px-3 pb-2 shrink-0">
            <button
              onClick={() => setShowLoraRequest(true)}
              className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg border border-orange-500/40 text-orange-400 text-[11px] font-medium hover:bg-orange-500/10 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line text-sm" />
              LoRA 신청
            </button>
            <button
              onClick={() => setShowLoraHistory(true)}
              className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg bg-[#222] text-[#888] text-[11px] hover:text-[#ccc] hover:bg-[#2a2a2a] transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-history-line text-sm" />
              내 신청 내역
            </button>
          </div>
          <div className="flex gap-1 px-3 pb-2 shrink-0">
            {(["전체", "캐릭터", "배경"] as const).map((f) => (
              <button key={f} onClick={() => setLibraryFilter(f)} className={`px-2.5 py-1 rounded-full text-[10px] transition-colors cursor-pointer whitespace-nowrap ${libraryFilter === f ? "bg-orange-500 text-white" : "bg-[#222] text-[#888] hover:bg-[#2a2a2a]"}`}>{f}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            <div className="grid grid-cols-2 gap-2">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={async () => {
                    // 배경 카드 — 자기 자산, 등록 없이 selectedBgIds에 add
                    const bg = backgrounds.find((b) => `bg-${b.assetId}` === item.id);
                    if (bg) {
                      setActiveTab("ai");
                      setPendingBackgroundAssetId(bg.assetId);
                      return;
                    }
                    // LoRA 카드 — 자동 등록 후 시나리오 탭에 push
                    const lora = loras.find((l) => `lora-${l.id}` === item.id);
                    if (!lora) return;
                    if (!activeProjectId) {
                      // eslint-disable-next-line no-console
                      console.warn("[LeftPanel] activeProjectId 없음 — LoRA 자동 등록 skip");
                      return;
                    }
                    const projectIdNum = Number(activeProjectId);
                    if (Number.isNaN(projectIdNum)) return;
                    try {
                      const created = await createCharacterFromLora(projectIdNum, lora.fileName);
                      setActiveTab("ai");
                      setPendingCharacter(created);
                    } catch (e) {
                      // eslint-disable-next-line no-console
                      console.error("[LeftPanel] LoRA 자동 등록 실패:", e);
                    }
                  }}
                  className="group relative rounded-lg overflow-hidden border border-[#2a2a2a] hover:border-orange-500/50 transition-colors cursor-pointer bg-[#1e1e1e]"
                >
                  <div className="w-full aspect-[3/4] overflow-hidden bg-[#1a1a1a]">
                    <img src={item.thumbnail} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                  <div className="p-1.5">
                    <p className="text-[10px] text-[#ccc] font-medium truncate">{item.name}</p>
                    <div className="flex flex-wrap gap-0.5 mt-0.5">
                      {item.tags.slice(0, 2).map((tag) => (<span key={tag} className="text-[8px] text-[#666] bg-[#222] px-1 py-0.5 rounded">{tag}</span>))}
                    </div>
                  </div>
                </button>
              ))}
              <button className="flex flex-col items-center justify-center aspect-[3/4] rounded-lg border-2 border-dashed border-[#2a2a2a] hover:border-orange-500/40 text-[#555] hover:text-[#888] transition-colors cursor-pointer">
                <i className="ri-add-line text-xl mb-1" />
                <span className="text-[10px]">추가</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 선화 편집 탭 */}
      {activeTab === "image" && (
        <ImagePanel
          generatedImages={generatedImages}
          onApplyImage={onApplyImage}
          onVectorize={onVectorize}
          onEditCut={onEditCut}
          onUploadImage={onUploadImage}
          isVectorizing={isVectorizing}
          onImageLoad={onImageLoad}
        />
      )}

      {/* AI 탭 — 다컷/1컷 서브탭 (backend 파이프라인, Pollinations와 별개) */}
      {activeTab === "ai" && (
        <AiTab
          projectId={activeProjectId}
          episodeId={activeEpisodeId}
          pendingCharacter={pendingCharacter}
          onConsumePendingCharacter={() => setPendingCharacter(null)}
          pendingBackgroundAssetId={pendingBackgroundAssetId}
          onConsumePendingBackground={() => setPendingBackgroundAssetId(null)}
          onSingleCutComplete={onSingleCutComplete}
        />
      )}

      {/* 배경 라이브러리 탭 — backend background-assets API */}
      {activeTab === "background" && <BackgroundLibraryPanel />}

      {/* LoRA 신청 / 내역 모달 (소재 탭) — Phase 1/1.5 복구 */}
      <LoraRequestModal
        isOpen={showLoraRequest}
        onClose={() => setShowLoraRequest(false)}
        onCreated={() => setLoraRefreshKey((k) => k + 1)}
      />
      <LoraRequestHistoryModal
        isOpen={showLoraHistory}
        onClose={() => setShowLoraHistory(false)}
        refreshKey={loraRefreshKey}
      />
    </aside>
  );
}
