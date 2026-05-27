import { useState } from "react";

interface ColorPanelProps {
  foregroundColor: string;
  backgroundColor: string;
  onForegroundChange: (color: string) => void;
  onBackgroundChange: (color: string) => void;
}

const SWATCHES = [
  "#000000", "#1a1a1a", "#333333", "#555555", "#888888", "#aaaaaa", "#cccccc", "#ffffff",
  "#ff0000", "#ff4444", "#ff8800", "#ffaa00", "#ffdd00", "#88cc00", "#00aa44", "#00cc88",
  "#00aaff", "#0066ff", "#4400ff", "#8800cc", "#cc0088", "#ff0066", "#ff6699", "#ffaacc",
  "#8b4513", "#a0522d", "#cd853f", "#deb887", "#f5deb3", "#ffe4b5", "#ffdab9", "#ffa07a",
];

export default function ColorPanel({
  foregroundColor,
  backgroundColor,
  onForegroundChange,
  onBackgroundChange,
}: ColorPanelProps) {
  const [activeColor, setActiveColor] = useState<"fg" | "bg">("fg");
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [lightness, setLightness] = useState(50);
  const [showPicker, setShowPicker] = useState(false);

  const hslToHex = (h: number, s: number, l: number): string => {
    const sl = s / 100;
    const ll = l / 100;
    const a = sl * Math.min(ll, 1 - ll);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = ll - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  const applyHSL = () => {
    const hex = hslToHex(hue, saturation, lightness);
    if (activeColor === "fg") onForegroundChange(hex);
    else onBackgroundChange(hex);
  };

  const handleSwatchClick = (color: string) => {
    if (activeColor === "fg") onForegroundChange(color);
    else onBackgroundChange(color);
  };

  return (
    <div className="flex flex-col bg-[#151515] border-t border-[#2a2a2a] shrink-0">
      {/* 색상 헤더 */}
      <div className="flex items-center justify-between px-3 h-8 border-b border-[#2a2a2a]">
        <span className="text-[10px] text-[#888] font-medium uppercase tracking-wider">색상</span>
        <button
          onClick={() => setShowPicker((v) => !v)}
          className="text-[10px] text-[#666] hover:text-[#aaa] cursor-pointer transition-colors"
        >
          <i className={showPicker ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} />
        </button>
      </div>

      {/* 전경/배경 색상 스왑 */}
      <div className="flex items-center justify-center py-2 gap-2 relative">
        {/* 배경색 */}
        <div
          onClick={() => setActiveColor("bg")}
          className={`absolute w-7 h-7 rounded border-2 cursor-pointer transition-all ${
            activeColor === "bg" ? "border-orange-500 z-10" : "border-[#444] z-0"
          }`}
          style={{ backgroundColor: backgroundColor, top: 14, left: 28 }}
          title="배경색"
        />
        {/* 전경색 */}
        <div
          onClick={() => setActiveColor("fg")}
          className={`relative w-8 h-8 rounded border-2 cursor-pointer transition-all ${
            activeColor === "fg" ? "border-orange-500 z-10" : "border-[#444] z-0"
          }`}
          style={{ backgroundColor: foregroundColor, marginRight: 8 }}
          title="전경색 (그리기 색상)"
        />
        {/* 스왑 버튼 */}
        <button
          onClick={() => {
            const tmp = foregroundColor;
            onForegroundChange(backgroundColor);
            onBackgroundChange(tmp);
          }}
          className="absolute top-1 right-6 w-4 h-4 flex items-center justify-center text-[#666] hover:text-[#aaa] cursor-pointer text-xs"
          title="색상 교체"
        >
          <i className="ri-arrow-left-right-line" />
        </button>
        {/* 기본값 */}
        <button
          onClick={() => { onForegroundChange("#000000"); onBackgroundChange("#ffffff"); }}
          className="absolute bottom-1 left-4 w-4 h-4 flex items-center justify-center text-[#666] hover:text-[#aaa] cursor-pointer text-[8px]"
          title="기본값으로"
        >
          <i className="ri-refresh-line" />
        </button>
      </div>

      {/* 색상 피커 (확장) */}
      {showPicker && (
        <div className="px-3 pb-2 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[9px] text-[#666] w-4">H</span>
            <input
              type="range" min={0} max={360} value={hue}
              onChange={(e) => { setHue(Number(e.target.value)); applyHSL(); }}
              className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer"
              style={{ background: "linear-gradient(to right, #f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" }}
            />
            <span className="text-[9px] text-[#666] w-6 text-right">{hue}</span>
          </div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[9px] text-[#666] w-4">S</span>
            <input
              type="range" min={0} max={100} value={saturation}
              onChange={(e) => { setSaturation(Number(e.target.value)); applyHSL(); }}
              className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer"
              style={{ background: `linear-gradient(to right, #888, hsl(${hue},100%,50%))` }}
            />
            <span className="text-[9px] text-[#666] w-6 text-right">{saturation}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-[#666] w-4">L</span>
            <input
              type="range" min={0} max={100} value={lightness}
              onChange={(e) => { setLightness(Number(e.target.value)); applyHSL(); }}
              className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer"
              style={{ background: `linear-gradient(to right, #000, hsl(${hue},${saturation}%,50%), #fff)` }}
            />
            <span className="text-[9px] text-[#666] w-6 text-right">{lightness}</span>
          </div>
          {/* HEX 입력 */}
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[9px] text-[#666]">#</span>
            <input
              type="text"
              value={(activeColor === "fg" ? foregroundColor : backgroundColor).replace("#", "")}
              onChange={(e) => {
                const val = "#" + e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
                if (val.length === 7) {
                  if (activeColor === "fg") onForegroundChange(val);
                  else onBackgroundChange(val);
                }
              }}
              className="flex-1 h-6 bg-[#111] border border-[#333] rounded px-1.5 text-[10px] text-[#ccc] outline-none focus:border-orange-500/50 font-mono"
            />
            <div
              className="w-6 h-6 rounded border border-[#333]"
              style={{ backgroundColor: activeColor === "fg" ? foregroundColor : backgroundColor }}
            />
          </div>
        </div>
      )}

      {/* 스와치 팔레트 */}
      <div className="px-2 py-2">
        <div className="grid grid-cols-8 gap-0.5">
          {SWATCHES.map((color) => (
            <button
              key={color}
              onClick={() => handleSwatchClick(color)}
              title={color}
              className="w-full aspect-square rounded-sm cursor-pointer hover:scale-110 transition-transform border border-[#333] hover:border-[#666]"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
