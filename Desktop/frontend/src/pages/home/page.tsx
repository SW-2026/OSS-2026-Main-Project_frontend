import { useRef, useState } from "react";
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
import VectorEditor from "./components/VectorEditor";
import WebtoonCutEditor from "./components/WebtoonCutEditor";
import PreviewModal from "./components/PreviewModal";
import SortCutsModal from "./components/SortCutsModal";
import type { AIGeneratedImage } from "./components/AIImagePanel";

export default function WebtoonEditor() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("projectId");
  const editor = useEditorState(projectId);
  const vectorize = useVectorize();
  const canvasHandleRef = useRef<DrawingCanvasHandle>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportInitialFormat, setExportInitialFormat] = useState<"png" | "jpeg" | "pdf">("png");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sortCutsOpen, setSortCutsOpen] = useState(false);

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
    const mainCanvas = canvasHandleRef.current?.getCanvas();
    if (!mainCanvas) return;
    const ctx = mainCanvas.getContext("2d");
    if (!ctx) return;
    // 캔버스 중앙에 배치
    const x = Math.round((800 - offscreenCanvas.width) / 2);
    const y = Math.round((1100 - offscreenCanvas.height) / 2);
    ctx.drawImage(offscreenCanvas, x, y);
  };

  const handleApplyVectorToCanvas = () => {
    const canvas = canvasHandleRef.current?.getCanvas();
    if (!canvas) { vectorize.closeVectorEditor(); return; }
    const ctx = canvas.getContext("2d");
    if (!ctx) { vectorize.closeVectorEditor(); return; }

    // SVG를 캔버스에 렌더링 (비율 유지하며 중앙 배치)
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vectorize.vectorSize.width} ${vectorize.vectorSize.height}" width="${vectorize.vectorSize.width}" height="${vectorize.vectorSize.height}">
      ${vectorize.vectorPaths.map((p) => `<path d="${p.d}" stroke="${p.strokeColor}" stroke-width="${p.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${p.opacity / 100}"/>`).join("")}
    </svg>`;

    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const cw = 800;
      const ch = 1100;
      const vw = vectorize.vectorSize.width;
      const vh = vectorize.vectorSize.height;
      const scale = Math.min(cw / vw, ch / vh, 1);
      const drawW = vw * scale;
      const drawH = vh * scale;
      const x = Math.round((cw - drawW) / 2);
      const y = Math.round((ch - drawH) / 2);
      ctx.drawImage(img, x, y, drawW, drawH);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      // eslint-disable-next-line no-console
      console.error("[Vector] Failed to render SVG to canvas");
      URL.revokeObjectURL(url);
    };
    img.src = url;
    vectorize.closeVectorEditor();
  };

  return (
    <div className="flex flex-col w-screen h-screen bg-[#0d0d0d] overflow-hidden" style={{ fontFamily: "'Inter', 'Noto Sans KR', sans-serif" }}>
      <EditorHeader
        saveStatus={editor.saveStatus}
        onSave={editor.handleSave}
        onExport={handleExport}
        onUndo={editor.undo}
        onRedo={editor.redo}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
      />

      <div className="flex flex-1 overflow-hidden">
        <LeftPanel
          activeTool={editor.activeTool}
          brushSize={editor.brushSize}
          onBrushSizeChange={editor.setBrushSize}
          brushOpacity={editor.brushOpacity}
          onBrushOpacityChange={editor.setBrushOpacity}
          onSelectTool={editor.setActiveTool}
          promptText={editor.promptText}
          onPromptChange={editor.setPromptText}
          isGenerating={editor.isGenerating}
          onGenerate={editor.handleGenerate}
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
            />

            <DrawingCanvas
              ref={canvasHandleRef}
              activeTool={editor.activeTool}
              brushSize={editor.brushSize}
              opacity={editor.brushOpacity}
              foregroundColor={editor.foregroundColor}
              zoom={editor.zoom}
              onZoomIn={editor.zoomIn}
              onZoomOut={editor.zoomOut}
              onResetZoom={editor.resetZoom}
              canvasImages={editor.canvasImages}
              onUpdateCanvasImage={editor.updateCanvasImage}
              onDeleteCanvasImage={editor.deleteCanvasImage}
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
            onAddCut={editor.addCut}
            onPreview={() => setPreviewOpen(true)}
            onSortCuts={() => setSortCutsOpen(true)}
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
            />
          </div>
        </div>
      </div>

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        getCanvas={() => canvasHandleRef.current?.getCanvas() ?? null}
        getCompositeCanvas={() => canvasHandleRef.current?.getCompositeCanvas() ?? Promise.resolve(null)}
        initialFormat={exportInitialFormat}
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
