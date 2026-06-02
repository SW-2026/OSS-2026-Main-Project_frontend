import { useCallback, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useEditorState } from "@/hooks/useEditorState";
import { useVectorize } from "@/hooks/useVectorize";
import EditorHeader from "./components/EditorHeader";
import LeftPanel from "./components/LeftPanel";
import DrawingCanvas from "./components/DrawingCanvas";
import type { DrawingCanvasHandle } from "./components/DrawingCanvas";
import DrawingToolbar from "./components/DrawingToolbar";
import ColorPanel from "./components/ColorPanel";
import LayersPanel from "./components/LayersPanel";
import BottomTimeline from "./components/BottomTimeline";
import ExportModal from "./components/ExportModal";
import ProjectExportModal from "./components/ProjectExportModal";
import VectorEditor from "./components/VectorEditor";
import WebtoonCutEditor from "./components/WebtoonCutEditor";
import PreviewModal from "./components/PreviewModal";
import SortCutsModal from "./components/SortCutsModal";
import ScrollEditView from "./components/ScrollEditView";
import type { AIGeneratedImage } from "./components/ImagePanel";

export default function WebtoonEditor() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("projectId");
  const editor = useEditorState(projectId);
  const vectorize = useVectorize();

  // 1컷 생성 COMPLETED 자동 흐름: 현재 컷 낙서 저장 → cuts 갱신(새 컷 포함) → 새 컷 활성화
  const handleSingleCutComplete = useCallback(
    async (newPanelId: number, episodeId: number) => {
      await editor.handleSave();
      await editor.refreshCutsForEpisode(episodeId);
      editor.setActiveCut(String(newPanelId));
    },
    [editor]
  );
  const canvasHandleRef = useRef<DrawingCanvasHandle>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportInitialFormat, setExportInitialFormat] = useState<"png" | "jpeg" | "pdf">("png");
  const [projectExportOpen, setProjectExportOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sortCutsOpen, setSortCutsOpen] = useState(false);
  const [scrollEditMode, setScrollEditMode] = useState(false);
  const [showRuler, setShowRuler] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const handleExport = (format: "png" | "jpeg" | "pdf") => {
    setExportInitialFormat(format);
    setExportModalOpen(true);
  };

  const [cutEditorImage, setCutEditorImage] = useState<AIGeneratedImage | null>(null);

  const handleVectorize = (img: AIGeneratedImage) => {
    vectorize.vectorizeImage(img.url);
  };

  const handleEditCut = (img: AIGeneratedImage) => {
    setCutEditorImage(img);
  };

  const handleCutEditorApply = (offscreenCanvas: HTMLCanvasElement) => {
    // 캔버스 이미지로 등록해서 이동/크기조절/삭제 가능하게
    const dataUrl = offscreenCanvas.toDataURL("image/png");
    const cw = 800;
    const ch = 1100;
    const iw = offscreenCanvas.width;
    const ih = offscreenCanvas.height;
    const fitScale = Math.min(cw / iw, ch / ih, 1);
    const drawW = Math.round(iw * fitScale);
    const drawH = Math.round(ih * fitScale);
    const x = Math.round((cw - drawW) / 2);
    const y = Math.round((ch - drawH) / 2);
    editor.addCanvasImage(dataUrl, x, y, drawW, drawH);
  };

  const handleApplyVectorToCanvas = () => {
    // SVG를 data URL로 변환해서 canvasImage로 등록 (이동/크기조절 가능)
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vectorize.vectorSize.width} ${vectorize.vectorSize.height}" width="${vectorize.vectorSize.width}" height="${vectorize.vectorSize.height}">
      ${vectorize.vectorPaths.map((p) => `<path d="${p.d}" stroke="${p.strokeColor}" stroke-width="${p.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${p.opacity / 100}"/>`).join("")}
    </svg>`;

    // SVG를 data URL로 인코딩 (저장/로드 시에도 유지됨)
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;

    // 캔버스 중앙에 배치될 크기 계산
    const cw = 800;
    const ch = 1100;
    const vw = vectorize.vectorSize.width;
    const vh = vectorize.vectorSize.height;
    const fitScale = Math.min(cw / vw, ch / vh, 1);
    const drawW = Math.round(vw * fitScale);
    const drawH = Math.round(vh * fitScale);
    const x = Math.round((cw - drawW) / 2);
    const y = Math.round((ch - drawH) / 2);

    // canvasImage로 등록 → 캔버스 위에서 드래그/리사이즈 가능
    editor.addCanvasImage(dataUrl, x, y, drawW, drawH);
    vectorize.closeVectorEditor();
  };

  return (
    <div className="flex flex-col w-screen h-screen bg-[#0d0d0d] overflow-hidden" style={{ fontFamily: "'Inter', 'Noto Sans KR', sans-serif" }}>
      <EditorHeader
        saveStatus={editor.saveStatus}
        onSave={editor.handleSave}
        onExport={handleExport}
        onProjectExport={() => setProjectExportOpen(true)}
        onUndo={editor.undo}
        onRedo={editor.redo}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        scrollEditMode={scrollEditMode}
        onToggleScrollEditMode={() => setScrollEditMode((v) => !v)}
        zoom={editor.zoom}
        onZoomIn={editor.zoomIn}
        onZoomOut={editor.zoomOut}
        onResetZoom={editor.resetZoom}
        showRuler={showRuler}
        onToggleRuler={() => setShowRuler((v) => !v)}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid((v) => !v)}
        showGuide={showGuide}
        onToggleGuide={() => setShowGuide((v) => !v)}
      />

      <div className="flex flex-1 overflow-hidden">
        {scrollEditMode ? (
          /* 세로 스크롤 편집 모드 */
          <>
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center justify-between h-9 px-4 bg-[#111] border-b border-[#2a2a2a] shrink-0">
                <div className="flex items-center gap-2">
                  <i className="ri-layout-column-line text-[#888] text-sm" />
                  <span className="text-[11px] text-[#888] font-medium whitespace-nowrap">세로 보기 편집 모드</span>
                  <span className="text-[10px] text-[#555] whitespace-nowrap">
                    — 컷을 클릭하면 해당 컷 편집으로 전환됩니다
                  </span>
                </div>
                <button
                  onClick={() => setScrollEditMode(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e1e1e] hover:bg-[#2a2a2a] text-[#aaa] hover:text-white text-[11px] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-edit-line text-sm" />
                  일반 편집으로 돌아가기
                </button>
              </div>
              <ScrollEditView
                cuts={editor.cuts.filter((c) => c.episodeId === editor.activeEpisodeId)}
                activeCutId={editor.activeCutId}
                onSelectCut={(cutId) => {
                  editor.setActiveCut(cutId);
                  setScrollEditMode(false);
                }}
              />
              <BottomTimeline
                cuts={editor.cuts}
                episodes={editor.episodes}
                activeCutId={editor.activeCutId}
                activeEpisodeId={editor.activeEpisodeId}
                onSelectCut={editor.setActiveCut}
                onSelectEpisode={editor.handleSelectEpisode}
                onAddEpisode={editor.addEpisode}
                onRenameEpisode={editor.renameEpisode}
                onDeleteEpisode={editor.deleteEpisode}
                onDeleteCut={editor.deleteCut}
                onAddCut={editor.addCut}
                onPreview={() => setPreviewOpen(true)}
                onSortCuts={() => setSortCutsOpen(true)}
              />
            </div>
          </>
        ) : (
          /* 일반 편집 모드 */
          <>
        <LeftPanel
          activeTool={editor.activeTool}
          brushSize={editor.brushSize}
          onBrushSizeChange={editor.setBrushSize}
          brushOpacity={editor.brushOpacity}
          onBrushOpacityChange={editor.setBrushOpacity}
          brushHardness={editor.brushHardness}
          onBrushHardnessChange={editor.setBrushHardness}
          onSelectTool={editor.setActiveTool}
          generatedImages={editor.generatedImages}
          onApplyImage={editor.handleApplyImageToCanvas}
          onVectorize={handleVectorize}
          onEditCut={handleEditCut}
          onUploadImage={editor.handleUploadImage}
          isVectorizing={vectorize.isVectorizing}
          onImageLoad={editor.handleImageLoad}
          balloonShape={editor.balloonShape}
          onBalloonShapeChange={editor.setBalloonShape}
          balloonFontSize={editor.balloonFontSize}
          onBalloonFontSizeChange={editor.setBalloonFontSize}
          balloonFontFamily={editor.balloonFontFamily}
          onBalloonFontFamilyChange={editor.setBalloonFontFamily}
          balloonTailDir={editor.balloonTailDir}
          onBalloonTailDirChange={editor.setBalloonTailDir}
          balloonBorderColor={editor.balloonBorderColor}
          onBalloonBorderColorChange={editor.setBalloonBorderColor}
          balloonBgColor={editor.balloonBgColor}
          onBalloonBgColorChange={editor.setBalloonBgColor}
          balloonTextColor={editor.balloonTextColor}
          onBalloonTextColorChange={editor.setBalloonTextColor}
          onSelectBalloonTool={() => editor.setActiveTool("balloon")}
          selectedBalloonId={editor.selectedBalloonId}
          updateBalloon={editor.updateBalloon}
          balloons={editor.balloons}
          activeProjectId={editor.activeProjectId}
          activeEpisodeId={editor.activeEpisodeId}
          onSingleCutComplete={handleSingleCutComplete}
        />

        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
            <DrawingToolbar
              activeTool={editor.activeTool}
              onSelectTool={editor.setActiveTool}
              brushSize={editor.brushSize}
              onBrushSizeChange={editor.setBrushSize}
              opacity={editor.brushOpacity}
              onOpacityChange={editor.setBrushOpacity}
              hardness={editor.brushHardness}
              onHardnessChange={editor.setBrushHardness}
            />

            <DrawingCanvas
              ref={canvasHandleRef}
              activeTool={editor.activeTool}
              brushSize={editor.brushSize}
              opacity={editor.brushOpacity}
              hardness={editor.brushHardness}
              foregroundColor={editor.foregroundColor}
              zoom={editor.zoom}
              onZoomIn={editor.zoomIn}
              onZoomOut={editor.zoomOut}
              onResetZoom={editor.resetZoom}
              canvasImages={editor.canvasImages}
              onUpdateCanvasImage={editor.updateCanvasImage}
              onDeleteCanvasImage={editor.deleteCanvasImage}
              onUpdateCanvasImageLayerPosition={editor.updateCanvasImageLayerPosition}
              strokes={editor.strokes}
              selectedStrokeIds={editor.selectedStrokeIds}
              onAddStroke={editor.addStroke}
              onDeleteStrokes={editor.deleteStrokes}
              onMoveStrokes={editor.moveStrokes}
              onSelectStrokeIds={editor.setSelectedStrokeIds}
              onSelectAllStrokes={editor.selectAllStrokes}
              onClearAllStrokes={editor.clearAllStrokes}
              balloons={editor.balloons}
              selectedBalloonId={editor.selectedBalloonId}
              onSelectBalloon={editor.setSelectedBalloonId}
              onAddBalloon={editor.addBalloon}
              onUpdateBalloonText={editor.updateBalloonText}
              onUpdateBalloonPosition={editor.updateBalloonPosition}
              onUpdateBalloonSize={editor.updateBalloonSize}
              onDeleteBalloon={editor.deleteBalloon}
              layers={editor.layers}
              selectedLayerId={editor.selectedLayerId}
              onUpdateLayerImage={editor.updateLayerImage}
              rulerVisible={showRuler}
              gridVisible={showGrid}
              guideVisible={showGuide}
              onToggleRuler={() => setShowRuler((v) => !v)}
              onToggleGrid={() => setShowGrid((v) => !v)}
            />
          </div>

          <BottomTimeline
            cuts={editor.cuts}
            episodes={editor.episodes}
            activeCutId={editor.activeCutId}
            activeEpisodeId={editor.activeEpisodeId}
            onSelectCut={editor.setActiveCut}
            onSelectEpisode={editor.handleSelectEpisode}
            onAddEpisode={editor.addEpisode}
            onRenameEpisode={editor.renameEpisode}
            onDeleteEpisode={editor.deleteEpisode}
            onDeleteCut={editor.deleteCut}
            onAddCut={editor.addCut}
            onPreview={() => setPreviewOpen(true)}
            onSortCuts={() => setSortCutsOpen(true)}
          />
        </div>

        <div className="flex flex-col w-56 shrink-0 border-l border-[#2a2a2a]">
          <ColorPanel
            foregroundColor={editor.foregroundColor}
            backgroundColor={editor.backgroundColor}
            onForegroundChange={editor.setForegroundColor}
            onBackgroundChange={editor.setBackgroundColor}
          />
          <div className="flex-1 overflow-hidden flex flex-col">
            <LayersPanel
              layers={editor.layers}
              selectedLayerId={editor.selectedLayerId}
              onSelectLayer={editor.setSelectedLayerId}
              onToggleVisible={editor.toggleLayerVisible}
              onToggleLocked={editor.toggleLayerLocked}
              onUpdateOpacity={editor.updateLayerOpacity}
              onUpdateBlendMode={editor.updateLayerBlendMode}
              onAddLayer={editor.addLayer}
              onDeleteLayer={editor.deleteLayer}
              onReorderLayers={editor.reorderLayers}
              balloons={editor.balloons}
            />
          </div>
        </div>
          </>
        )}
      </div>

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        getCanvas={() => canvasHandleRef.current?.getCanvas() ?? null}
        getCompositeCanvas={() => canvasHandleRef.current?.getCompositeCanvas() ?? Promise.resolve(null)}
        initialFormat={exportInitialFormat}
      />

      <ProjectExportModal
        isOpen={projectExportOpen}
        onClose={() => setProjectExportOpen(false)}
        cuts={editor.cuts.filter((c) => c.episodeId === editor.activeEpisodeId)}
        episodeTitle={editor.episodes.find((e) => e.id === editor.activeEpisodeId)?.title ?? "에피소드"}
      />

      <PreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        cuts={editor.cuts.filter((c) => c.episodeId === editor.activeEpisodeId)}
        episodeTitle={editor.episodes.find((e) => e.id === editor.activeEpisodeId)?.title ?? "미리보기"}
      />

      <SortCutsModal
        isOpen={sortCutsOpen}
        onClose={() => setSortCutsOpen(false)}
        cuts={editor.cuts.filter((c) => c.episodeId === editor.activeEpisodeId)}
        onReorder={(orderedIds) => {
          // 순서 재정렬: orderedIds 순서로 index를 1부터 다시 매김
          const currentEpId = editor.activeEpisodeId;
          editor.setCuts((prev) => {
            const others = prev.filter((c) => c.episodeId !== currentEpId);
            const reordered = orderedIds.map((id, idx) => {
              const found = prev.find((c) => c.id === id);
              return found ? { ...found, index: idx + 1, label: `컷 ${idx + 1}` } : null;
            }).filter(Boolean) as typeof prev;
            return [...others, ...reordered];
          });
        }}
      />

      {cutEditorImage && (
        <WebtoonCutEditor
          imageUrl={cutEditorImage.url}
          width={512}
          height={512}
          onClose={() => setCutEditorImage(null)}
          onApplyToCanvas={handleCutEditorApply}
        />
      )}

      {vectorize.showVectorEditor && (
        <VectorEditor
          paths={vectorize.vectorPaths}
          width={vectorize.vectorSize.width}
          height={vectorize.vectorSize.height}
          onUpdatePath={vectorize.updatePath}
          onDeletePath={vectorize.deletePath}
          onApplyToCanvas={handleApplyVectorToCanvas}
          onAISmooth={vectorize.smoothVectorPaths}
          isSmoothing={vectorize.isSmoothing}
          onClose={vectorize.closeVectorEditor}
        />
      )}
    </div>
  );
}
