import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  listEpisodes,
  createEpisode,
  updateEpisode,
  deleteEpisode as apiDeleteEpisode,
} from "@/lib/episodeApi";
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

const defaultLayers: Layer[] = [
  { id: "layer-bg", name: "배경", type: "background", visible: true, locked: false, opacity: 100, blendMode: "normal" },
  { id: "layer-sketch", name: "스케치", type: "sketch", visible: true, locked: false, opacity: 100, blendMode: "normal" },
  { id: "layer-lineart", name: "선화", type: "lineart", visible: true, locked: false, opacity: 100, blendMode: "normal" },
  { id: "layer-color", name: "색칠", type: "color", visible: true, locked: false, opacity: 100, blendMode: "normal" },
  { id: "layer-effect", name: "효과", type: "effect", visible: true, locked: false, opacity: 100, blendMode: "normal" },
  { id: "layer-dialogue", name: "대사", type: "dialogue", visible: true, locked: false, opacity: 100, blendMode: "normal" },
];

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
  bbox: { x: number; y: number; w: number; h: number };
}

export function useEditorState(initialProjectId?: string | null) {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(initialProjectId ?? null);

  const [layers, setLayers] = useState<Layer[]>(defaultLayers);
  const [selectedLayerId, setSelectedLayerId] = useState<string>("layer-lineart");
  const selectedLayerIdRef = useRef(selectedLayerId);
  useEffect(() => { selectedLayerIdRef.current = selectedLayerId; }, [selectedLayerId]);

  const [cuts, setCuts] = useState<Cut[]>([]);
  const cutsRef = useRef(cuts);
  useEffect(() => { cutsRef.current = cuts; }, [cuts]);

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [activeEpisodeId, setActiveEpisodeId] = useState("");
  const [activeCutId, setActiveCutId] = useState("");
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

  // Stroke 데이터
  const [allStrokes, setAllStrokes] = useState<Stroke[]>([]);
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<string[]>([]);

  // Undo/Redo
  const [undoStack, setUndoStack] = useState<Stroke[][]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[][]>([]);
  const allStrokesRef = useRef(allStrokes);
  useEffect(() => { allStrokesRef.current = allStrokes; }, [allStrokes]);

  // 프로젝트 데이터 로드
  const [isLoadingProject, setIsLoadingProject] = useState(false);

  useEffect(() => {
    if (!initialProjectId) {
      // 기본 에피소드/컷 생성 (데모용)
      const demoEpId = `ep-${Date.now()}`;
      const demoCutId = `cut-${Date.now() + 1}`;
      setEpisodes([{ id: demoEpId, title: "에피소드 1", isActive: true }]);
      setCuts([{ id: demoCutId, index: 1, label: "컷 1", prompt: "", thumbnail: "", isActive: true, isGenerated: false, episodeId: demoEpId }]);
      setActiveEpisodeId(demoEpId);
      setActiveCutId(demoCutId);
      return;
    }

    setIsLoadingProject(true);
    setActiveProjectId(initialProjectId);

    const loadProject = async () => {
      try {
        // 에피소드 로드 (backend)
        const summaries = await listEpisodes(Number(initialProjectId));
        // backend EpisodeSummary → frontend Episode 매핑 (id는 String 캐스팅).
        // epNumber/panelCount는 frontend가 안 씀 — 무시.
        const loadedEpisodes: Episode[] = summaries.map((s) => ({
          id: String(s.episodeId),
          title: s.epTitle,
          isActive: false,
        }));

        // 컷 로드
        const { data: cutData, error: cutError } = await supabase
          .from("cuts")
          .select("*")
          .in(
            "episode_id",
            loadedEpisodes.map((e) => e.id)
          )
          .order("order_index", { ascending: true });

        if (cutError) throw cutError;

        const loadedCuts: Cut[] = (cutData ?? []).map((c: any) => ({
          id: c.id,
          index: c.order_index ?? 1,
          label: c.label ?? `컷 ${c.order_index ?? 1}`,
          prompt: c.prompt ?? "",
          thumbnail: c.thumbnail_url ?? "",
          isActive: false,
          isGenerated: false,
          episodeId: c.episode_id,
        }));

        if (loadedEpisodes.length === 0) {
          // 에피소드가 없으면 기본 생성
          const newEpId = `ep-${Date.now()}`;
          const newCutId = `cut-${Date.now() + 1}`;
          setEpisodes([{ id: newEpId, title: "에피소드 1", isActive: true }]);
          setCuts([{ id: newCutId, index: 1, label: "컷 1", prompt: "", thumbnail: "", isActive: true, isGenerated: false, episodeId: newEpId }]);
          setActiveEpisodeId(newEpId);
          setActiveCutId(newCutId);
        } else {
          const firstEp = loadedEpisodes[0];
          const firstEpId = firstEp.id;
          const epCuts = loadedCuts.filter((c) => c.episodeId === firstEpId);
          const firstCut = epCuts[0];

          setEpisodes(loadedEpisodes.map((e, i) => ({ ...e, isActive: i === 0 })));
          setCuts(loadedCuts);
          setActiveEpisodeId(firstEpId);
          setActiveCutId(firstCut?.id ?? "");

          // 첫 컷 데이터 로드
          if (firstCut) {
            await loadCutData(firstCut.id);
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[useEditorState] 프로젝트 로드 실패:", err);
      } finally {
        setIsLoadingProject(false);
        setSaveStatus("saved");
      }
    };

    // 상태 초기화 후 로드
    setLayers(defaultLayers);
    setSelectedLayerId("layer-lineart");
    setBalloons([]);
    setSelectedBalloonId(null);
    setCanvasImages([]);
    setSelectedStrokeIds([]);
    setAllStrokes([]);
    setUndoStack([]);
    setRedoStack([]);
    setGeneratedImages([]);
    setPromptText("");

    loadProject();
  }, [initialProjectId]);

  // 컷 데이터 로드
  const loadCutData = async (cutId: string) => {
    try {
      const { data, error } = await supabase
        .from("cut_data")
        .select("*")
        .eq("cut_id", cutId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return;

      if (data.strokes) {
        const parsedStrokes = Array.isArray(data.strokes) ? data.strokes : [];
        setAllStrokes((prev) => {
          const otherCuts = prev.filter((s) => s.cutId !== cutId);
          return [...otherCuts, ...parsedStrokes];
        });
      }
      if (data.balloons) {
        setBalloons(Array.isArray(data.balloons) ? data.balloons : []);
      }
      if (data.canvas_images) {
        setCanvasImages(Array.isArray(data.canvas_images) ? data.canvas_images : []);
      }
      if (data.layers) {
        setLayers(Array.isArray(data.layers) && data.layers.length > 0 ? data.layers : defaultLayers);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[useEditorState] 컷 데이터 로드 실패:", err);
    }
  };

  // 컷 변경 시 데이터 로드
  useEffect(() => {
    if (!activeCutId) return;
    loadCutData(activeCutId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCutId]);

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
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)));
    setSaveStatus("unsaved");
  }, []);

  const toggleLayerLocked = useCallback((id: string) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)));
    setSaveStatus("unsaved");
  }, []);

  const updateLayerOpacity = useCallback((id: string, opacity: number) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, opacity } : l)));
    setSaveStatus("unsaved");
  }, []);

  const updateLayerBlendMode = useCallback((id: string, blendMode: string) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, blendMode } : l)));
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
    setCuts((prev) => prev.map((c) => ({ ...c, isActive: c.id === id })));
    setBalloons([]);
    setSelectedBalloonId(null);
    setCanvasImages([]);
    setSelectedStrokeIds([]);
  }, []);

  const handleSelectEpisode = (episodeId: string) => {
    setActiveEpisodeId(episodeId);
    setEpisodes((prev) => prev.map((ep) => ({ ...ep, isActive: ep.id === episodeId })));
    setBalloons([]);
    setSelectedBalloonId(null);
    setCanvasImages([]);
    setSelectedStrokeIds([]);
    const currentCuts = cutsRef.current;
    const episodeCuts = currentCuts.filter((c) => c.episodeId === episodeId);
    const firstCut = episodeCuts.find((c) => c.isGenerated) || episodeCuts[0];
    if (firstCut) {
      setActiveCutId(firstCut.id);
      setCuts((prev) => prev.map((c) => ({ ...c, isActive: c.id === firstCut.id })));
    }
  };

  const handleGenerate = useCallback(async (prompt: string, options?: { count?: number; width?: number; height?: number }) => {
    if (!prompt.trim()) return;
    setIsGenerating(true);

    const count = options?.count ?? 1;
    const width = options?.width ?? 1024;
    const height = options?.height ?? 1536;
    const baseSeq = Date.now();
    const cleanPrompt = prompt.trim();

    // 웹툰 전용 고품질 프롬프트 엔지니어링
    const webtoonSuffix =
      "masterpiece, best quality, Korean webtoon manhwa style, digital comic art, " +
      "clean bold line art, vibrant flat colors, cel shading, professional panel composition, " +
      "detailed expressive eyes, anime-influenced character design, high resolution, crisp edges";

    const finalPrompt = `${cleanPrompt}, ${webtoonSuffix}`;

    const newImages: AIGeneratedImage[] = [];
    for (let i = 0; i < count; i++) {
      const seq = baseSeq + i;
      const seed = (seq % 100000) + i * 137;
      // Pollinations URL: nologo + noenhance=false (품질 향상)
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true&noenhance=false`;
      newImages.push({
        id: `gen-${seq}`,
        url: imageUrl,
        prompt: cleanPrompt,
        type: "generated",
        timestamp: seq,
        isLoading: true,
      });
    }
    setGeneratedImages((prev) => [...newImages, ...prev]);

    // 순차적으로 이미지 로드 확인 (blob 변환 제거 — URL 직접 사용해 품질 손실 방지)
    for (let i = 0; i < newImages.length; i++) {
      const img = newImages[i];
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);
        const response = await fetch(img.url, { signal: controller.signal, method: "HEAD" });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        // 이미지가 준비되면 isLoading false로 — URL은 그대로 유지
        setGeneratedImages((prev) =>
          prev.map((item) => item.id === img.id ? { ...item, isLoading: false } : item)
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[AI Generate] fetch failed:", err);
        setGeneratedImages((prev) =>
          prev.map((item) => item.id === img.id ? { ...item, isLoading: false } : item)
        );
      }
    }

    setIsGenerating(false);
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
    setCanvasImages((prev) => prev.map((img) => img.id === id ? { ...img, x, y, w, h } : img));
    setSaveStatus("unsaved");
  }, []);

  const deleteCanvasImage = useCallback((id: string) => {
    setCanvasImages((prev) => prev.filter((img) => img.id !== id));
    setSaveStatus("unsaved");
  }, []);

  // 저장: 현재 컷 데이터를 Supabase에 저장
  const handleSave = useCallback(async () => {
    if (!activeCutId || !activeProjectId) {
      setSaveStatus("saved");
      return;
    }
    setSaveStatus("saving");

    try {
      const cutStrokes = allStrokes.filter((s) => s.cutId === activeCutId);

      await supabase.from("cut_data").upsert({
        cut_id: activeCutId,
        strokes: cutStrokes,
        balloons,
        canvas_images: canvasImages,
        layers,
      }, { onConflict: "cut_id" });

      setSaveStatus("saved");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[useEditorState] 저장 실패:", err);
      setSaveStatus("unsaved");
    }
  }, [activeCutId, activeProjectId, allStrokes, balloons, canvasImages, layers]);

  const zoomIn = useCallback(() => setZoom((z) => Math.min(z + 10, 400)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(z - 10, 10)), []);
  const resetZoom = useCallback(() => setZoom(100), []);

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
    setAllStrokes((prev) => prev.filter(
      (s) => !(s.episodeId === activeEpisodeIdRef.current && s.cutId === activeCutIdRef.current)
    ));
    setSelectedStrokeIds([]);
    setCanvasImages([]);
    setBalloons([]);
    setSelectedBalloonId(null);
    setSaveStatus("unsaved");
  }, [pushHistory]);

  // 에피소드/컷 CRUD — Supabase 연동
  const addEpisode = useCallback(async (title?: string) => {
    if (!activeProjectId) return;

    const newTitle = title ?? `에피소드 ${episodes.length + 1}`;
    const newOrder = episodes.length + 1;

    // episode는 backend (1-C-2), cut은 Supabase 잔존 (1-C-3에서 정리)
    let newEpId: string;
    try {
      const created = await createEpisode(Number(activeProjectId), {
        epNumber: newOrder,
        epTitle: newTitle,
      });
      newEpId = String(created.episodeId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[useEditorState] 에피소드 생성 실패:", err);
      return;
    }

    const { data: cutData, error: cutError } = await supabase
      .from("cuts")
      .insert({ episode_id: newEpId, label: "컷 1", order_index: 1 })
      .select()
      .single();

    if (cutError || !cutData) {
      // eslint-disable-next-line no-console
      console.error("[useEditorState] 컷 생성 실패:", cutError);
      return;
    }

    const newCutId = cutData.id;

    const newEpisode: Episode = { id: newEpId, title: newTitle, isActive: true };
    const newCut: Cut = {
      id: newCutId,
      index: 1,
      label: "컷 1",
      prompt: "",
      thumbnail: "",
      isActive: true,
      isGenerated: false,
      episodeId: newEpId,
    };

    setEpisodes((prev) => prev.map((ep) => ({ ...ep, isActive: false })).concat(newEpisode));
    setCuts((prev) => prev.map((c) => ({ ...c, isActive: false })).concat(newCut));
    setActiveEpisodeId(newEpId);
    setActiveCutId(newCutId);
    setBalloons([]);
    setSelectedBalloonId(null);
    setCanvasImages([]);
    setSelectedStrokeIds([]);
    setSaveStatus("saved");
  }, [activeProjectId, episodes.length]);

  const addCut = useCallback(async () => {
    const currentEpId = activeEpisodeIdRef.current;
    const currentCuts = cutsRef.current.filter((c) => c.episodeId === currentEpId);
    const nextIndex = currentCuts.length > 0 ? Math.max(...currentCuts.map((c) => c.index)) + 1 : 1;

    const { data: cutData, error: cutError } = await supabase
      .from("cuts")
      .insert({ episode_id: currentEpId, label: `컷 ${nextIndex}`, order_index: nextIndex })
      .select()
      .single();

    if (cutError || !cutData) {
      // eslint-disable-next-line no-console
      console.error("[useEditorState] 컷 생성 실패:", cutError);
      return;
    }

    const newCutId = cutData.id;
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
    setBalloons([]);
    setSelectedBalloonId(null);
    setCanvasImages([]);
    setSelectedStrokeIds([]);
    setSaveStatus("saved");
  }, []);

  const deleteEpisode = useCallback(async (id: string) => {
    // backend Episode DELETE — panels만 cascade. Supabase cuts/cut_data는 잔존 (1-C-3에서 정리)
    try {
      await apiDeleteEpisode(Number(id));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[useEditorState] 에피소드 삭제 실패:", err);
      return;
    }

    setEpisodes((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((ep) => ep.id !== id);
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
    setSaveStatus("saved");
  }, []);

  const renameEpisode = useCallback(async (id: string, title: string) => {
    try {
      await updateEpisode(Number(id), { epTitle: title });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[useEditorState] 에피소드 이름 변경 실패:", err);
      return;
    }
    setEpisodes((prev) => prev.map((ep) => ep.id === id ? { ...ep, title } : ep));
    setSaveStatus("saved");
  }, []);

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

    const handleKeyUp = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "a") {
        ev.preventDefault();
        selectAllStrokes();
      }
    };

    const handleKeyDown = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement).tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || (ev.target as HTMLElement).isContentEditable) return;

      if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && ev.key.toLowerCase() === "z") {
        ev.preventDefault();
        undo();
        return;
      }
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

  return {
    // project
    activeProjectId,
    setActiveProjectId,
    isLoadingProject,
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