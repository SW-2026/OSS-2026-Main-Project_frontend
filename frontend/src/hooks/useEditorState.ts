import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  listEpisodes,
  createEpisode,
  updateEpisode,
  deleteEpisode as apiDeleteEpisode,
} from "@/lib/episodeApi";
import { listPanels, createPanel, deletePanel as apiDeletePanel, saveCutEditorData, getCutEditorData } from "@/lib/panelApi";
import api from "@/lib/api";
import type { BalloonItem, BalloonShape } from "@/pages/home/components/BalloonPanel";
import type { AIGeneratedImage } from "@/pages/home/components/ImagePanel";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8080";

// backend가 finalImageUrl 등을 "/images/..." 상대경로로 저장 → 절대 URL로 변환해서 frontend에 노출
const toAbsoluteImageUrl = (path: string | null | undefined): string =>
  !path ? "" : path.startsWith("http") ? path : `${BASE_URL}${path}`;

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
  imageUrl?: string;
  // 캐릭터/배경 이미지의 캔버스 내 위치와 크기
  imgX?: number;
  imgY?: number;
  imgW?: number;
  imgH?: number;
  imgRotation?: number;
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
  backgroundAssetUrl?: string;
  characterAssetUrl?: string;
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
  hardness: number;
  episodeId: string;
  cutId: string;
  layerId?: string;
  bbox: { x: number; y: number; w: number; h: number };
}

// UUID 형식 검증
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// localStorage 키 헬퍼 (API 실패 시 fallback 용도)
function getCutDataKey(cutId: string): string {
  return `webtoon-cut-data:${cutId}`;
}

// ---------------------------------------------------------------------------
// history 도메인(Java 백엔드) API를 통해 패널 히스토리 저장/로드
// ---------------------------------------------------------------------------
async function saveCutDataToBackend(panelId: string, payload: any): Promise<boolean> {
  try {
    // 히스토리 저장: POST /api/panels/{panelId}/history
    // payload는 캔버스 전체 상태 JSON (strokes, balloons, canvas_images, layers)
    await api.post(`/api/panels/${panelId}/history`, payload);
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[saveCutDataToBackend] 히스토리 API 저장 실패:", err);
    return false;
  }
}

async function loadCutDataFromBackend(panelId: string): Promise<any | null> {
  try {
    // 1. 히스토리 목록 조회: GET /api/panels/{panelId}/history
    const listRes = await api.get(`/api/panels/${panelId}/history`);
    const historyList = listRes.data?.data ?? listRes.data ?? [];

    if (!Array.isArray(historyList) || historyList.length === 0) {
      return null;
    }

    // 2. 가장 최신 버전 찾기 (version 기준 내림차순)
    const sorted = [...historyList].sort(
      (a: any, b: any) => (b.version ?? 0) - (a.version ?? 0)
    );
    const latest = sorted[0];

    // 3. 목록 응답에 data(캔버스 상태)가 포함되어 있으면 바로 반환
    if (latest.data) {
      return latest.data;
    }

    // 4. data가 없으면 특정 버전 복원 API 호출: POST /api/panels/{panelId}/history/{version}/restore
    const version = latest.version;
    if (version != null) {
      const restoreRes = await api.post(`/api/panels/${panelId}/history/${version}/restore`);
      if (restoreRes.data?.success && restoreRes.data.data) {
        return restoreRes.data.data;
      }
      if (restoreRes.data?.data) {
        return restoreRes.data.data;
      }
    }

    return null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[loadCutDataFromBackend] 히스토리 API 로드 실패:", err);
    return null;
  }
}

// localStorage fallback
function saveCutDataToLocal(cutId: string, payload: any): void {
  try {
    localStorage.setItem(getCutDataKey(cutId), JSON.stringify(payload));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[saveCutDataToLocal] localStorage 저장 실패:", err);
  }
}

function loadCutDataFromLocal(cutId: string): any | null {
  try {
    const stored = localStorage.getItem(getCutDataKey(cutId));
    return stored ? JSON.parse(stored) : null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[loadCutDataFromLocal] localStorage 로드 실패:", err);
    return null;
  }
}

