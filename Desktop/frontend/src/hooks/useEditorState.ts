import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  mockLayers,
  mockCuts,
  mockEpisodes,
} from "../mocks/webtoon";
import type { BalloonItem, BalloonShape } from "@/pages/home/components/BalloonPanel";
import type { AIGeneratedImage } from "@/pages/home/components/AIImagePanel";

export type LayerType = "background" | "character" | "effect" | "dialogue" | "sketch" | "lineart" | "color";

export type DrawingTool =
  | "select" | "move"
  | "pen" | "brush" | "pencil" | "marker"
  | "eraser" | "fill"
  | "line" | "rect" | "ellipse"
  | "text" | "balloon"
  | "eyedropper" | "zoom" | "hand"
  | "stroke-select" | "stroke-eraser";

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: string;
}

export interface Cut {
  id: string;
  index: number;
  label: string;
  prompt: string;
  thumbnail: string;
  isActive: boolean;
  isGenerated: boolean;
  episodeId: string;
}

export interface Episode {
  id: string;
  title: string;
  isActive: boolean;
}

export interface StrokePoint { x: number; y: number }

export interface Stroke {
  id: string;
  tool: DrawingTool;
  points: StrokePoint[];
  color: string;
  size: number;
  opacity: number;
  episodeId: string;
  cutId: string;
  layerId?: string;
  // 선택/이동용 바운딩 박스
  bbox: { x: number; y: number; w: number; h: number };
}

