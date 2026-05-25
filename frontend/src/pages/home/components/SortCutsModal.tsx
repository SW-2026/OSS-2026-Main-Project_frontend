import { useState, useEffect } from "react";
import type { Cut } from "../../../hooks/useEditorState";

interface SortCutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cuts: Cut[];
  onReorder: (orderedIds: string[]) => void;
}

export default function SortCutsModal({
  isOpen,
  onClose,
  cuts,
  onReorder,
}: SortCutsModalProps) {
  const [ordered, setOrdered] = useState<Cut[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      // 에피소드별 컷, index 기준 정렬
      const sorted = [...cuts].sort((a, b) => a.index - b.index);
      setOrdered(sorted);
    }
  }, [isOpen, cuts]);

  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === targetIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const newOrdered = [...ordered];
    const [moved] = newOrdered.splice(dragIdx, 1);
    newOrdered.splice(targetIdx, 0, moved);
    setOrdered(newOrdered);
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleSave = () => {
    onReorder(ordered.map((c) => c.id));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[#181818] border border-[#2a2a2a] rounded-xl w-[480px] max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a]">
          <h3 className="text-white text-sm font-medium">컷 순서 정렬</h3>
          <button
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-[#888] hover:text-white transition-colors cursor-pointer"
            onClick={onClose}
          >
            <i className="ri-close-line" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1.5">
          {ordered.length === 0 ? (
            <p className="text-[#555] text-xs text-center py-8">컷이 없습니다</p>
          ) : (
            ordered.map((cut, idx) => (
              <div
                key={cut.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all cursor-move select-none ${
                  dragIdx === idx
                    ? "opacity-40 border-dashed border-orange-500/40"
                    : dragOverIdx === idx
                    ? "border-orange-500/60 bg-orange-500/5"
                    : "border-[#2a2a2a] hover:border-[#3a3a3a] hover:bg-[#1e1e1e]"
                }`}
              >
                {/* 순서 번호 */}
                <span className="w-6 text-center text-[#555] text-xs font-mono shrink-0">
                  {idx + 1}
                </span>

                {/* 썸네일 */}
                <div className="w-10 h-14 rounded overflow-hidden bg-[#222] shrink-0">
                  {cut.thumbnail ? (
                    <img src={cut.thumbnail} alt="" className="w-full h-full object-cover" draggable={false} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <i className="ri-image-line text-[#333] text-xs" />
                    </div>
                  )}
                </div>

                {/* 이름 & 상태 */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs truncate">{cut.label}</p>
                  <p className="text-[#555] text-[10px]">
                    {cut.isGenerated ? "생성 완료" : "생성 전"}
                  </p>
                </div>

                {/* 드래그 핸들 아이콘 */}
                <div className="w-6 h-6 flex items-center justify-center text-[#444]">
                  <i className="ri-draggable text-sm" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* 하단 액션 */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#2a2a2a]">
          <button
            onClick={onClose}
            className="px-4 h-8 rounded-md text-xs text-[#888] hover:text-white hover:bg-white/5 transition-colors cursor-pointer whitespace-nowrap"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-4 h-8 rounded-md text-xs bg-orange-500 hover:bg-orange-400 text-white font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}