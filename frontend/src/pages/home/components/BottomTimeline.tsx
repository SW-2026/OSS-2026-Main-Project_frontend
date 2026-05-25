import { useRef, useMemo, useState, useCallback } from "react";
import type { Cut, Episode } from "../../../hooks/useEditorState";

interface BottomTimelineProps {
  cuts: Cut[];
  episodes: Episode[];
  activeCutId: string;
  activeEpisodeId: string;
  onSelectCut: (id: string) => void;
  onSelectEpisode: (id: string) => void;
  onAddEpisode: (title?: string) => void;
  onRenameEpisode: (id: string, title: string) => void;
  onDeleteEpisode: (id: string) => void;
  onAddCut: () => void;
  onPreview: () => void;
  onSortCuts: () => void;
}

export default function BottomTimeline({
  cuts,
  episodes,
  activeCutId,
  activeEpisodeId,
  onSelectCut,
  onSelectEpisode,
  onAddEpisode,
  onRenameEpisode,
  onDeleteEpisode,
  onAddCut,
  onPreview,
  onSortCuts,
}: BottomTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 에피소드 추가 시 이름 입력 모달
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  // 에피소드 컨텍스트 메뉴
  const [ctxMenu, setCtxMenu] = useState<{ epId: string; x: number; y: number } | null>(null);

  // 에피소드 삭제 확인 모달
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // 에피소드 이름 인라인 편집
  const [editingEpId, setEditingEpId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const episodeCuts = useMemo(
    () => cuts.filter((c) => c.episodeId === activeEpisodeId),
    [cuts, activeEpisodeId]
  );

  const handleOpenAddModal = () => {
    setAddTitle(`에피소드 ${episodes.length + 1}`);
    setAddModalOpen(true);
    setTimeout(() => {
      addInputRef.current?.focus();
      addInputRef.current?.select();
    }, 30);
  };

  const handleConfirmAdd = useCallback(() => {
    const title = addTitle.trim() || `에피소드 ${episodes.length + 1}`;
    onAddEpisode(title);
    setAddModalOpen(false);
    setAddTitle("");
  }, [addTitle, episodes.length, onAddEpisode]);

  const handleStartRename = (ep: Episode) => {
    setEditingEpId(ep.id);
    setEditingTitle(ep.title);
    setTimeout(() => {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }, 30);
  };

  const handleConfirmRename = useCallback(() => {
    if (!editingEpId) return;
    const title = editingTitle.trim();
    if (title) onRenameEpisode(editingEpId, title);
    setEditingEpId(null);
    setEditingTitle("");
  }, [editingEpId, editingTitle, onRenameEpisode]);

  const handleContextMenu = (e: React.MouseEvent, epId: string) => {
    e.preventDefault();
    setCtxMenu({ epId, x: e.clientX, y: e.clientY });
  };

  const handleDeleteEpisode = (id: string) => {
    setCtxMenu(null);
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmId) onDeleteEpisode(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  return (
    <section
      className="bg-[#111] border-t border-[#2a2a2a] flex flex-col shrink-0 relative"
      style={{ height: 200 }}
      onClick={() => setCtxMenu(null)}
    >

      {/* 컨텍스트 메뉴 */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setCtxMenu(null)} />
          <div
            className="fixed z-[100] bg-[#1e1e1e] border border-[#333] rounded-xl py-1 shadow-2xl w-36"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
          >
            <button
              onClick={() => {
                const ep = episodes.find((e) => e.id === ctxMenu.epId);
                if (ep) { setCtxMenu(null); handleStartRename(ep); }
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#ccc] hover:bg-[#2a2a2a] cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-edit-line text-[#888]" /> 이름 변경
            </button>
            {episodes.length > 1 && (
              <button
                onClick={() => handleDeleteEpisode(ctxMenu.epId)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors whitespace-nowrap"
              >
                <i className="ri-delete-bin-line" /> 삭제
              </button>
            )}
          </div>
        </>
      )}

      {/* 삭제 확인 모달 */}
      {deleteConfirmId && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-5 w-72 shadow-2xl">
            <p className="text-xs text-[#ccc] font-semibold mb-1">에피소드 삭제</p>
            <p className="text-[11px] text-[#888] mb-4">
              <span className="text-orange-400">{episodes.find((e) => e.id === deleteConfirmId)?.title}</span>을(를) 삭제하면 해당 에피소드의 모든 컷도 함께 삭제됩니다.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleConfirmDelete}
                className="flex-1 h-8 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg cursor-pointer transition-colors whitespace-nowrap"
              >
                삭제
              </button>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 h-8 bg-[#2a2a2a] hover:bg-[#333] text-[#aaa] text-xs rounded-lg cursor-pointer transition-colors whitespace-nowrap"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 에피소드 추가 이름 입력 모달 */}
      {addModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-5 w-72 shadow-2xl">
            <p className="text-xs text-[#ccc] font-semibold mb-3">새 에피소드 이름</p>
            <input
              ref={addInputRef}
              type="text"
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmAdd();
                if (e.key === "Escape") { setAddModalOpen(false); setAddTitle(""); }
              }}
              className="w-full h-8 bg-[#111] border border-[#333] rounded-lg px-3 text-sm text-[#eee] outline-none focus:border-orange-500 transition-colors"
              placeholder="에피소드 이름 입력..."
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleConfirmAdd}
                className="flex-1 h-8 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg cursor-pointer transition-colors whitespace-nowrap"
              >
                추가
              </button>
              <button
                onClick={() => { setAddModalOpen(false); setAddTitle(""); }}
                className="flex-1 h-8 bg-[#2a2a2a] hover:bg-[#333] text-[#aaa] text-xs rounded-lg cursor-pointer transition-colors whitespace-nowrap"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 에피소드 탭 */}
      <div className="flex items-center border-b border-[#2a2a2a] h-8 px-2 gap-0.5 shrink-0 overflow-x-auto">
        <i className="ri-film-line text-[#555] text-sm mr-1 shrink-0" />
        {episodes.map((ep) => (
          <div key={ep.id} className="relative flex items-center shrink-0">
            {editingEpId === ep.id ? (
              /* 인라인 이름 편집 */
              <input
                ref={editInputRef}
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmRename();
                  if (e.key === "Escape") { setEditingEpId(null); setEditingTitle(""); }
                }}
                onBlur={handleConfirmRename}
                className="h-6 px-2 bg-[#111] border border-orange-500 rounded text-[10px] text-[#eee] outline-none w-28"
              />
            ) : (
              <button
                onClick={() => onSelectEpisode(ep.id)}
                onDoubleClick={() => handleStartRename(ep)}
                onContextMenu={(e) => handleContextMenu(e, ep.id)}
                title="더블클릭: 이름 변경 · 우클릭: 메뉴"
                className={`px-3 h-6 rounded text-[10px] transition-colors cursor-pointer whitespace-nowrap group flex items-center gap-1 ${
                  ep.id === activeEpisodeId
                    ? "bg-orange-500/20 text-orange-400 font-medium"
                    : "text-[#666] hover:text-[#aaa] hover:bg-[#1e1e1e]"
                }`}
              >
                {ep.title}
                {/* 이름 변경 아이콘 (호버 시 표시) */}
                <i
                  className="ri-edit-line text-[9px] opacity-0 group-hover:opacity-60 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); handleStartRename(ep); }}
                />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={handleOpenAddModal}
          className="px-2 h-6 rounded text-[#555] hover:text-[#888] hover:bg-[#1e1e1e] transition-colors cursor-pointer text-xs flex items-center gap-1 whitespace-nowrap ml-1"
        >
          <i className="ri-add-line" />
          에피소드 추가
        </button>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-[#555]">
            {episodeCuts.filter((c) => c.isGenerated).length}/{Math.max(0, episodeCuts.length - 1)} 컷 생성됨
          </span>
        </div>
      </div>

      {/* 컷 썸네일 스트립 */}
      <div className="flex-1 overflow-y-hidden">
        <div
          ref={scrollRef}
          className="flex items-center gap-2 h-full overflow-x-auto px-3 py-2 scroll-smooth"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}
        >
          {episodeCuts.map((cut) => (
            <button
              key={cut.id}
              onClick={() => onSelectCut(cut.id)}
              className={`shrink-0 flex flex-col items-center gap-1 cursor-pointer group transition-all ${
                cut.id === activeCutId ? "scale-105" : "hover:scale-102"
              }`}
            >
              <div
                className={`relative rounded-lg overflow-hidden border-2 transition-colors ${
                  cut.id === activeCutId
                    ? "border-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.4)]"
                    : "border-[#2a2a2a] group-hover:border-[#444]"
                }`}
                style={{ width: 72, height: 100 }}
              >
                {cut.thumbnail ? (
                  <img src={cut.thumbnail} alt={cut.label} className="w-full h-full object-cover" draggable={false} />
                ) : (
                  <div className="w-full h-full bg-[#1a1a1a] flex flex-col items-center justify-center gap-1">
                    {cut.isGenerated === false && cut.index < 6 ? (
                      <>
                        <i className="ri-sparkling-line text-[#444] text-xl" />
                        <span className="text-[8px] text-[#444]">생성 전</span>
                      </>
                    ) : (
                      <>
                        <i className="ri-add-line text-[#333] text-2xl" />
                        <span className="text-[8px] text-[#333]">컷 추가</span>
                      </>
                    )}
                  </div>
                )}
                {cut.id === activeCutId && (
                  <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-orange-500" />
                )}
                {cut.isGenerated && (
                  <div className="absolute bottom-1 left-1 w-4 h-4 rounded-full bg-emerald-500/90 flex items-center justify-center">
                    <i className="ri-check-line text-white text-[8px]" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <i className="ri-edit-line text-white text-sm" />
                </div>
              </div>
              <span className={`text-[9px] whitespace-nowrap ${cut.id === activeCutId ? "text-orange-400 font-bold" : "text-[#555]"}`}>
                {cut.label}
              </span>
            </button>
          ))}

          <div className="shrink-0 flex flex-col items-center justify-center h-full px-2">
            <div className="w-px h-14 bg-[#2a2a2a]" />
          </div>

          <button
            onClick={onAddCut}
            className="shrink-0 flex flex-col items-center gap-1 cursor-pointer group"
          >
            <div
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#2a2a2a] group-hover:border-orange-500/40 transition-colors bg-[#111] group-hover:bg-orange-500/5"
              style={{ width: 72, height: 100 }}
            >
              <i className="ri-add-line text-[#333] group-hover:text-orange-500/60 text-2xl transition-colors" />
            </div>
            <span className="text-[9px] text-[#444] group-hover:text-[#666] transition-colors whitespace-nowrap">새 컷</span>
          </button>
        </div>
      </div>

      {/* 하단 상태 바 */}
      <div className="flex items-center justify-between px-4 h-7 border-t border-[#1e1e1e] shrink-0">
        <div className="flex items-center gap-4 text-[10px] text-[#555]">
          <span className="whitespace-nowrap">
            <i className="ri-scissors-cut-line mr-1" />
            {cuts.filter((c) => c.isGenerated).length}컷 완성
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onPreview}
            className="flex items-center gap-1 text-[10px] text-[#555] hover:text-[#888] cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-play-line" />
            미리보기
          </button>
          <button
            onClick={onSortCuts}
            className="flex items-center gap-1 text-[10px] text-[#555] hover:text-[#888] cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-sort-asc" />
            컷 정렬
          </button>
        </div>
      </div>
    </section>
  );
}