export function useEditorState(initialProjectId?: string | null) {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(initialProjectId ?? null);

  const [layers, setLayers] = useState<Layer[]>(mockLayers);
  const [selectedLayerId, setSelectedLayerId] = useState<string>("layer-lineart");
  const selectedLayerIdRef = useRef(selectedLayerId);
  useEffect(() => { selectedLayerIdRef.current = selectedLayerId; }, [selectedLayerId]);
  const [cuts, setCuts] = useState<Cut[]>(mockCuts);
  const cutsRef = useRef(cuts);
  useEffect(() => { cutsRef.current = cuts; }, [cuts]);

  const [episodes, setEpisodes] = useState<Episode[]>(mockEpisodes);
  const [activeEpisodeId, setActiveEpisodeId] = useState("ep-1");
  const [activeCutId, setActiveCutId] = useState("cut-2");
  const activeEpisodeIdRef = useRef(activeEpisodeId);
  const activeCutIdRef = useRef(activeCutId);
  useEffect(() => { activeEpisodeIdRef.current = activeEpisodeId; }, [activeEpisodeId]);
  useEffect(() => { activeCutIdRef.current = activeCutId; }, [activeCutId]);
  const [zoom, setZoom] = useState(75);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");

  // Drawing state
  const [activeTool, setActiveTool] = useState<DrawingTool>("brush");
  const [brushSize, setBrushSize] = useState(8);
  const [brushOpacity, setBrushOpacity] = useState(100);
  const [foregroundColor, setForegroundColor] = useState("#000000");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");

  // AI panel state
  const [promptText, setPromptText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<AIGeneratedImage[]>([]);
  const [canvasImages, setCanvasImages] = useState<{ id: string; url: string; x: number; y: number; w: number; h: number }[]>([]);

  // Balloon state
  const [balloons, setBalloons] = useState<BalloonItem[]>([]);
  const [selectedBalloonId, setSelectedBalloonId] = useState<string | null>(null);
  const [balloonShape, setBalloonShape] = useState<BalloonShape>("round");
  const [balloonFontSize, setBalloonFontSize] = useState(16);
  const [balloonFontFamily, setBalloonFontFamily] = useState("Noto Sans KR");
  const [balloonTailDir, setBalloonTailDir] = useState<BalloonItem["tailDir"]>("bottom-left");
  const [balloonBorderColor, setBalloonBorderColor] = useState("#000000");
  const [balloonBgColor, setBalloonBgColor] = useState("#ffffff");
  const [balloonTextColor, setBalloonTextColor] = useState("#000000");

  const addBalloon = useCallback((x: number, y: number): string => {
    const id = `balloon-${Date.now()}`;
    const newBalloon: BalloonItem = {
      id,
      shape: balloonShape,
      x,
      y,
      width: 180,
      height: 80,
      text: "",
      fontSize: balloonFontSize,
      fontFamily: balloonFontFamily,
      tailDir: balloonTailDir,
      borderColor: balloonBorderColor,
      bgColor: balloonBgColor,
      textColor: balloonTextColor,
    };
    setBalloons((prev) => [...prev, newBalloon]);
    setSelectedBalloonId(id);
    setSaveStatus("unsaved");
    return id;
  }, [balloonShape, balloonFontSize, balloonFontFamily, balloonTailDir, balloonBorderColor, balloonBgColor, balloonTextColor]);

  const updateBalloonText = useCallback((id: string, text: string) => {
    setBalloons((prev) => prev.map((b) => b.id === id ? { ...b, text } : b));
    setSaveStatus("unsaved");
  }, []);

  const updateBalloonPosition = useCallback((id: string, x: number, y: number) => {
    setBalloons((prev) => prev.map((b) => b.id === id ? { ...b, x, y } : b));
    setSaveStatus("unsaved");
  }, []);

  const updateBalloonSize = useCallback((id: string, width: number, height: number) => {
    setBalloons((prev) => prev.map((b) => b.id === id ? { ...b, width, height } : b));
    setSaveStatus("unsaved");
  }, []);

  const deleteBalloon = useCallback((id: string) => {
    setBalloons((prev) => prev.filter((b) => b.id !== id));
    setSelectedBalloonId(null);
    setSaveStatus("unsaved");
  }, []);

  const updateBalloon = useCallback((id: string, updates: Partial<Omit<BalloonItem, "id">>) => {
    setBalloons((prev) => prev.map((b) => b.id === id ? { ...b, ...updates } : b));
    setSaveStatus("unsaved");
  }, []);

  const toggleLayerVisible = useCallback((id: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
    );
    setSaveStatus("unsaved");
  }, []);

  const toggleLayerLocked = useCallback((id: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l))
    );
    setSaveStatus("unsaved");
  }, []);

  const updateLayerOpacity = useCallback((id: string, opacity: number) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, opacity } : l))
    );
    setSaveStatus("unsaved");
  }, []);

  const updateLayerBlendMode = useCallback((id: string, blendMode: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, blendMode } : l))
    );
    setSaveStatus("unsaved");
  }, []);

  const addLayer = useCallback((type: LayerType, name: string) => {
    const newLayer: Layer = {
      id: `layer-${Date.now()}`,
      name,
      type,
      visible: true,
      locked: false,
      opacity: 100,
      blendMode: "normal",
    };
    setLayers((prev) => [...prev, newLayer]);
    setSelectedLayerId(newLayer.id);
    setSaveStatus("unsaved");
  }, []);

  const deleteLayer = useCallback((id: string) => {
    setLayers((prev) => prev.filter((l) => l.id !== id));
    setSaveStatus("unsaved");
  }, []);

  const reorderLayers = useCallback((orderedIds: string[]) => {
    setLayers((prev) => {
      const map = new Map(prev.map((l) => [l.id, l]));
      const next = orderedIds.map((id) => map.get(id)).filter(Boolean) as Layer[];
      return next;
    });
    setSaveStatus("unsaved");
  }, []);

  const setActiveCut = useCallback((id: string) => {
    setActiveCutId(id);
    setCuts((prev) =>
      prev.map((c) => ({ ...c, isActive: c.id === id }))
    );
    // 컷 변경 시 말풍선/캔버스 이미지 초기화 (각 컷별 데이터)
    setBalloons([]);
    setSelectedBalloonId(null);
    setCanvasImages([]);
    setSelectedStrokeIds([]);
  }, []);

  const handleSelectEpisode = (episodeId: string) => {
    setActiveEpisodeId(episodeId);
    setEpisodes((prev) =>
      prev.map((ep) => ({ ...ep, isActive: ep.id === episodeId }))
    );
    // 에피소드 변경 시 말풍선/캔버스 이미지/선택 초기화
    setBalloons([]);
    setSelectedBalloonId(null);
    setCanvasImages([]);
    setSelectedStrokeIds([]);
    // 해당 에피소드의 첫 번째 컷으로 자동 이동 (항상 최신 cuts 참조)
    const currentCuts = cutsRef.current;
    const episodeCuts = currentCuts.filter((c) => c.episodeId === episodeId);
    const firstCut = episodeCuts.find((c) => c.isGenerated) || episodeCuts[0];
    if (firstCut) {
      setActiveCutId(firstCut.id);
      setCuts((prev) =>
        prev.map((c) => ({ ...c, isActive: c.id === firstCut.id }))
      );
    }
  };

  const handleGenerate = useCallback(async (prompt: string) => {
    if (!prompt.trim()) return;
    setIsGenerating(true);

    const seq = Date.now();
    const cleanPrompt = prompt.trim();
    const finalPrompt = `${cleanPrompt}, high quality webtoon manga comic illustration, detailed artwork`;
    // Pollinations.ai 클라이언트 직접 호출 — 이미지 생성 API
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=512&height=768&seed=${seq % 100000}&nologo=true`;

    const newImage: AIGeneratedImage = {
      id: `gen-${seq}`,
      url: imageUrl,
      prompt: cleanPrompt,
      type: "generated",
      timestamp: seq,
      isLoading: true,
    };
    setGeneratedImages((prev) => [newImage, ...prev]);

    // 이미지를 fetch로 직접 다운로드 후 로컬 Blob URL로 변환 — CORS/재시도 문제 해결
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60초 타임아웃
      const response = await fetch(imageUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const localUrl = URL.createObjectURL(blob);
      setGeneratedImages((prev) =>
        prev.map((img) => img.id === newImage.id ? { ...img, url: localUrl, isLoading: false } : img)
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[AI Generate] fetch failed, falling back to direct URL:", err);
      // fetch 실패해도 원격 URL 그대로 유지 → LazyImage onError 재시도로 fallback
      setGeneratedImages((prev) =>
        prev.map((img) => img.id === newImage.id ? { ...img, isLoading: false } : img)
      );
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const handleImageLoad = useCallback((id: string) => {
    setGeneratedImages((prev) => prev.map((img) => img.id === id ? { ...img, isLoading: false } : img));
  }, []);

  const handleUploadImage = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const newImage: AIGeneratedImage = {
      id: `upload-${Date.now()}`,
      url,
      prompt: file.name,
      type: "uploaded",
      timestamp: Date.now(),
    };
    setGeneratedImages((prev) => [newImage, ...prev]);
  }, []);

  const handleApplyImageToCanvas = useCallback((img: AIGeneratedImage) => {
    setCanvasImages((prev) => [
      ...prev,
      { id: `cimg-${Date.now()}`, url: img.url, x: 50, y: 50, w: 400, h: 400 },
    ]);
    setSaveStatus("unsaved");
  }, []);

  const updateCanvasImage = useCallback((id: string, x: number, y: number, w: number, h: number) => {
    setCanvasImages((prev) =>
      prev.map((img) => img.id === id ? { ...img, x, y, w, h } : img)
    );
    setSaveStatus("unsaved");
  }, []);

  const deleteCanvasImage = useCallback((id: string) => {
    setCanvasImages((prev) => prev.filter((img) => img.id !== id));
    setSaveStatus("unsaved");
  }, []);

  const handleSave = useCallback(() => {
    setSaveStatus("saving");
    setTimeout(() => setSaveStatus("saved"), 1200);
  }, []);

  const zoomIn = useCallback(() => setZoom((z) => Math.min(z + 10, 400)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(z - 10, 10)), []);
  const resetZoom = useCallback(() => setZoom(100), []);

  // Stroke 데이터 (선 선택/이동/삭제용) — 에피소드·컷별로 분리 저장
  const [allStrokes, setAllStrokes] = useState<Stroke[]>([]);
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<string[]>([]);

  // Undo/Redo 히스토리 스택
  const [undoStack, setUndoStack] = useState<Stroke[][]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[][]>([]);
  const allStrokesRef = useRef(allStrokes);
  useEffect(() => { allStrokesRef.current = allStrokes; }, [allStrokes]);

  const pushHistory = useCallback((prevStrokes: Stroke[]) => {
    setUndoStack((prev) => [...prev.slice(-49), prevStrokes]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const snapshot = next.pop()!;
      setRedoStack((r) => [...r, allStrokesRef.current]);
      setAllStrokes(snapshot);
      setSelectedStrokeIds([]);
      setSaveStatus("unsaved");
      return next;
    });
  }, []);

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const snapshot = next.pop()!;
      setUndoStack((u) => [...u, allStrokesRef.current]);
      setAllStrokes(snapshot);
      setSelectedStrokeIds([]);
      setSaveStatus("unsaved");
      return next;
    });
  }, []);

  // 현재 에피소드+컷에 해당하는 스트로크만 필터링
  const strokes = useMemo(
    () => allStrokes.filter((s) => s.episodeId === activeEpisodeId && s.cutId === activeCutId),
    [allStrokes, activeEpisodeId, activeCutId]
  );

  const addStroke = useCallback((stroke: Omit<Stroke, "id" | "bbox" | "episodeId" | "cutId">) => {
    if (stroke.points.length < 2) return;
    const xs = stroke.points.map((p) => p.x);
    const ys = stroke.points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const newStroke: Stroke = {
      ...stroke,
      id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      episodeId: activeEpisodeIdRef.current,
      cutId: activeCutIdRef.current,
      layerId: selectedLayerIdRef.current,
      bbox: { x: minX - stroke.size, y: minY - stroke.size, w: maxX - minX + stroke.size * 2, h: maxY - minY + stroke.size * 2 },
    };
    pushHistory(allStrokesRef.current);
    setAllStrokes((prev) => [...prev, newStroke]);
    setSaveStatus("unsaved");
    return newStroke.id;
  }, [pushHistory]);

  const deleteStrokes = useCallback((ids: string[]) => {
    pushHistory(allStrokesRef.current);
    setAllStrokes((prev) => prev.filter((s) => !ids.includes(s.id)));
    setSelectedStrokeIds((prev) => prev.filter((id) => !ids.includes(id)));
    setSaveStatus("unsaved");
  }, [pushHistory]);

  const moveStrokes = useCallback((ids: string[], dx: number, dy: number) => {
    setAllStrokes((prev) =>
      prev.map((s) => {
        if (!ids.includes(s.id)) return s;
        const newPoints = s.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        return {
          ...s,
          points: newPoints,
          bbox: { ...s.bbox, x: s.bbox.x + dx, y: s.bbox.y + dy },
        };
      })
    );
    setSaveStatus("unsaved");
  }, []);

  const selectAllStrokes = useCallback(() => {
    setSelectedStrokeIds(strokes.map((s) => s.id));
  }, [strokes]);

  const clearStrokeSelection = useCallback(() => {
    setSelectedStrokeIds([]);
  }, []);

  const clearAllStrokes = useCallback(() => {
    pushHistory(allStrokesRef.current);
    // 현재 에피소드+컷의 스트로크만 지움
    setAllStrokes((prev) => prev.filter(
      (s) => !(s.episodeId === activeEpisodeIdRef.current && s.cutId === activeCutIdRef.current)
    ));
    setSelectedStrokeIds([]);
    // 캔버스 이미지와 말풍선도 초기화
    setCanvasImages([]);
    setBalloons([]);
    setSelectedBalloonId(null);
    setSaveStatus("unsaved");
  }, [pushHistory]);

  // 프로젝트 변경 시 에피소드/컷/그리기 데이터 초기화
  useEffect(() => {
    if (!initialProjectId) return;
    setActiveProjectId(initialProjectId);
    // TODO: /api/projects/{initialProjectId}/episodes 호출로 실제 에피소드 목록 불러오기
    setEpisodes(mockEpisodes);
    setCuts(mockCuts);
    setActiveEpisodeId("ep-1");
    setActiveCutId("cut-2");
    setBalloons([]);
    setSelectedBalloonId(null);
    setCanvasImages([]);
    setSelectedStrokeIds([]);
    setAllStrokes([]);
    setUndoStack([]);
    setRedoStack([]);
    setGeneratedImages([]);
    setPromptText("");
    setSaveStatus("saved");
  }, [initialProjectId]);

  // 키보드 단축키
  useEffect(() => {
    const shortcutMap: Record<string, DrawingTool> = {
      v: "select",
      m: "move",
      p: "pen",
      b: "brush",
      n: "pencil",
      k: "marker",
      e: "eraser",
      g: "fill",
      l: "line",
      u: "rect",
      o: "ellipse",
      t: "text",
      w: "balloon",
      i: "eyedropper",
      z: "zoom",
      h: "hand",
      s: "stroke-select",
      x: "stroke-eraser",
    };
    // 키보드 Ctrl+A / Ctrl+Z / Ctrl+Y
    const handleKeyUp = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "a") {
        ev.preventDefault();
        selectAllStrokes();
      }
    };

    const handleKeyDown = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement).tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || (ev.target as HTMLElement).isContentEditable) return;

      // Ctrl+Z: 실행 취소
      if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && ev.key.toLowerCase() === "z") {
        ev.preventDefault();
        undo();
        return;
      }
      // Ctrl+Y 또는 Ctrl+Shift+Z: 다시 실행
      if (
        ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "y") ||
        ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && ev.key.toLowerCase() === "z")
      ) {
        ev.preventDefault();
        redo();
        return;
      }

      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

      const tool = shortcutMap[ev.key.toLowerCase()];
      if (tool) {
        setActiveTool(tool);
      }

      if ((ev.key === "Delete" || ev.key === "Backspace") && selectedStrokeIds.length > 0) {
        deleteStrokes(selectedStrokeIds);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [deleteStrokes, selectAllStrokes, selectedStrokeIds, undo, redo]);

  const deleteEpisode = useCallback((id: string) => {
    setEpisodes((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((ep) => ep.id !== id);
      // 삭제한 게 활성 에피소드면 다른 것으로 자동 이동
      const wasActive = activeEpisodeIdRef.current === id;
      if (wasActive) {
        const fallback = next[0];
        setActiveEpisodeId(fallback.id);
        const fallbackCuts = cutsRef.current.filter((c) => c.episodeId === fallback.id);
        const firstCut = fallbackCuts[0];
        if (firstCut) setActiveCutId(firstCut.id);
        setBalloons([]);
        setSelectedBalloonId(null);
        setCanvasImages([]);
        setSelectedStrokeIds([]);
        return next.map((ep, i) => ({ ...ep, isActive: i === 0 }));
      }
      return next;
    });
    setCuts((prev) => prev.filter((c) => c.episodeId !== id));
    setSaveStatus("unsaved");
  }, []);

  const renameEpisode = useCallback((id: string, title: string) => {
    setEpisodes((prev) => prev.map((ep) => ep.id === id ? { ...ep, title } : ep));
    setSaveStatus("unsaved");
  }, []);

  const addEpisode = useCallback((title?: string) => {
    const newId = `ep-${Date.now()}`;
    const newEpisode: Episode = {
      id: newId,
      title: title ?? `에피소드 ${episodes.length + 1}`,
      isActive: true,
    };
    setEpisodes((prev) => prev.map((ep) => ({ ...ep, isActive: false })).concat(newEpisode));
    setActiveEpisodeId(newId);
    // 새 에피소드의 첫 번째 컷 자동 생성
    const newCutId = `cut-${Date.now()}`;
    const newCut: Cut = {
      id: newCutId,
      index: 1,
      label: "컷 1",
      prompt: "",
      thumbnail: "",
      isActive: true,
      isGenerated: false,
      episodeId: newId,
    };
    setCuts((prev) => prev.map((c) => ({ ...c, isActive: false })).concat(newCut));
    setActiveCutId(newCutId);
    // 상태 초기화
    setBalloons([]);
    setSelectedBalloonId(null);
    setCanvasImages([]);
    setSelectedStrokeIds([]);
  }, [episodes.length]);

  const addCut = useCallback(() => {
    const currentEpId = activeEpisodeIdRef.current;
    const currentCuts = cutsRef.current.filter((c) => c.episodeId === currentEpId);
    const nextIndex = currentCuts.length > 0 ? Math.max(...currentCuts.map((c) => c.index)) + 1 : 1;
    const newCutId = `cut-${Date.now()}`;
    const newCut: Cut = {
      id: newCutId,
      index: nextIndex,
      label: `컷 ${nextIndex}`,
      prompt: "",
      thumbnail: "",
      isActive: true,
      isGenerated: false,
      episodeId: currentEpId,
    };
    setCuts((prev) => prev.map((c) => c.isActive ? { ...c, isActive: false } : c).concat(newCut));
    setActiveCutId(newCutId);
    // 상태 초기화
    setBalloons([]);
    setSelectedBalloonId(null);
    setCanvasImages([]);
    setSelectedStrokeIds([]);
  }, []);

  return {
    // project
    activeProjectId,
    setActiveProjectId,
    // layers
    layers,
    selectedLayerId,
    setSelectedLayerId,
    toggleLayerVisible,
    toggleLayerLocked,
    updateLayerOpacity,
    updateLayerBlendMode,
    addLayer,
    deleteLayer,
    reorderLayers,
    // cuts & episodes
    cuts,
    setCuts,
    episodes,
    setEpisodes,
    activeEpisodeId,
    setActiveEpisodeId,
    activeCutId,
    setActiveCut,
    handleSelectEpisode,
    addEpisode,
    renameEpisode,
    deleteEpisode,
    addCut,
    // zoom
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
    // save
    saveStatus,
    handleSave,
    // drawing
    activeTool,
    setActiveTool,
    brushSize,
    setBrushSize,
    brushOpacity,
    setBrushOpacity,
    foregroundColor,
    setForegroundColor,
    backgroundColor,
    setBackgroundColor,
    // AI
    promptText,
    setPromptText,
    isGenerating,
    handleGenerate,
    handleImageLoad,
    generatedImages,
    canvasImages,
    handleUploadImage,
    handleApplyImageToCanvas,
    updateCanvasImage,
    deleteCanvasImage,
    // balloons
    balloons,
    selectedBalloonId,
    setSelectedBalloonId,
    addBalloon,
    updateBalloonText,
    updateBalloonPosition,
    updateBalloonSize,
    deleteBalloon,
    updateBalloon,
    balloonShape,
    setBalloonShape,
    balloonFontSize,
    setBalloonFontSize,
    balloonFontFamily,
    setBalloonFontFamily,
    balloonTailDir,
    setBalloonTailDir,
    balloonBorderColor,
    setBalloonBorderColor,
    balloonBgColor,
    setBalloonBgColor,
    balloonTextColor,
    setBalloonTextColor,
    // strokes
    strokes,
    setAllStrokes,
    selectedStrokeIds,
    setSelectedStrokeIds,
    addStroke,
    deleteStrokes,
    moveStrokes,
    selectAllStrokes,
    clearStrokeSelection,
    clearAllStrokes,
    // undo/redo
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}