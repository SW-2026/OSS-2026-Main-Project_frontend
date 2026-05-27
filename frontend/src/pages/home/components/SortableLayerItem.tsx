import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Layer } from "@/hooks/useEditorState";

const layerTypeConfig: Record<string, { icon: string; color: string; bg: string }> = {
  background: { icon: "ri-landscape-line", color: "text-sky-400", bg: "bg-sky-500/10" },
  character: { icon: "ri-user-line", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  effect: { icon: "ri-flashlight-line", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  dialogue: { icon: "ri-chat-1-line", color: "text-pink-400", bg: "bg-pink-500/10" },
  sketch: { icon: "ri-pencil-line", color: "text-orange-300", bg: "bg-orange-500/10" },
  lineart: { icon: "ri-pen-nib-line", color: "text-white", bg: "bg-white/10" },
  color: { icon: "ri-palette-line", color: "text-rose-400", bg: "bg-rose-500/10" },
};

interface SortableLayerItemProps {
  layer: Layer;
  isSelected: boolean;
  onSelect: () => void;
  onToggleVisible: () => void;
  onToggleLocked: () => void;
}

export default function SortableLayerItem({
  layer,
  isSelected,
  onSelect,
  onToggleVisible,
  onToggleLocked,
}: SortableLayerItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: layer.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const cfg = layerTypeConfig[layer.type] ?? layerTypeConfig.character;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`flex items-center gap-1.5 px-2 py-2 cursor-pointer transition-colors group select-none ${
        isSelected
          ? "bg-orange-500/10 border-l-2 border-orange-500"
          : "border-l-2 border-transparent hover:bg-[#1e1e1e]"
      } ${isDragging ? "opacity-50 bg-[#2a2a2a] z-50" : ""}`}
    >
      {/* 드래그 핸들 */}
      <div
        {...attributes}
        {...listeners}
        className="w-4 h-6 flex items-center justify-center text-[#555] hover:text-[#888] cursor-grab active:cursor-grabbing shrink-0"
      >
        <i className="ri-draggable text-xs" />
      </div>

      {/* 레이어 타입 아이콘 */}
      <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 overflow-hidden ${!layer.imageUrl ? cfg.bg + " " + cfg.color : ""}`}>
        {layer.imageUrl ? (
          <img src={layer.imageUrl} alt={layer.name} className="w-full h-full object-cover" />
        ) : (
          <i className={cfg.icon + " text-xs"} />
        )}
      </div>

      {/* 레이어 이름 */}
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] font-medium truncate ${isSelected ? "text-[#eee]" : "text-[#999]"}`}>
          {layer.name}
        </p>
        <p className="text-[8px] text-[#555]">{layer.opacity}% · {layer.blendMode}</p>
      </div>

      {/* 컨트롤 */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleVisible(); }}
          className={`w-5 h-5 flex items-center justify-center rounded cursor-pointer transition-colors text-xs ${
            layer.visible ? "text-[#888] hover:text-[#ccc]" : "text-[#333] hover:text-[#666]"
          }`}
        >
          <i className={layer.visible ? "ri-eye-line" : "ri-eye-off-line"} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleLocked(); }}
          className={`w-5 h-5 flex items-center justify-center rounded cursor-pointer transition-colors text-xs ${
            layer.locked ? "text-orange-400" : "text-[#333] hover:text-[#666]"
          }`}
        >
          <i className={layer.locked ? "ri-lock-line" : "ri-lock-unlock-line"} />
        </button>
      </div>
    </div>
  );
}