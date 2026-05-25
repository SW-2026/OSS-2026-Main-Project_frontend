import { useState } from "react";
import type { DrawingTool } from "@/hooks/useEditorState";

interface DrawingToolbarProps {
  activeTool: DrawingTool;
  onSelectTool: (tool: DrawingTool) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  opacity: number;
  onOpacityChange: (v: number) => void;
}

const toolGroups: { tools: { id: DrawingTool; icon: string; label: string; shortcut: string }[] }[] = [
  {
    tools: [
      { id: "select", icon: "ri-cursor-line", label: "선택 (V)", shortcut: "V" },
      { id: "move", icon: "ri-drag-move-line", label: "이동 (M)", shortcut: "M" },
    ],
  },
  {
    tools: [
      { id: "stroke-select", icon: "ri-cursor-fill", label: "선 선택/이동 (S)", shortcut: "S" },
      { id: "stroke-eraser", icon: "ri-scissors-cut-line", label: "선 지우개 (X)", shortcut: "X" },
    ],
  },
  {
    tools: [
      { id: "pen", icon: "ri-pen-nib-line", label: "펜 (P)", shortcut: "P" },
      { id: "brush", icon: "ri-brush-line", label: "브러시 (B)", shortcut: "B" },
      { id: "pencil", icon: "ri-pencil-line", label: "연필 (N)", shortcut: "N" },
      { id: "marker", icon: "ri-mark-pen-line", label: "마커 (K)", shortcut: "K" },
    ],
  },
  {
    tools: [
      { id: "eraser", icon: "ri-eraser-line", label: "지우개 (E)", shortcut: "E" },
      { id: "fill", icon: "ri-paint-fill", label: "채우기 (G)", shortcut: "G" },
    ],
  },
  {
    tools: [
      { id: "line", icon: "ri-subtract-line", label: "직선 (L)", shortcut: "L" },
      { id: "rect", icon: "ri-rectangle-line", label: "사각형 (U)", shortcut: "U" },
      { id: "ellipse", icon: "ri-circle-line", label: "원형 (O)", shortcut: "O" },
    ],
  },
  {
    tools: [
      { id: "zoom", icon: "ri-zoom-in-line", label: "확대/축소 (Z)", shortcut: "Z" },
      { id: "hand", icon: "ri-drag-move-2-line", label: "손 도구 (H)", shortcut: "H" },
    ],
  },
];

export default function DrawingToolbar({
  activeTool,
  onSelectTool,
  brushSize,
  onBrushSizeChange,
  opacity,
  onOpacityChange,
}: DrawingToolbarProps) {
  const [showSizePopup, setShowSizePopup] = useState(false);

  return (
    <div className="w-12 bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col items-center shrink-0 h-full">
      {/* 도구 그룹들 - 스크롤 가능한 중간 영역 */}
      <div className="flex-1 overflow-y-auto min-h-0 w-full flex flex-col items-center py-2 gap-0.5">
        {toolGroups.map((group, gi) => (
          <div key={gi} className="flex flex-col items-center w-full">
            {group.tools.map((tool) => (
              <button
                key={tool.id}
                title={tool.label}
                onClick={() => onSelectTool(tool.id)}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all cursor-pointer mb-0.5 ${
                  activeTool === tool.id
                    ? "bg-orange-500 text-white shadow-[0_0_8px_rgba(249,115,22,0.5)]"
                    : "text-[#888] hover:bg-[#2a2a2a] hover:text-[#ccc]"
                }`}
              >
                <i className={`${tool.icon} text-base`} />
              </button>
            ))}
            {gi < toolGroups.length - 1 && (
              <div className="w-6 h-px bg-[#2a2a2a] my-1.5" />
            )}
          </div>
        ))}

        {/* 브러시 크기 */}
        <div className="w-6 h-px bg-[#2a2a2a] my-1.5" />
      </div>

      {/* 맨 아래 브러시 크기 버튼 - 항상 고정 표시 */}
      <div className="relative w-full flex flex-col items-center py-2">
        <button
          title={`브러시 크기: ${brushSize}px`}
          onClick={() => setShowSizePopup((v) => !v)}
          className="w-9 h-9 flex flex-col items-center justify-center gap-0.5 rounded-lg hover:bg-[#2a2a2a] cursor-pointer transition-colors"
        >
          <div
            className="rounded-full bg-[#ccc]"
            style={{ width: Math.min(brushSize, 20), height: Math.min(brushSize, 20) }}
          />
          <span className="text-[8px] text-[#666]">{brushSize}</span>
        </button>
        {showSizePopup && (
        <>
          {/* 오버레이: 밖 클릭하면 닫힘 */}
          <div
            className="fixed inset-0 z-[60]"
            onClick={() => setShowSizePopup(false)}
          />
          {/* 팝업 본체 */}
          <div className="absolute left-12 bottom-0 w-52 bg-[#1e1e1e] border border-[#333] rounded-xl p-4 shadow-2xl z-[70]">
            {/* 화살표 */}
            <div
              className="absolute left-[-6px] bottom-3 w-3 h-3 bg-[#1e1e1e] border-l border-b border-[#333] rotate-45"
            />
            <p className="text-[10px] text-[#888] mb-2 font-medium">브러시 크기</p>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="range"
                min={1}
                max={200}
                value={brushSize}
                onChange={(e) => onBrushSizeChange(Number(e.target.value))}
                className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #f97316 ${brushSize / 2}%, #2a2a2a ${brushSize / 2}%)`,
                }}
              />
              <span className="text-xs text-[#ccc] w-8 text-right">{brushSize}px</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[1, 3, 5, 10, 20, 50, 100].map((s) => (
                <button
                  key={s}
                  onClick={() => { onBrushSizeChange(s); setShowSizePopup(false); }}
                  className={`px-2 py-0.5 rounded text-[10px] cursor-pointer transition-colors whitespace-nowrap ${
                    brushSize === s ? "bg-orange-500 text-white" : "bg-[#2a2a2a] text-[#888] hover:bg-[#333]"
                  }`}
                >
                  {s}px
                </button>
              ))}
            </div>
            <p className="text-[10px] text-[#888] mt-3 mb-2 font-medium">불투명도</p>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={100}
                value={opacity}
                onChange={(e) => onOpacityChange(Number(e.target.value))}
                className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #f97316 ${opacity}%, #2a2a2a ${opacity}%)`,
                }}
              />
              <span className="text-xs text-[#ccc] w-8 text-right">{opacity}%</span>
            </div>
          </div>
        </>
        )}
      </div>
    </div>
  );
}
