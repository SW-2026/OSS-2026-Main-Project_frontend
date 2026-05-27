import { useState } from "react";

export type BalloonShape = "round" | "rect" | "cloud" | "spiky" | "shout" | "whisper" | "thought" | "double" | "burst" | "rounded-rect";

export interface BalloonItem {
  id: string;
  shape: BalloonShape;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  tailDir: "bottom-left" | "bottom-right" | "top-left" | "top-right" | "none";
  borderColor: string;
  bgColor: string;
  textColor: string;
}

interface BalloonPanelProps {
  selectedShape: BalloonShape;
  onSelectShape: (shape: BalloonShape) => void;
  fontSize: number;
  onFontSizeChange: (v: number) => void;
  fontFamily: string;
  onFontFamilyChange: (v: string) => void;
  tailDir: BalloonItem["tailDir"];
  onTailDirChange: (v: BalloonItem["tailDir"]) => void;
  borderColor: string;
  onBorderColorChange: (v: string) => void;
  bgColor: string;
  onBgColorChange: (v: string) => void;
  textColor: string;
  onTextColorChange: (v: string) => void;
  // 선택된 말풍선 동기화용
  balloons: BalloonItem[];
  selectedBalloonId: string | null;
  updateBalloon: (id: string, updates: Partial<Omit<BalloonItem, "id">>) => void;
}

const BALLOON_SHAPES: { id: BalloonShape; label: string; preview: string }[] = [
  { id: "round", label: "둥근 말풍선", preview: "round" },
  { id: "rect", label: "사각 말풍선", preview: "rect" },
  { id: "rounded-rect", label: "둥근 사각", preview: "rounded-rect" },
  { id: "cloud", label: "구름 말풍선", preview: "cloud" },
  { id: "spiky", label: "뾰족 말풍선", preview: "spiky" },
  { id: "shout", label: "외침 말풍선", preview: "shout" },
  { id: "burst", label: "폭발 말풍선", preview: "burst" },
  { id: "whisper", label: "속삭임", preview: "whisper" },
  { id: "thought", label: "생각 말풍선", preview: "thought" },
  { id: "double", label: "이중 말풍선", preview: "double" },
];

const TAIL_DIRS: { id: BalloonItem["tailDir"]; icon: string; label: string }[] = [
  { id: "bottom-left", icon: "ri-arrow-left-down-line", label: "좌하" },
  { id: "bottom-right", icon: "ri-arrow-right-down-line", label: "우하" },
  { id: "top-left", icon: "ri-arrow-left-up-line", label: "좌상" },
  { id: "top-right", icon: "ri-arrow-right-up-line", label: "우상" },
  { id: "none", icon: "ri-close-line", label: "없음" },
];

const FONT_FAMILIES = [
  { value: "Noto Sans KR", label: "노토 산스" },
  { value: "Nanum Gothic", label: "나눔 고딕" },
  { value: "Nanum Myeongjo", label: "나눔 명조" },
  { value: "Black Han Sans", label: "블랙 한 산스" },
  { value: "Jua", label: "주아체" },
  { value: "Gaegu", label: "개구체" },
];