export function useEditorState(initialProjectId?: string | null) {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(initialProjectId ?? null);

  const [layers, setLayers] = useState<Layer[]>(defaultLayers);
  const layersRef = useRef(layers);
  useEffect(() => { layersRef.current = layers; }, [layers]);
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
  const savingRef = useRef(false);
  useEffect(() => { savingRef.current = saveStatus === "saving"; }, [saveStatus]);

  // Drawing state
  const [activeTool, setActiveTool] = useState<DrawingTool>("brush");
  const [brushSize, setBrushSize] = useState(8);
  const [brushOpacity, setBrushOpacity] = useState(100);
  const [brushHardness, setBrushHardness] = useState(80);
  const [foregroundColor, setForegroundColor] = useState("#000000");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");

  // AI panel state
  const [promptText, setPromptText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<AIGeneratedImage[]>([]);
  const [canvasImages, setCanvasImages] = useState<{ id: string; url: string; x: number; y: number; w: number; h: number; layerPosition?: number }[]>([]);
  const canvasImagesRef = useRef(canvasImages);
  useEffect(() => { canvasImagesRef.current = canvasImages; }, [canvasImages]);

  // Balloon state
  const [balloons, setBalloons] = useState<BalloonItem[]>([]);
  const balloonsRef = useRef(balloons);
  useEffect(() => { balloonsRef.current = balloons; }, [balloons]);
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

        // 컷(패널) 로드 — episode별 backend listPanels 병렬 호출 (Promise.all)
        const loadedCuts: Cut[] = [];
        if (loadedEpisodes.length > 0) {
          const panelsByEpisode = await Promise.all(
            loadedEpisodes.map((e) =>
              listPanels(Number(e.id)).then((panels) =>
                panels.map((p) => ({ episodeId: e.id, panel: p }))
              )
            )
          );
          panelsByEpisode.flat().forEach(({ episodeId, panel }) => {
            loadedCuts.push({
              id: String(panel.panelId),
              index: panel.panelOrder,
              label: `컷 ${panel.panelOrder}`,
              prompt: panel.prompt ?? "",
              thumbnail: toAbsoluteImageUrl(panel.finalImageUrl),
              isActive: false,
              isGenerated: panel.status === "COMPLETED",
              episodeId,
              characterAssetUrl: toAbsoluteImageUrl(panel.characterAssetUrl) || undefined,
              backgroundAssetUrl: toAbsoluteImageUrl(panel.backgroundAssetUrl) || undefined,
            });
          });
        }

        if (loadedEpisodes.length === 0) {
          // 에피소드가 없으면 Java API로 기본 생성 시도
          try {
            const createRes = await api.post(`/api/projects/${initialProjectId}/episodes`, { epNumber: 1, epTitle: "에피소드 1" });
            if (createRes.data?.success) {
              const ep = createRes.data.data;
              const newEpId = String(ep.episodeId);
              const newCutId = `cut-${Date.now()}`;
              setEpisodes([{ id: newEpId, title: "에피소드 1", isActive: true }]);
              setCuts([{ id: newCutId, index: 1, label: "컷 1", prompt: "", thumbnail: "", isActive: true, isGenerated: false, episodeId: newEpId }]);
              setActiveEpisodeId(newEpId);
              setActiveCutId(newCutId);
              return;
            }
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error("[useEditorState] 기본 에피소드 생성 실패:", err);
          }
          // API 실패 시 로컬 fallback
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

  // 컷 데이터 로드 — cutEditorData API → localStorage fallback (B0 cutover)
  const loadCutData = async (cutId: string) => {
    if (!cutId || savingRef.current) return;
    try {
      let data: any = null;

      const panelId = Number(cutId);
      if (!Number.isNaN(panelId)) {
        try {
          const json = await getCutEditorData(panelId);
          if (json) {
            data = JSON.parse(json);
          }
        } catch (apiErr) {
          // eslint-disable-next-line no-console
          console.error("[loadCutData] cutEditorData API 로드 실패 → localStorage fallback:", apiErr);
        }
      }

      if (!data) {
        // cut-data 없음 → defaultLayers 리셋 + cut의 character/background Asset URL을 Layer.imageUrl로 매핑
        const cut = cutsRef.current.find((c) => c.id === cutId);
        if (cut) {
          const baseLayers: Layer[] = defaultLayers.map((l) =>
            l.type === "background" && cut.backgroundAssetUrl
              ? { ...l, imageUrl: cut.backgroundAssetUrl }
              : { ...l }
          );
          if (cut.characterAssetUrl) {
            baseLayers.push({
              id: `layer-character-${cut.id}`,
              name: "캐릭터",
              type: "character",
              visible: true,
              locked: false,
              opacity: 100,
              blendMode: "normal",
              imageUrl: cut.characterAssetUrl,
            });
          }
          setLayers(baseLayers);
        }
        return;
      }

      if (data.strokes) {
        const parsedStrokes = Array.isArray(data.strokes) ? data.strokes : [];
        setAllStrokes((prev) => {
          const otherCuts = prev.filter((s) => s.cutId !== cutId);
          return [...otherCuts, ...parsedStrokes];
        });
      }
      if (data.balloons) {
        const loaded = Array.isArray(data.balloons) ? data.balloons : [];
        // 하위 호환: layerId 없는 구버전 말풍선은 기본 대사 레이어에 할당
        setBalloons(loaded.map((b: BalloonItem) => b.layerId ? b : { ...b, layerId: "layer-dialogue" }));
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

  // 컷 변경 시 레이어 imageUrl을 패널 데이터에서 동기화
  useEffect(() => {
    if (!activeCutId || savingRef.current) return;
    const cut = cuts.find((c) => c.id === activeCutId);
    if (!cut) return;

    setLayers((prev) => prev.map((l) => {
      if (l.type === "background" && cut.backgroundAssetUrl) {
        const url = resolveImageUrl(cut.backgroundAssetUrl);
        const needsDefault = l.imgX == null || l.imgY == null;
        if (needsDefault && url) {
          return { ...l, imageUrl: url, imgX: 0, imgY: 0, imgW: 800, imgH: 1100 };
        }
        return { ...l, imageUrl: url ?? undefined };
      }
      if (l.type === "character" && cut.characterAssetUrl) {
        const url = resolveImageUrl(cut.characterAssetUrl);
        const needsDefault = l.imgX == null || l.imgY == null;
        if (needsDefault && url) {
          return { ...l, imageUrl: url, imgX: 160, imgY: 210, imgW: 480, imgH: 680 };
        }
        return { ...l, imageUrl: url ?? undefined };
      }
      return l;
    }));
  }, [activeCutId, cuts]);

  const addBalloon = useCallback((x: number, y: number): string => {
    const id = `balloon-${Date.now()}`;

    // 현재 선택된 레이어가 dialogue 타입이면 그 레이어에 연결,
    // 아니면 첫 번째 dialogue 타입 레이어 찾아서 연결
    let layerId = "layer-dialogue";
    const currentLayers = layersRef.current;
    const selId = selectedLayerIdRef.current;
    const selLayer = currentLayers.find((l) => l.id === selId);
    if (selLayer && selLayer.type === "dialogue") {
      layerId = selLayer.id;
    } else {
      const dialogueLayer = currentLayers.find((l) => l.type === "dialogue");
      if (dialogueLayer) {
        layerId = dialogueLayer.id;
      }
    }

    const newBalloon: BalloonItem = {
      id,
      layerId,
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

  const updateLayerImage = useCallback((layerId: string, x: number, y: number, w: number, h: number, rotation?: number) => {
    setLayers((prev) => prev.map((l) => (l.id === layerId ? { ...l, imgX: x, imgY: y, imgW: w, imgH: h, ...(rotation !== undefined ? { imgRotation: rotation } : {}) } : l)));
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
    setLayers((prev) => {
      const filtered = prev.filter((l) => l.id !== id);
      // 삭제한 레이어가 선택된 레이어였으면 첫 번째 레이어로 선택 변경
      if (selectedLayerIdRef.current === id && filtered.length > 0) {
        setSelectedLayerId(filtered[0].id);
      }
      return filtered;
    });
    // 삭제된 레이어에 소속된 말풍선 제거
    setBalloons((prev) => prev.filter((b) => b.layerId !== id));
    if (selectedBalloonId) {
      const deletedBalloon = balloonsRef.current.find((b) => b.id === selectedBalloonId);
      if (deletedBalloon && deletedBalloon.layerId === id) {
        setSelectedBalloonId(null);
      }
    }
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
      { id: `cimg-${Date.now()}`, url: img.url, x: 50, y: 50, w: 400, h: 400, layerPosition: layers.length },
    ]);
    setSaveStatus("unsaved");
  }, [layers.length]);

  const addCanvasImage = useCallback((url: string, x: number, y: number, w: number, h: number) => {
    setCanvasImages((prev) => [
      ...prev,
      { id: `cimg-${Date.now()}`, url, x, y, w, h, layerPosition: layersRef.current.length },
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

  const updateCanvasImageLayerPosition = useCallback((id: string, direction: "up" | "down") => {
    setCanvasImages((prev) => {
      const idx = prev.findIndex((img) => img.id === id);
      if (idx === -1) return prev;
      const current = prev[idx].layerPosition ?? layers.length;
      const newPos = direction === "up" ? Math.max(0, current - 1) : Math.min(layers.length, current + 1);
      if (newPos === current) return prev;
      return prev.map((img) => img.id === id ? { ...img, layerPosition: newPos } : img);
    });
    setSaveStatus("unsaved");
  }, [layers.length]);

  // 저장: 현재 컷 데이터를 history 도메인 API로 저장 (fallback: localStorage)
  const handleSave = useCallback(async () => {
    const cutId = activeCutIdRef.current;
    if (!cutId) {
      setSaveStatus("saved");
      return;
    }
    setSaveStatus("saving");

    try {
      const cutStrokes = allStrokesRef.current.filter((s) => s.cutId === cutId);
      const currentBalloons = balloonsRef.current;
      const currentCanvasImages = canvasImagesRef.current;
      const currentLayers = layersRef.current;
      const payload = {
        cut_id: cutId,
        strokes: cutStrokes,
        balloons: currentBalloons,
        canvas_images: currentCanvasImages,
        layers: currentLayers,
      };

      const panelId = Number(activeCutId);
      if (!Number.isNaN(panelId)) {
        try {
          // cutEditorData API로 저장 (B0 cutover)
          await saveCutEditorData(panelId, JSON.stringify(payload));
        } catch (apiErr) {
          // eslint-disable-next-line no-console
          console.error("[handleSave] cutEditorData API 저장 실패 → localStorage fallback:", apiErr);
          saveCutDataToLocal(activeCutId, payload);
        }
      } else {
        // 데모 cut(`cut-...`) — backend에 없는 cutId → localStorage
        saveCutDataToLocal(activeCutId, payload);
      }

      setSaveStatus("saved");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[useEditorState] 저장 실패:", err);
      setSaveStatus("unsaved");
    }
  }, []);

  // 자동 저장: unsaved 상태가 되면 3초 후 자동 저장
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveStatus !== "unsaved") return;
    if (!activeCutId) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      handleSave();
    }, 3000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [saveStatus, activeCutId, handleSave]);

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
      hardness: stroke.hardness ?? 100,
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

  // 에피소드/컷 CRUD — 백엔드 API 연동
  const addEpisode = useCallback(async (title?: string) => {
    const newTitle = title ?? `에피소드 ${episodes.length + 1}`;
    const newOrder = episodes.length + 1;

    if (!activeProjectId) {
      // 프로젝트 ID가 없으면 로컬 전용 (데모 모드)
      const newEpId = `ep-${Date.now()}`;
      const newCutId = `cut-${Date.now() + 1}`;

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
      return;
    }

    let newEpId: string;
    try {
      // episode는 backend API (1-C-2), cut 데이터는 백엔드 history API로 관리
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

    // 빈 Panel 생성 — backend panelOrder = lastOrder+1 자동 부여
    let newCutId: string;
    try {
      const panelId = await createPanel(Number(newEpId));
      newCutId = String(panelId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[useEditorState] 컷 생성 실패:", err);
      return;
    }

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

  // 특정 에피소드의 cuts를 backend listPanels로 재생성 (해당 에피소드만 교체, 나머지 유지)
  // 1컷/다컷 생성 후 컷 트랙 자동 갱신용 — 공용 함수 (현재 1컷에서만 호출)
  const refreshCutsForEpisode = useCallback(async (episodeId: number) => {
    try {
      const panels = await listPanels(episodeId);
      const epIdStr = String(episodeId);
      const refreshed: Cut[] = panels.map((p) => ({
        id: String(p.panelId),
        index: p.panelOrder,
        label: `컷 ${p.panelOrder}`,
        prompt: p.prompt ?? "",
        thumbnail: toAbsoluteImageUrl(p.finalImageUrl),
        isActive: false,
        isGenerated: p.status === "COMPLETED",
        episodeId: epIdStr,
        characterAssetUrl: toAbsoluteImageUrl(p.characterAssetUrl) || undefined,
        backgroundAssetUrl: toAbsoluteImageUrl(p.backgroundAssetUrl) || undefined,
      }));
      setCuts((prev) => [...prev.filter((c) => c.episodeId !== epIdStr), ...refreshed]);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[refreshCutsForEpisode] 실패:", err);
    }
  }, []);

  const addCut = useCallback(async () => {
    const currentEpId = activeEpisodeIdRef.current;
    const currentCuts = cutsRef.current.filter((c) => c.episodeId === currentEpId);
    const nextIndex = currentCuts.length > 0 ? Math.max(...currentCuts.map((c) => c.index)) + 1 : 1;

    // TODO: Java 백엔드에 패널(컷) 생성 API가 추가되면 연동
    // 빈 Panel 생성 — backend panelOrder = lastOrder+1 (client nextIndex와 동일 예상)
    // 멀티 사용자 race 시 불일치 가능 (현재 검증 1명 범위, 별도 작업으로 보강 가능)
    let newCutId: string;
    try {
      const panelId = await createPanel(Number(currentEpId));
      newCutId = String(panelId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[useEditorState] 컷 생성 실패:", err);
      return;
    }

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

  const deleteCut = useCallback(async (cutId: string) => {
    const currentEpId = activeEpisodeIdRef.current;
    const currentCuts = cutsRef.current.filter((c) => c.episodeId === currentEpId);

    // 같은 에피소드에 컷이 1개뿐이면 삭제 불가
    if (currentCuts.length <= 1) return;

    // backend Panel DELETE
    try {
      await apiDeletePanel(Number(cutId));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[useEditorState] 컷 삭제 실패:", err);
      return;
    }

    const wasActive = activeCutIdRef.current === cutId;
    setCuts((prev) => {
      const filtered = prev.filter((c) => c.id !== cutId);
      if (wasActive) {
        const remaining = filtered.filter((c) => c.episodeId === currentEpId)
          .sort((a, b) => a.index - b.index);
        if (remaining.length > 0) {
          setActiveCutId(remaining[0].id);
          // 라벨 재정렬
          const reindexed = filtered.map((c, i) =>
            c.episodeId === currentEpId ? { ...c, index: i + 1, label: `컷 ${i + 1}` } : c
          );
          return reindexed;
        }
      }
      return filtered;
    });
    setBalloons([]);
    setSelectedBalloonId(null);
    setCanvasImages([]);
    setSelectedStrokeIds([]);
    setSaveStatus("saved");
  }, []);

  const deleteEpisode = useCallback(async (id: string) => {
    // backend Episode DELETE — panels cascade. cut 데이터는 백엔드 history API로 관리됨.
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
    updateLayerImage,
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
    deleteCut,
    refreshCutsForEpisode,
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
    brushHardness,
    setBrushHardness,
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
    addCanvasImage,
    updateCanvasImage,
    deleteCanvasImage,
    updateCanvasImageLayerPosition,
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

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
  return `${baseUrl}${url}`;
}