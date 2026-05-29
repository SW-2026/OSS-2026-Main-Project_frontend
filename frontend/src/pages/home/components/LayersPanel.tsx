import { useState, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Layer, LayerType } from "@/hooks/useEditorState";
import type { BalloonItem } from "./BalloonPanel";
import SortableLayerItem from "./SortableLayerItem";

interface LayersPanelProps {
  layers: Layer[];
  selectedLayerId: string;
  onSelectLayer: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onUpdateOpacity: (id: string, v: number) => void;
  onUpdateBlendMode: (id: string, mode: string) => void;
  onAddLayer: (type: LayerType, name: string) => void;
  onDeleteLayer: (id: string) => void;
  onReorderLayers: (orderedIds: string[]) => void;
  balloons?: BalloonItem[];
}

const BLEND_MODES = ["normal", "multiply", "screen", "overlay", "soft-light", "hard-light", "color-dodge", "color-burn", "darken", "lighten", "difference", "exclusion"];

export default function LayersPanel({
  layers,
  selectedLayerId,
  onSelectLayer,
  onToggleVisible,
  onToggleLocked,
  onUpdateOpacity,
  onUpdateBlendMode,
  onAddLayer,
  onDeleteLayer,
  onReorderLayers,
  balloons,
}: LayersPanelProps) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  // 사용자 보기: 맨 위가 z-index 가장 높음 → layers를 reverse해서 표시
  const reversedLayers = [...layers].reverse();
  const selectedLayer = layers.find((l) => l.id === selectedLayerId);

  // 레이어별 말풍선 개수 집계
  const balloonCounts = useMemo(() => {
    if (!balloons || balloons.length === 0) return {} as Record<string, number>;
    const counts: Record<string, number> = {};
    balloons.forEach((b) => {
      counts[b.layerId] = (counts[b.layerId] || 0) + 1;
    });
    return counts;
  }, [balloons]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = reversedLayers.findIndex((l) => l.id === active.id);
    const newIndex = reversedLayers.findIndex((l) => l.id === over.id);

    const newReversed = [...reversedLayers];
    const [moved] = newReversed.splice(oldIndex, 1);
    newReversed.splice(newIndex, 0, moved);

    // reversed 순서를 다시 뒤집어서 원본 layers 순서로 전달
    onReorderLayers(newReversed.reverse().map((l) => l.id));
  };

  const newLayerTypes: { type: LayerType; label: string }[] = [
    { type: "lineart", label: "선화 레이어" },
    { type: "sketch", label: "스케치 레이어" },
    { type: "color", label: "채색 레이어" },
    { type: "character", label: "캐릭터 레이어" },
    { type: "dialogue", label: "대사 레이어" },
    { type: "effect", label: "효과 레이어" },
    { type: "background", label: "배경 레이어" },
  ];

  return (
    <aside className="w-56 bg-[#151515] border-l border-[#2a2a2a] flex flex-col h-full overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 h-9 border-b border-[#2a2a2a] shrink-0">
        <span className="text-[11px] text-[#ccc] font-semibold tracking-wide">레이어</span>
        <div className="flex items-center gap-0.5">
          <div className="relative">
            <button
              onClick={() => setAddMenuOpen((v) => !v)}
              title="레이어 추가"
              className="w-6 h-6 flex items-center justify-center text-[#666] hover:text-orange-400 cursor-pointer rounded hover:bg-[#2a2a2a] transition-colors"
            >
              <i className="ri-add-line text-sm" />
            </button>
            {addMenuOpen && (
              <div className="absolute right-0 top-7 w-44 bg-[#1e1e1e] border border-[#333] rounded-xl py-1 shadow-2xl z-50">
                {newLayerTypes.map((lt) => (
                  <button
                    key={lt.type}
                    onClick={() => { onAddLayer(lt.type, lt.label.replace(" 레이어", "")); setAddMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#ccc] hover:bg-[#2a2a2a] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {lt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            title="레이어 삭제"
            onClick={() => onDeleteLayer(selectedLayerId)}
            className="w-6 h-6 flex items-center justify-center text-[#666] hover:text-red-400 cursor-pointer rounded hover:bg-[#2a2a2a] transition-colors"
          >
            <i className="ri-delete-bin-line text-sm" />
          </button>
        </div>
      </div>

      {/* 레이어 목록 (드래그 정렬) */}
      <div className="flex-1 overflow-y-auto min-h-0 py-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={reversedLayers.map((l) => l.id)}
            strategy={verticalListSortingStrategy}
          >
            {reversedLayers.map((layer) => (
              <SortableLayerItem
                key={layer.id}
                layer={layer}
                isSelected={selectedLayerId === layer.id}
                onSelect={() => onSelectLayer(layer.id)}
                onToggleVisible={() => onToggleVisible(layer.id)}
                onToggleLocked={() => onToggleLocked(layer.id)}
                balloonCount={balloonCounts[layer.id] ?? 0}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* 레이어 속성 */}
      {selectedLayer && (
        <div className="border-t border-[#2a2a2a] p-3 shrink-0 bg-[#111]">
          <p className="text-[9px] text-[#555] font-medium uppercase tracking-wider mb-2">레이어 속성</p>

          {/* 불투명도 */}
          <div className="mb-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[#888]">불투명도</span>
              <span className="text-[10px] text-[#ccc] font-medium">{selectedLayer.opacity}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={selectedLayer.opacity}
              onChange={(e) => onUpdateOpacity(selectedLayer.id, Number(e.target.value))}
              className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
              style={{
                background: `linear-gradient(to right, #f97316 ${selectedLayer.opacity}%, #2a2a2a ${selectedLayer.opacity}%)`,
              }}
            />
          </div>

          {/* 블렌드 모드 */}
          <div className="mb-2.5">
            <span className="text-[10px] text-[#888] block mb-1">블렌드 모드</span>
            <select
              value={selectedLayer.blendMode}
              onChange={(e) => onUpdateBlendMode(selectedLayer.id, e.target.value)}
              className="w-full h-7 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md text-[10px] text-[#ccc] px-2 cursor-pointer outline-none focus:border-orange-500/50 transition-colors appearance-none"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23555'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center", paddingRight: "22px" }}
            >
              {BLEND_MODES.map((mode) => (
                <option key={mode} value={mode} className="bg-[#1a1a1a] text-[#ccc]">
                  {mode}
                </option>
              ))}
            </select>
          </div>


        </div>
      )}
    </aside>
  );
}