function BalloonShapePreview({ shape, selected }: { shape: BalloonShape; selected: boolean }) {
  const stroke = selected ? "#f97316" : "#555";
  const fill = selected ? "rgba(249,115,22,0.08)" : "rgba(255,255,255,0.03)";

  const renderShape = () => {
    switch (shape) {
      case "round":
        return (
          <svg viewBox="0 0 60 50" className="w-full h-full">
            <ellipse cx="30" cy="20" rx="26" ry="14" fill={fill} stroke={stroke} strokeWidth="1.5" />
            <polygon points="18,32 12,44 26,34" fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        );
      case "rect":
        return (
          <svg viewBox="0 0 60 50" className="w-full h-full">
            <rect x="4" y="4" width="52" height="28" rx="3" fill={fill} stroke={stroke} strokeWidth="1.5" />
            <polygon points="14,32 10,46 24,34" fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        );
      case "cloud":
        return (
          <svg viewBox="0 0 60 50" className="w-full h-full">
            <path d="M10,24 Q8,14 16,12 Q18,4 28,6 Q34,2 40,8 Q50,8 50,18 Q56,20 52,26 Q50,32 42,30 L18,30 Q8,30 10,24Z" fill={fill} stroke={stroke} strokeWidth="1.5" />
            <circle cx="22" cy="38" r="3" fill={fill} stroke={stroke} strokeWidth="1.5" />
            <circle cx="16" cy="44" r="2" fill={fill} stroke={stroke} strokeWidth="1.5" />
          </svg>
        );
      case "spiky":
        return (
          <svg viewBox="0 0 60 50" className="w-full h-full">
            <polygon points="30,2 36,10 46,6 42,16 54,16 46,22 52,30 40,28 38,40 30,32 22,40 20,28 8,30 14,22 6,16 18,16 14,6 24,10" fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        );
      case "shout":
        return (
          <svg viewBox="0 0 60 50" className="w-full h-full">
            <polygon points="30,2 38,8 50,4 46,14 58,14 50,22 56,32 44,28 40,42 30,34 20,42 16,28 4,32 10,22 2,14 14,14 10,4 22,8" fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        );
      case "whisper":
        return (
          <svg viewBox="0 0 60 50" className="w-full h-full">
            <ellipse cx="30" cy="20" rx="26" ry="14" fill={fill} stroke={stroke} strokeWidth="1.5" strokeDasharray="3,2" />
            <polygon points="18,32 12,44 26,34" fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        );
      case "thought":
        return (
          <svg viewBox="0 0 60 50" className="w-full h-full">
            <ellipse cx="30" cy="18" rx="24" ry="13" fill={fill} stroke={stroke} strokeWidth="1.5" />
            <circle cx="22" cy="34" r="3.5" fill={fill} stroke={stroke} strokeWidth="1.5" />
            <circle cx="16" cy="42" r="2.5" fill={fill} stroke={stroke} strokeWidth="1.5" />
          </svg>
        );
      case "double":
        return (
          <svg viewBox="0 0 60 50" className="w-full h-full">
            <ellipse cx="30" cy="20" rx="26" ry="14" fill={fill} stroke={stroke} strokeWidth="1.5" />
            <ellipse cx="30" cy="20" rx="21" ry="10" fill="none" stroke={stroke} strokeWidth="1" />
            <polygon points="18,32 12,44 26,34" fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        );
      case "burst":
        return (
          <svg viewBox="0 0 60 50" className="w-full h-full">
            <polygon points="30,2 33,7 38,3 37,9 44,6 42,12 49,12 45,17 52,20 46,24 52,28 45,31 49,36 42,35 44,41 37,38 38,44 33,40 30,46 27,40 22,44 23,38 16,41 18,35 11,36 15,31 8,28 14,24 8,20 15,17 11,12 18,12 16,6 23,9 22,3 27,7" fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        );
      case "rounded-rect":
        return (
          <svg viewBox="0 0 60 50" className="w-full h-full">
            <rect x="4" y="4" width="52" height="28" rx="12" fill={fill} stroke={stroke} strokeWidth="1.5" />
            <polygon points="14,32 10,46 24,34" fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`w-full aspect-[6/5] flex items-center justify-center rounded-lg border transition-all ${
      selected ? "border-orange-500 bg-orange-500/10" : "border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#3a3a3a]"
    }`}>
      {renderShape()}
    </div>
  );
}

export default function BalloonPanel({
  selectedShape,
  onSelectShape,
  fontSize,
  onFontSizeChange,
  fontFamily,
  onFontFamilyChange,
  tailDir,
  onTailDirChange,
  borderColor,
  onBorderColorChange,
  bgColor,
  onBgColorChange,
  textColor,
  onTextColorChange,
  balloons,
  selectedBalloonId,
  updateBalloon,
}: BalloonPanelProps) {
  const selectedBalloon = selectedBalloonId ? balloons.find((b) => b.id === selectedBalloonId) : null;
  const effectiveShape = selectedBalloon?.shape ?? selectedShape;
  const effectiveTailDir = selectedBalloon?.tailDir ?? tailDir;
  const effectiveFontSize = selectedBalloon?.fontSize ?? fontSize;
  const effectiveFontFamily = selectedBalloon?.fontFamily ?? fontFamily;
  const effectiveBorderColor = selectedBalloon?.borderColor ?? borderColor;
  const effectiveBgColor = selectedBalloon?.bgColor ?? bgColor;
  const effectiveTextColor = selectedBalloon?.textColor ?? textColor;

  const handleSelectShape = (shape: BalloonShape) => {
    onSelectShape(shape);
    if (selectedBalloonId) {
      updateBalloon(selectedBalloonId, { shape });
    }
  };

  const handleTailDirChange = (dir: BalloonItem["tailDir"]) => {
    onTailDirChange(dir);
    if (selectedBalloonId) {
      updateBalloon(selectedBalloonId, { tailDir: dir });
    }
  };

  const handleFontSizeChange = (v: number) => {
    onFontSizeChange(v);
    if (selectedBalloonId) {
      updateBalloon(selectedBalloonId, { fontSize: v });
    }
  };

  const handleFontFamilyChange = (v: string) => {
    onFontFamilyChange(v);
    if (selectedBalloonId) {
      updateBalloon(selectedBalloonId, { fontFamily: v });
    }
  };

  const handleBorderColorChange = (v: string) => {
    onBorderColorChange(v);
    if (selectedBalloonId) {
      updateBalloon(selectedBalloonId, { borderColor: v });
    }
  };

  const handleBgColorChange = (v: string) => {
    onBgColorChange(v);
    if (selectedBalloonId) {
      updateBalloon(selectedBalloonId, { bgColor: v });
    }
  };

  const handleTextColorChange = (v: string) => {
    onTextColorChange(v);
    if (selectedBalloonId) {
      updateBalloon(selectedBalloonId, { textColor: v });
    }
  };

  return (
    <div className="flex flex-col gap-0 overflow-y-auto flex-1">
      {/* 말풍선 모양 */}
      <div className="p-3 border-b border-[#2a2a2a]">
        <p className="text-[9px] text-[#555] uppercase tracking-wider font-medium mb-2">말풍선 모양</p>
        <div className="grid grid-cols-3 gap-1.5">
          {BALLOON_SHAPES.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSelectShape(s.id)}
              title={s.label}
              className="flex flex-col items-center gap-1 cursor-pointer"
            >
              <BalloonShapePreview shape={s.id} selected={effectiveShape === s.id} />
              <span className={`text-[8px] whitespace-nowrap ${effectiveShape === s.id ? "text-orange-400" : "text-[#555]"}`}>
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 꼬리 방향 */}
      <div className="p-3 border-b border-[#2a2a2a]">
        <p className="text-[9px] text-[#555] uppercase tracking-wider font-medium mb-2">꼬리 방향</p>
        <div className="flex gap-1">
          {TAIL_DIRS.map((d) => (
            <button
              key={d.id}
              onClick={() => handleTailDirChange(d.id)}
              title={d.label}
              className={`flex-1 h-8 flex items-center justify-center rounded-lg border text-xs transition-all cursor-pointer ${
                effectiveTailDir === d.id
                  ? "border-orange-500 bg-orange-500/10 text-orange-400"
                  : "border-[#2a2a2a] bg-[#1a1a1a] text-[#555] hover:border-[#3a3a3a] hover:text-[#aaa]"
              }`}
            >
              <i className={d.icon} />
            </button>
          ))}
        </div>
      </div>

      {/* 폰트 설정 */}
      <div className="p-3 border-b border-[#2a2a2a]">
        <p className="text-[9px] text-[#555] uppercase tracking-wider font-medium mb-2">텍스트 설정</p>
        <div className="space-y-2">
          <div>
            <span className="text-[10px] text-[#888] block mb-1">폰트</span>
            <select
              value={effectiveFontFamily}
              onChange={(e) => handleFontFamilyChange(e.target.value)}
              className="w-full h-7 bg-[#1e1e1e] border border-[#2a2a2a] rounded text-[10px] text-[#ccc] px-2 outline-none cursor-pointer"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[#888]">크기</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleFontSizeChange(Math.max(8, effectiveFontSize - 1))}
                  className="w-5 h-5 flex items-center justify-center bg-[#1e1e1e] rounded text-[#888] hover:text-[#ccc] cursor-pointer text-xs"
                >
                  <i className="ri-subtract-line" />
                </button>
                <span className="text-xs text-[#ccc] w-6 text-center font-mono">{effectiveFontSize}</span>
                <button
                  onClick={() => handleFontSizeChange(Math.min(72, effectiveFontSize + 1))}
                  className="w-5 h-5 flex items-center justify-center bg-[#1e1e1e] rounded text-[#888] hover:text-[#ccc] cursor-pointer text-xs"
                >
                  <i className="ri-add-line" />
                </button>
              </div>
            </div>
            <input
              type="range" min={8} max={72} value={effectiveFontSize}
              onChange={(e) => handleFontSizeChange(Number(e.target.value))}
              className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
              style={{ background: `linear-gradient(to right, #f97316 ${(effectiveFontSize - 8) / 64 * 100}%, #2a2a2a ${(effectiveFontSize - 8) / 64 * 100}%)` }}
            />
          </div>
        </div>
      </div>

      {/* 색상 설정 */}
      <div className="p-3">
        <p className="text-[9px] text-[#555] uppercase tracking-wider font-medium mb-2">색상</p>
        <div className="space-y-2">
          {[
            { label: "테두리", value: effectiveBorderColor, onChange: handleBorderColorChange },
            { label: "배경", value: effectiveBgColor, onChange: handleBgColorChange },
            { label: "텍스트", value: effectiveTextColor, onChange: handleTextColorChange },
          ].map((c) => (
            <div key={c.label} className="flex items-center justify-between">
              <span className="text-[10px] text-[#888]">{c.label}</span>
              <div className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded border border-[#333]"
                  style={{ backgroundColor: c.value }}
                />
                <input
                  type="color"
                  value={c.value}
                  onChange={(e) => c.onChange(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                  title={c.label + " 색상 선택"}
                />
                <span className="text-[9px] text-[#555] font-mono">{c.value}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 사용 안내 */}
        <div className="mt-3 p-2.5 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
          <p className="text-[9px] text-[#555] leading-relaxed">
            <i className="ri-information-line text-orange-400 mr-1" />
            캔버스에서 클릭하면 말풍선이 배치됩니다. 배치 후 텍스트를 입력하세요.
          </p>
        </div>
      </div>
    </div>
  );
}
