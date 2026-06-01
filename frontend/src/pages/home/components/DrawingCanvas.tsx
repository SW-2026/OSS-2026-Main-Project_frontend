import {
  useRef, useEffect, useCallback, useState,
  forwardRef, useImperativeHandle,
} from "react";
import type { DrawingTool, Stroke, StrokePoint, Layer } from "@/hooks/useEditorState";
import type { BalloonItem } from "./BalloonPanel";
import BalloonOverlay from "./BalloonOverlay";

interface CanvasImageLayer {
  id: string;
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  layerPosition?: number;
}

interface DrawingCanvasProps {
  activeTool: DrawingTool;
  brushSize: number;
  opacity: number;
  hardness: number;
  foregroundColor: string;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  canvasImages?: CanvasImageLayer[];
  onUpdateCanvasImage?: (id: string, x: number, y: number, w: number, h: number, rotation?: number) => void;
  onDeleteCanvasImage?: (id: string) => void;
  onUpdateCanvasImageLayerPosition?: (id: string, direction: "up" | "down") => void;
  // stroke props
  strokes: Stroke[];
  selectedStrokeIds: string[];
  onAddStroke: (stroke: Omit<Stroke, "id" | "bbox">) => void;
  onDeleteStrokes: (ids: string[]) => void;
  onMoveStrokes: (ids: string[], dx: number, dy: number) => void;
  onSelectStrokeIds: (ids: string[]) => void;
  onSelectAllStrokes: () => void;
  onClearAllStrokes?: () => void;
  // balloon props
  balloons: BalloonItem[];
  selectedBalloonId: string | null;
  onSelectBalloon: (id: string | null) => void;
  onAddBalloon: (x: number, y: number) => string;
  onUpdateBalloonText: (id: string, text: string) => void;
  onUpdateBalloonPosition: (id: string, x: number, y: number) => void;
  onUpdateBalloonSize: (id: string, w: number, h: number) => void;
  onDeleteBalloon: (id: string) => void;
  // layer props
  layers?: Layer[];
  selectedLayerId?: string;
  onUpdateLayerImage?: (layerId: string, x: number, y: number, w: number, h: number, rotation?: number) => void;
  rulerVisible?: boolean;
  gridVisible?: boolean;
  guideVisible?: boolean;
  onToggleRuler?: () => void;
  onToggleGrid?: () => void;
}

export interface DrawingCanvasHandle {
  getCanvas: () => HTMLCanvasElement | null;
  getCompositeCanvas: () => Promise<HTMLCanvasElement | null>;
}

const CANVAS_W = 800;
const CANVAS_H = 1100;

// 캔버스 경계 안으로 위치 제한 (최소 50px 이상 보이도록)
function clampToCanvas(x: number, y: number, w: number, h: number): { x: number; y: number } {
  const minVisible = 50;
  return {
    x: Math.max(-w + minVisible, Math.min(CANVAS_W - minVisible, x)),
    y: Math.max(-h + minVisible, Math.min(CANVAS_H - minVisible, y)),
  };
}

// 두 점 사이 거리
function dist(a: StrokePoint, b: StrokePoint) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// 점이 선분에 가까운지 체크
function pointNearSegment(p: StrokePoint, a: StrokePoint, b: StrokePoint, threshold: number): boolean {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const ap = { x: p.x - a.x, y: p.y - a.y };
  const lenSq = ab.x ** 2 + ab.y ** 2;
  if (lenSq === 0) return dist(p, a) < threshold;
  const t = Math.max(0, Math.min(1, (ap.x * ab.x + ap.y * ab.y) / lenSq));
  const closest = { x: a.x + t * ab.x, y: a.y + t * ab.y };
  return dist(p, closest) < threshold;
}

// 점이 스트로크 위에 있는지 체크
function isPointOnStroke(p: StrokePoint, stroke: Stroke, threshold: number): boolean {
  const pts = stroke.points;
  for (let i = 0; i < pts.length - 1; i++) {
    if (pointNearSegment(p, pts[i], pts[i + 1], threshold + stroke.size / 2)) return true;
  }
  return false;
}

// 스트로크를 캔버스에 렌더링 (레이어 속성 + 경도 blur 적용)
function getBlurFromHardness(hardness: number): number {
  return Math.max(0, (100 - hardness) * 0.08);
}

function renderStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  layers: Layer[],
  highlight = false
) {
  if (stroke.points.length < 2) return;

  // 스트로크가 속한 레이어 속성 조회
  const layer = stroke.layerId ? layers.find((l) => l.id === stroke.layerId) : undefined;
  const layerOpacity = layer ? layer.opacity : 100;
  const layerBlendMode = layer ? layer.blendMode : "normal";
  const layerVisible = layer ? layer.visible : true;

  if (!layerVisible) return; // 숨겨진 레이어는 안 그림

  ctx.save();

  // 블렌드 모드 적용
  const validBlendModes = [
    "source-over", "multiply", "screen", "overlay", "darken", "lighten",
    "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion",
    "hue", "saturation", "color", "luminosity",
  ];
  if (validBlendModes.includes(layerBlendMode)) {
    ctx.globalCompositeOperation = layerBlendMode;
  } else {
    ctx.globalCompositeOperation = "source-over";
  }

  // 최종 opacity = 스트로크 opacity × 레이어 opacity
  const finalAlpha = (stroke.opacity / 100) * (layerOpacity / 100);
  ctx.globalAlpha = finalAlpha;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // 경도에 따른 blur 필터 적용
  const blurAmount = getBlurFromHardness(stroke.hardness ?? 100);
  if (blurAmount > 0.1) {
    ctx.filter = `blur(${blurAmount}px)`;
  }

  if (highlight) {
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = stroke.size + 4;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
    ctx.globalAlpha = finalAlpha;
  }

  if (stroke.tool === "fill") {
    ctx.fillStyle = stroke.color;
    ctx.globalAlpha = finalAlpha;
    // points는 사각형 경계: [LT, RT, RB, LB, LT]
    if (stroke.points.length >= 4) {
      const minX = Math.min(...stroke.points.map((p) => p.x));
      const minY = Math.min(...stroke.points.map((p) => p.y));
      const maxX = Math.max(...stroke.points.map((p) => p.x));
      const maxY = Math.max(...stroke.points.map((p) => p.y));
      ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
    }
    ctx.restore();
    return;
  } else if (stroke.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.lineWidth = stroke.size;
  } else {
    // 모든 드로잉 툴 - 동일한 크기, 경도로만 차별화
    ctx.globalCompositeOperation = layerBlendMode === "normal" ? "source-over" : layerBlendMode;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
  }

  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  ctx.stroke();
  ctx.restore();
}

// 전체 스트로크 다시 그리기
function redrawAllStrokes(
  canvas: HTMLCanvasElement,
  strokes: Stroke[],
  selectedIds: string[],
  layers: Layer[]
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  for (const stroke of strokes) {
    const isSelected = selectedIds.includes(stroke.id);
    renderStroke(ctx, stroke, layers, isSelected);
  }
}

const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
  function DrawingCanvas(
    {
      activeTool,
      brushSize,
      opacity,
      hardness,
      foregroundColor,
      zoom,
      onZoomIn,
      onZoomOut,
      onResetZoom,
      canvasImages = [],
      onUpdateCanvasImage,
      onDeleteCanvasImage,
      onUpdateCanvasImageLayerPosition,
      strokes,
      selectedStrokeIds,
      onAddStroke,
      onDeleteStrokes,
      onMoveStrokes,
      onSelectStrokeIds,
      onSelectAllStrokes,
      onClearAllStrokes,
      balloons,
      selectedBalloonId,
      onSelectBalloon,
      onAddBalloon,
      onUpdateBalloonText,
      onUpdateBalloonPosition,
      onUpdateBalloonSize,
      onDeleteBalloon,
      // layer props
      layers = [],
      selectedLayerId,
      onUpdateLayerImage,
      rulerVisible,
      gridVisible,
      guideVisible,
      onToggleRuler,
      onToggleGrid,
    },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const currentStrokePoints = useRef<StrokePoint[]>([]);
    const lastPoint = useRef<StrokePoint | null>(null);
    const startPoint = useRef<StrokePoint | null>(null);
    const [cursorPos, setCursorPos] = useState<StrokePoint | null>(null);
    const [showGrid, setShowGrid] = useState(false);
    const [showRuler, setShowRuler] = useState(true);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

    // 핀치 줌 상태
    const pinchRef = useRef<{ initialDist: number; lastZoom: number } | null>(null);
    const [isPinching, setIsPinching] = useState(false);

    // 외부 제어 prop이 있으면 그걸 사용
    const effectiveShowRuler = rulerVisible !== undefined ? rulerVisible : showRuler;
    const effectiveShowGrid = gridVisible !== undefined ? gridVisible : showGrid;

    const isPanning = useRef(false);
    const panStart = useRef<StrokePoint | null>(null);

    // 이미지 레이어 선택/드래그/리사이즈 상태
    const [selectedImgId, setSelectedImgId] = useState<string | null>(null);
    const imgDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
    const imgResizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number; origX: number; origY: number; aspectRatio: number } | null>(null);
    const imgRotateRef = useRef<{ startX: number; startY: number; origRotation: number; centerX: number; centerY: number } | null>(null);
    const [isDraggingImg, setIsDraggingImg] = useState(false);
    const [isResizingImg, setIsResizingImg] = useState(false);
    const [isRotatingImg, setIsRotatingImg] = useState(false);

    // 캐릭터/배경 레이어 이미지 선택/드래그/리사이즈 상태
    const [selectedLayerImgIds, setSelectedLayerImgIds] = useState<string[]>([]);
    const layerImgDragRef = useRef<{ startX: number; startY: number; origPositions: { id: string; x: number; y: number }[] } | null>(null);
    const layerImgResizeRef = useRef<{ startX: number; startY: number; origData: { id: string; x: number; y: number; w: number; h: number; aspectRatio: number }[] } | null>(null);
    const layerImgRotateRef = useRef<{ startX: number; startY: number; origAngles: { id: string; rotation: number }[]; centerX: number; centerY: number } | null>(null);
    const [isDraggingLayerImg, setIsDraggingLayerImg] = useState(false);
    const [isResizingLayerImg, setIsResizingLayerImg] = useState(false);
    const [isRotatingLayerImg, setIsRotatingLayerImg] = useState(false);

    // 스트로크 선택/이동 상태
    const strokeMoveRef = useRef<{
      startX: number;
      startY: number;
      movedX: number;
      movedY: number;
    } | null>(null);
    const [isMovingStrokes, setIsMovingStrokes] = useState(false);

    // 선택 영역 드래그 (lasso)
    const [lassoRect, setLassoRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const lassoStart = useRef<StrokePoint | null>(null);
    const isLassoing = useRef(false);

    // 텍스트 입력 상태
    const [textInput, setTextInput] = useState<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null);
    const [textValue, setTextValue] = useState("");
    const textInputRef = useRef<HTMLInputElement>(null);

    const scale = zoom / 100;

    useImperativeHandle(ref, () => ({
      getCanvas: () => canvasRef.current,
      getCompositeCanvas: async (): Promise<HTMLCanvasElement | null> => {
        const strokeCanvas = canvasRef.current;
        if (!strokeCanvas) return null;

        const composite = document.createElement("canvas");
        composite.width = CANVAS_W;
        composite.height = CANVAS_H;
        const ctx = composite.getContext("2d");
        if (!ctx) return null;

        // 1. 흰 배경
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // 1.5 배경/캐릭터 레이어 이미지
        for (const layer of layers) {
          if (!layer.imageUrl || !layer.visible) continue;
          if (layer.type !== "background" && layer.type !== "character") continue;
          const layerIdx = layers.findIndex((l) => l.id === layer.id);
          await new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              ctx.save();
              ctx.globalAlpha = layer.opacity / 100;
              if (layer.imgX !== undefined && layer.imgY !== undefined && layer.imgW !== undefined && layer.imgH !== undefined) {
                ctx.drawImage(img, layer.imgX, layer.imgY, layer.imgW, layer.imgH);
              } else if (layer.type === "background") {
                ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
              } else {
                ctx.drawImage(img, 160, 210, 480, 680);
              }
              ctx.restore();
              resolve();
            };
            img.onerror = () => resolve();
            img.src = layer.imageUrl!;
          });

          // 해당 레이어 위치에 들어가야 할 AI 이미지들 렌더링 (rotation 지원)
          const displayImages = canvasImages.filter(
            (ci) => (ci.layerPosition ?? layers.length) === layerIdx
          );
          for (const cimg of displayImages) {
            await new Promise<void>((resolve) => {
              const el = new Image();
              el.crossOrigin = "anonymous";
              el.onload = () => {
                ctx.save();
                if (cimg.rotation && cimg.rotation !== 0) {
                  const cx = cimg.x + cimg.w / 2;
                  const cy = cimg.y + cimg.h / 2;
                  ctx.translate(cx, cy);
                  ctx.rotate((cimg.rotation * Math.PI) / 180);
                  ctx.translate(-cx, -cy);
                }
                ctx.drawImage(el, cimg.x, cimg.y, cimg.w, cimg.h);
                ctx.restore();
                resolve();
              };
              el.onerror = () => resolve();
              el.src = cimg.url;
            });
          }
        }

        // 2. 나머지 AI 이미지들 (layerPosition >= layers.length 인 것들, rotation 지원)
        const remainingImages = canvasImages.filter(
          (ci) => (ci.layerPosition ?? layers.length) >= layers.length
        );
        const imagePromises = remainingImages.map(
          (img) =>
            new Promise<void>((resolve) => {
              const el = new Image();
              el.crossOrigin = "anonymous";
              el.onload = () => {
                ctx.save();
                if (img.rotation && img.rotation !== 0) {
                  const cx = img.x + img.w / 2;
                  const cy = img.y + img.h / 2;
                  ctx.translate(cx, cy);
                  ctx.rotate((img.rotation * Math.PI) / 180);
                  ctx.translate(-cx, -cy);
                }
                ctx.drawImage(el, img.x, img.y, img.w, img.h);
                ctx.restore();
                resolve();
              };
              el.onerror = () => resolve();
              el.src = img.url;
            })
        );
        await Promise.all(imagePromises);

        // 3. 스트로크 캔버스
        ctx.drawImage(strokeCanvas, 0, 0);

        // 4. 말풍선 SVG를 캔버스에 합성 (숨겨진 레이어 제외)
        if (balloons && balloons.length > 0) {
          const visibleLayerIds2 = new Set(layers.filter(l => l.visible).map(l => l.id));
          const exportBalloons = balloons.filter(b => visibleLayerIds2.has(b.layerId));
          if (exportBalloons.length > 0) {
          const tailPad = 18;
          const svgContent = exportBalloons
            .map((b) => {
              const tailSize = b.tailDir === "none" ? 0 : tailPad;
              const r = Math.min(16, b.width * 0.15, b.height * 0.25);
              const bh = b.height - tailSize;

              const buildRect = (bh2: number, radius: number = r) =>
                `M ${radius},0 H ${b.width - radius} Q ${b.width},0 ${b.width},${radius} V ${bh2 - radius} Q ${b.width},${bh2} ${b.width - radius},${bh2} H ${radius} Q 0,${bh2} 0,${bh2 - radius} V ${radius} Q 0,0 ${radius},0 Z`;

              const tailPaths: Record<string, string> = {
                "bottom-left": `M ${r * 2},${bh} L ${r},${bh + tailSize} L ${r * 4},${bh} Z`,
                "bottom-right": `M ${b.width - r * 4},${bh} L ${b.width - r},${bh + tailSize} L ${b.width - r * 2},${bh} Z`,
                "top-left": `M ${r * 2},0 L ${r},${-tailSize} L ${r * 4},0 Z`,
                "top-right": `M ${b.width - r * 4},0 L ${b.width - r},${-tailSize} L ${b.width - r * 2},0 Z`,
              };
              const tailPath = b.tailDir !== "none" ? (tailPaths[b.tailDir] ?? "") : "";
              const bodyPath = buildRect(bh);
              const fullPath = `${bodyPath} ${tailPath}`;
              const isDashed = b.shape === "whisper";
              const stroke = b.borderColor || "#333333";
              const fill = b.bgColor || "#ffffff";

              const fontSize = b.fontSize ?? 16;
              const fontFamily = b.fontFamily ?? "sans-serif";
              const textColor = b.textColor || "#000000";
              const lines = (b.text || "").split("\n");
              const lineH = fontSize * 1.4;
              const totalTextH = lines.length * lineH;
              const textStartY = (bh - totalTextH) / 2 + fontSize;

              const textEls = lines
                .map((line, i) => {
                  const escaped = line
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");
                  return `<text x="${b.width / 2}" y="${textStartY + i * lineH}" text-anchor="middle" font-size="${fontSize}" font-family="${fontFamily}" fill="${textColor}">${escaped}</text>`;
                })
                .join("");

              return `<g transform="translate(${b.x}, ${b.y})">
                <path d="${fullPath}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" ${isDashed ? 'stroke-dasharray="6,3"' : ''} />
                ${textEls}
              </g>`;
            })
            .join("");

          const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">${svgContent}</svg>`;
          await new Promise<void>((resolve) => {
            const blob = new Blob([svgStr], { type: "image/svg+xml" });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
              ctx.drawImage(img, 0, 0);
              URL.revokeObjectURL(url);
              resolve();
            };
            img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
            img.src = url;
          });
          }
        }

        return composite;
      },
    }));

    // 스트로크나 레이어 변경 시 캔버스 다시 그리기
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      redrawAllStrokes(canvas, strokes, selectedStrokeIds, layers ?? []);
    }, [strokes, selectedStrokeIds, layers]);

    const getCanvasPoint = useCallback(
      (e: React.MouseEvent | React.PointerEvent): StrokePoint => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
          x: (e.clientX - rect.left) / scale,
          y: (e.clientY - rect.top) / scale,
        };
      },
      [scale]
    );

    // 스트로크 선택 도구 - 클릭한 점에 가장 가까운 스트로크 찾기
    const findStrokeAtPoint = useCallback(
      (pt: StrokePoint): Stroke | null => {
        // 역순으로 탐색 (위에 그린 것 먼저)
        for (let i = strokes.length - 1; i >= 0; i--) {
          const s = strokes[i];
          if (isPointOnStroke(pt, s, Math.max(10, s.size / 2 + 6))) return s;
        }
        return null;
      },
      [strokes]
    );

    // 두 점 사이 선분 위에 있는 모든 스트로크 찾기 (stroke-eraser 드래그용)
    const findStrokesOnLine = useCallback(
      (a: StrokePoint, b: StrokePoint): Stroke[] => {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.max(1, Math.ceil(dist / 8));
        const foundIds = new Set<string>();
        const foundStrokes: Stroke[] = [];
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const sample = { x: a.x + dx * t, y: a.y + dy * t };
          const hit = findStrokeAtPoint(sample);
          if (hit && !foundIds.has(hit.id)) {
            foundIds.add(hit.id);
            foundStrokes.push(hit);
          }
        }
        return foundStrokes;
      },
      [findStrokeAtPoint]
    );

    // 라소 영역 안에 있는 스트로크 찾기
    const findStrokesInRect = useCallback(
      (rect: { x: number; y: number; w: number; h: number }): string[] => {
        const x1 = rect.w >= 0 ? rect.x : rect.x + rect.w;
        const y1 = rect.h >= 0 ? rect.y : rect.y + rect.h;
        const x2 = x1 + Math.abs(rect.w);
        const y2 = y1 + Math.abs(rect.h);
        return strokes
          .filter((s) => {
            const b = s.bbox;
            return b.x < x2 && b.x + b.w > x1 && b.y < y2 && b.y + b.h > y1;
          })
          .map((s) => s.id);
      },
      [strokes]
    );

    const handleMouseDown = useCallback(
      (e: React.MouseEvent | React.PointerEvent) => {
        if (isPinching) return;
        if (activeTool === "balloon") return;
        if (activeTool === "hand") {
          isPanning.current = true;
          panStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
          return;
        }
        if (activeTool === "zoom") {
          if (e.button === 0) onZoomIn();
          else onZoomOut();
          return;
        }
        if (activeTool === "eyedropper") return;
        if (activeTool === "select" || activeTool === "move") return;

        const pt = getCanvasPoint(e);

        // 스트로크 선택 도구
        if (activeTool === "stroke-select") {
          const hit = findStrokeAtPoint(pt);
          if (hit) {
            // 이미 선택된 스트로크 클릭 → 이동 시작
            if (selectedStrokeIds.includes(hit.id)) {
              strokeMoveRef.current = { startX: pt.x, startY: pt.y, movedX: 0, movedY: 0 };
              setIsMovingStrokes(true);
            } else {
              // Shift 누르면 추가 선택
              if (e.shiftKey) {
                onSelectStrokeIds([...selectedStrokeIds, hit.id]);
              } else {
                onSelectStrokeIds([hit.id]);
              }
              strokeMoveRef.current = { startX: pt.x, startY: pt.y, movedX: 0, movedY: 0 };
              setIsMovingStrokes(true);
            }
          } else {
            // 빈 공간 클릭 → 라소 시작
            if (!e.shiftKey) onSelectStrokeIds([]);
            lassoStart.current = pt;
            isLassoing.current = true;
            setLassoRect({ x: pt.x, y: pt.y, w: 0, h: 0 });
          }
          return;
        }

        // 선 지우개 도구
        if (activeTool === "stroke-eraser") {
          const hit = findStrokeAtPoint(pt);
          if (hit) {
            onDeleteStrokes([hit.id]);
          }
          isDrawing.current = true;
          lastPoint.current = pt;
          return;
        }

        // 스포이드 도구
        if (activeTool === "eyedropper") {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          const imageData = ctx.getImageData(Math.round(pt.x), Math.round(pt.y), 1, 1);
          const [r, g, b] = [imageData.data[0], imageData.data[1], imageData.data[2]];
          const hex = "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
          // 색상 변경은 부모에서 처리해야 하지만 여기서는 console만
          // 실제로는 onColorPick 같은 prop이 필요하지만 우선 콘솔 로깅
          // eslint-disable-next-line no-console
          console.log("Eyedropper color:", hex);
          return;
        }

        // 텍스트 도구
        if (activeTool === "text") {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const rect = canvas.getBoundingClientRect();
          const screenX = e.clientX - rect.left;
          const screenY = e.clientY - rect.top;
          setTextInput({ x: screenX, y: screenY, canvasX: pt.x, canvasY: pt.y });
          setTextValue("");
          setTimeout(() => textInputRef.current?.focus(), 30);
          return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        isDrawing.current = true;
        currentStrokePoints.current = [pt];
        lastPoint.current = pt;
        startPoint.current = pt;

        if (activeTool === "fill") {
          ctx.fillStyle = foregroundColor;
          ctx.globalAlpha = opacity / 100;
          ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
          ctx.globalAlpha = 1;
          // fill도 stroke으로 저장해서 undo/clear 가능하게
          onAddStroke({
            tool: "fill",
            points: [
              { x: 0, y: 0 },
              { x: CANVAS_W, y: 0 },
              { x: CANVAS_W, y: CANVAS_H },
              { x: 0, y: CANVAS_H },
              { x: 0, y: 0 },
            ],
            color: foregroundColor,
            size: 0,
            opacity,
          });
          return;
        }
      },
      [
        activeTool, foregroundColor, getCanvasPoint, onZoomIn, onZoomOut, onAddStroke,
        opacity, panOffset, findStrokeAtPoint, selectedStrokeIds,
        onSelectStrokeIds, onDeleteStrokes, isPinching,
      ]
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent | React.PointerEvent) => {
        if (isPinching) return;
        const pt = getCanvasPoint(e);
        setCursorPos(pt);

        if (isPanning.current && panStart.current) {
          setPanOffset({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
          return;
        }

        // 스트로크 이동
        if (isMovingStrokes && strokeMoveRef.current && selectedStrokeIds.length > 0) {
          const dx = pt.x - strokeMoveRef.current.startX - strokeMoveRef.current.movedX;
          const dy = pt.y - strokeMoveRef.current.startY - strokeMoveRef.current.movedY;
          strokeMoveRef.current.movedX += dx;
          strokeMoveRef.current.movedY += dy;
          onMoveStrokes(selectedStrokeIds, dx, dy);
          return;
        }

        // 라소 드래그
        if (isLassoing.current && lassoStart.current) {
          const rect = {
            x: lassoStart.current.x,
            y: lassoStart.current.y,
            w: pt.x - lassoStart.current.x,
            h: pt.y - lassoStart.current.y,
          };
          setLassoRect(rect);
          return;
        }

        // 선 지우개 - 드래그하면서 지우기 (보간으로 누락 방지)
        if (activeTool === "stroke-eraser" && isDrawing.current) {
          if (lastPoint.current) {
            const toDelete = findStrokesOnLine(lastPoint.current, pt);
            if (toDelete.length > 0) {
              onDeleteStrokes(toDelete.map((s) => s.id));
            }
          }
          lastPoint.current = pt;
          return;
        }

        if (!isDrawing.current) return;

        const canvas = canvasRef.current;
        const overlay = overlayRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        if (["line", "rect", "ellipse"].includes(activeTool)) {
          if (!overlay) return;
          const octx = overlay.getContext("2d");
          if (!octx) return;
          octx.clearRect(0, 0, CANVAS_W, CANVAS_H);
          if (startPoint.current) {
            octx.save();
            octx.globalAlpha = opacity / 100;
            octx.strokeStyle = foregroundColor;
            octx.lineWidth = brushSize;
            octx.lineCap = "round";
            octx.beginPath();
            if (activeTool === "line") {
              octx.moveTo(startPoint.current.x, startPoint.current.y);
              octx.lineTo(pt.x, pt.y);
              octx.stroke();
            } else if (activeTool === "rect") {
              octx.strokeRect(startPoint.current.x, startPoint.current.y, pt.x - startPoint.current.x, pt.y - startPoint.current.y);
            } else if (activeTool === "ellipse") {
              const rx = Math.abs(pt.x - startPoint.current.x) / 2;
              const ry = Math.abs(pt.y - startPoint.current.y) / 2;
              const cx = startPoint.current.x + (pt.x - startPoint.current.x) / 2;
              const cy = startPoint.current.y + (pt.y - startPoint.current.y) / 2;
              octx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
              octx.stroke();
            }
            octx.restore();
          }
          return;
        }

        // 일반 그리기 - 실시간 렌더링 + 포인트 수집
        if (lastPoint.current) {
          ctx.save();
          ctx.globalAlpha = opacity / 100;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          // 경도에 따른 blur 필터
          const blurAmount = getBlurFromHardness(hardness);
          if (blurAmount > 0.1) {
            ctx.filter = `blur(${blurAmount}px)`;
          }

          if (activeTool === "eraser") {
            ctx.globalCompositeOperation = "destination-out";
            ctx.strokeStyle = "rgba(0,0,0,1)";
            ctx.lineWidth = brushSize;
          } else {
            ctx.globalCompositeOperation = "source-over";
            ctx.strokeStyle = foregroundColor;
            ctx.lineWidth = brushSize;
          }

          ctx.beginPath();
          ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
          ctx.lineTo(pt.x, pt.y);
          ctx.stroke();
          ctx.restore();
        }

        currentStrokePoints.current.push(pt);
        lastPoint.current = pt;
      },
      [
        activeTool, brushSize, foregroundColor, getCanvasPoint, opacity, hardness,
        isMovingStrokes, selectedStrokeIds, onMoveStrokes,
        findStrokeAtPoint, onDeleteStrokes, isPinching,
      ]
    );

    const handleMouseUp = useCallback(
      (e: React.MouseEvent | React.PointerEvent) => {
        if (isPanning.current) {
          isPanning.current = false;
          panStart.current = null;
          return;
        }

        // 스트로크 이동 종료
        if (isMovingStrokes) {
          setIsMovingStrokes(false);
          strokeMoveRef.current = null;
          return;
        }

        // 라소 종료
        if (isLassoing.current && lassoRect) {
          const found = findStrokesInRect(lassoRect);
          if (found.length > 0) {
            onSelectStrokeIds(found);
          }
          isLassoing.current = false;
          lassoStart.current = null;
          setLassoRect(null);
          return;
        }

        if (!isDrawing.current) return;
        isDrawing.current = false;

        const canvas = canvasRef.current;
        const overlay = overlayRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const pt = getCanvasPoint(e);

        // 도형 완성
        if (["line", "rect", "ellipse"].includes(activeTool)) {
          if (startPoint.current) {
            // 도형도 스트로크로 저장 (선택/이동 가능하게)
            const pts: StrokePoint[] = [];
            if (activeTool === "line") {
              pts.push(startPoint.current, pt);
            } else if (activeTool === "rect") {
              const s = startPoint.current;
              pts.push(s, { x: pt.x, y: s.y }, pt, { x: s.x, y: pt.y }, s);
            } else if (activeTool === "ellipse") {
              const steps = 36;
              const rx = Math.abs(pt.x - startPoint.current.x) / 2;
              const ry = Math.abs(pt.y - startPoint.current.y) / 2;
              const cx = startPoint.current.x + (pt.x - startPoint.current.x) / 2;
              const cy = startPoint.current.y + (pt.y - startPoint.current.y) / 2;
              for (let i = 0; i <= steps; i++) {
                const angle = (i / steps) * Math.PI * 2;
                pts.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
              }
            }
            onAddStroke({ tool: activeTool, points: pts, color: foregroundColor, size: brushSize, opacity });
          }
          if (overlay) {
            const octx = overlay.getContext("2d");
            octx?.clearRect(0, 0, CANVAS_W, CANVAS_H);
          }
        } else if (!["fill", "eyedropper", "text"].includes(activeTool)) {
          // 일반 그리기 스트로크 저장
          const pts = currentStrokePoints.current;
          if (pts.length >= 2) {
            onAddStroke({ tool: activeTool, points: pts, color: foregroundColor, size: brushSize, opacity, hardness });
          }
        }

        // 도형 오버레이 제거
        if (overlay) {
          const octx = overlay.getContext("2d");
          octx?.clearRect(0, 0, CANVAS_W, CANVAS_H);
        }

        currentStrokePoints.current = [];
        lastPoint.current = null;
        startPoint.current = null;
      },
      [
        activeTool, foregroundColor, brushSize, opacity, hardness, getCanvasPoint,
        isMovingStrokes, lassoRect, findStrokesInRect, onSelectStrokeIds, onAddStroke,
      ]
    );

    // 터치펜/터치 전용 Pointer 이벤트 핸들러 (PointerCapture로 탤바스 밖 이동시에도 이벤트 유지)
    const handlePointerDown = useCallback(
      (e: React.PointerEvent) => {
        if (e.pointerType === "pen" || e.pointerType === "touch") {
          e.preventDefault();
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }
        handleMouseDown(e as unknown as React.MouseEvent);
      },
      [handleMouseDown]
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent) => {
        if (e.pointerType === "pen" || e.pointerType === "touch") {
          e.preventDefault();
        }
        handleMouseMove(e as unknown as React.MouseEvent);
      },
      [handleMouseMove]
    );

    const handlePointerUp = useCallback(
      (e: React.PointerEvent) => {
        if (e.pointerType === "pen" || e.pointerType === "touch") {
          e.preventDefault();
        }
        handleMouseUp(e as unknown as React.MouseEvent);
      },
      [handleMouseUp]
    );

  const handleClearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    }
    onClearAllStrokes?.();
    setSelectedImgId(null);
    setSelectedLayerImgIds([]);
  }, [onClearAllStrokes, setSelectedImgId, setSelectedLayerImgIds]);
    const handleImgMouseDown = useCallback(
      (e: React.MouseEvent, imgId: string) => {
        e.stopPropagation();
        e.preventDefault();
        setSelectedImgId(imgId);
        const img = canvasImages.find((i) => i.id === imgId);
        if (!img) return;
        imgDragRef.current = { startX: e.clientX, startY: e.clientY, origX: img.x, origY: img.y };
        setIsDraggingImg(true);
      },
      [canvasImages]
    );

    const handleImgResizeMouseDown = useCallback(
      (e: React.MouseEvent, imgId: string) => {
        e.stopPropagation();
        const img = canvasImages.find((i) => i.id === imgId);
        if (!img) return;
        imgResizeRef.current = { startX: e.clientX, startY: e.clientY, origW: img.w, origH: img.h, origX: img.x, origY: img.y, aspectRatio: img.w / img.h };
        setIsResizingImg(true);
      },
      [canvasImages]
    );

    const handleImgRotateMouseDown = useCallback(
      (e: React.MouseEvent, imgId: string) => {
        e.stopPropagation();
        const img = canvasImages.find((i) => i.id === imgId);
        if (!img) return;
        const cx = (img.x + img.w / 2) * scale;
        const cy = (img.y + img.h / 2) * scale;
        imgRotateRef.current = { startX: e.clientX, startY: e.clientY, origRotation: img.rotation ?? 0, centerX: cx, centerY: cy };
        setIsRotatingImg(true);
      },
      [canvasImages, scale]
    );

    const handleImgMouseMove = useCallback(
      (e: React.MouseEvent) => {
        if (isDraggingImg && imgDragRef.current && selectedImgId) {
          const dx = (e.clientX - imgDragRef.current.startX) / scale;
          const dy = (e.clientY - imgDragRef.current.startY) / scale;
          onUpdateCanvasImage?.(
            selectedImgId,
            imgDragRef.current.origX + dx,
            imgDragRef.current.origY + dy,
            canvasImages.find((i) => i.id === selectedImgId)?.w ?? 400,
            canvasImages.find((i) => i.id === selectedImgId)?.h ?? 400
          );
        }
        if (isResizingImg && imgResizeRef.current && selectedImgId) {
          const { startX, startY, origW, origH, origX, origY, aspectRatio } = imgResizeRef.current;
          const dx = (e.clientX - startX) / scale;
          const dy = (e.clientY - startY) / scale;
          const useDx = Math.abs(dx) >= Math.abs(dy);
          let newW: number, newH: number, newX: number, newY: number;
          if (useDx) {
            newW = Math.max(50, origW + dx);
            newH = newW / aspectRatio;
          } else {
            newH = Math.max(50, origH + dy);
            newW = newH * aspectRatio;
          }
          const clamped = clampToCanvas(origX, origY, newW, newH);
          onUpdateCanvasImage?.(selectedImgId, clamped.x, clamped.y, newW, newH);
        }
        if (isRotatingImg && imgRotateRef.current && selectedImgId) {
          const { startX, startY, centerX, centerY, origRotation } = imgRotateRef.current;
          const startAngle = Math.atan2(startY - centerY, startX - centerX);
          const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
          const deltaDeg = ((currentAngle - startAngle) * 180) / Math.PI;
          let newRotation = origRotation + deltaDeg;
          newRotation = ((newRotation % 360) + 360) % 360;
          const img = canvasImages.find((i) => i.id === selectedImgId);
          onUpdateCanvasImage?.(selectedImgId, img?.x ?? 0, img?.y ?? 0, img?.w ?? 400, img?.h ?? 400, newRotation);
        }
      },
      [isDraggingImg, isResizingImg, isRotatingImg, selectedImgId, scale, canvasImages, onUpdateCanvasImage]
    );

    const handleImgMouseUp = useCallback(() => {
      setIsDraggingImg(false);
      setIsResizingImg(false);
      setIsRotatingImg(false);
      imgDragRef.current = null;
      imgResizeRef.current = null;
      imgRotateRef.current = null;
    }, []);

    // ── 레이어 이미지(캐릭터/배경) 핸들러 ──
    const handleLayerImgMouseDown = useCallback(
      (e: React.MouseEvent, layerId: string) => {
        e.stopPropagation();
        // Shift+클릭: 다중 선택 토글
        if (e.shiftKey) {
          setSelectedLayerImgIds((prev) =>
            prev.includes(layerId) ? prev.filter((id) => id !== layerId) : [...prev, layerId]
          );
          return;
        }
        // 일반 클릭: 단일 선택
        if (!selectedLayerImgIds.includes(layerId)) {
          setSelectedLayerImgIds([layerId]);
        }
        // 드래그 준비 (선택된 모든 레이어)
        const selIds = selectedLayerImgIds.includes(layerId) ? selectedLayerImgIds : [layerId];
        const positions = selIds.map((id) => {
          const l = layers.find((l2) => l2.id === id);
          return { id, x: l?.imgX ?? 0, y: l?.imgY ?? 0 };
        });
        layerImgDragRef.current = { startX: e.clientX, startY: e.clientY, origPositions: positions };
        setIsDraggingLayerImg(true);
      },
      [layers, selectedLayerImgIds]
    );

    const handleLayerImgResizeMouseDown = useCallback(
      (e: React.MouseEvent, layerId: string) => {
        e.stopPropagation();
        const layer = layers.find((l) => l.id === layerId);
        if (!layer || layer.imgW === undefined || layer.imgH === undefined) return;
        const selIds = selectedLayerImgIds.includes(layerId) ? selectedLayerImgIds : [layerId];
        const data = selIds.map((id) => {
          const l = layers.find((l2) => l2.id === id);
          const lw = l?.imgW ?? 400;
          const lh = l?.imgH ?? 400;
          return {
            id,
            x: l?.imgX ?? 0,
            y: l?.imgY ?? 0,
            w: lw,
            h: lh,
            aspectRatio: lw / lh,
          };
        });
        layerImgResizeRef.current = { startX: e.clientX, startY: e.clientY, origData: data };
        setIsResizingLayerImg(true);
      },
      [layers, selectedLayerImgIds]
    );

    const handleLayerImgRotateMouseDown = useCallback(
      (e: React.MouseEvent, layerId: string) => {
        e.stopPropagation();
        const layer = layers.find((l) => l.id === layerId);
        if (!layer || layer.imgX === undefined || layer.imgY === undefined) return;
        const selIds = selectedLayerImgIds.includes(layerId) ? selectedLayerImgIds : [layerId];
        const origAngles = selIds.map((id) => {
          const l = layers.find((l2) => l2.id === id);
          return { id, rotation: l?.imgRotation ?? 0 };
        });
        // 중심점 (캐릭터 이미지의 화면상 중심)
        const centerScreenX = (layer.imgX + (layer.imgW ?? 400) / 2) * scale;
        const centerScreenY = (layer.imgY + (layer.imgH ?? 400) / 2) * scale;
        layerImgRotateRef.current = { startX: e.clientX, startY: e.clientY, origAngles, centerX: centerScreenX, centerY: centerScreenY };
        setIsRotatingLayerImg(true);
      },
      [layers, selectedLayerImgIds, scale]
    );

    const handleLayerImgMouseMove = useCallback(
      (e: React.MouseEvent) => {
        if (isDraggingLayerImg && layerImgDragRef.current) {
          const dx = (e.clientX - layerImgDragRef.current.startX) / scale;
          const dy = (e.clientY - layerImgDragRef.current.startY) / scale;
          for (const { id, x, y } of layerImgDragRef.current.origPositions) {
            const layer = layers.find((l) => l.id === id);
            const lw = layer?.imgW ?? 400;
            const lh = layer?.imgH ?? 400;
            const clamped = clampToCanvas(x + dx, y + dy, lw, lh);
            onUpdateLayerImage?.(id, clamped.x, clamped.y, lw, lh);
          }
        }
        if (isResizingLayerImg && layerImgResizeRef.current) {
          const dx = (e.clientX - layerImgResizeRef.current.startX) / scale;
          const dy = (e.clientY - layerImgResizeRef.current.startY) / scale;
          for (const { id, x, y, w, h, aspectRatio } of layerImgResizeRef.current.origData) {
            const useDx = Math.abs(dx) >= Math.abs(dy);
            let newW: number, newH: number, newX: number, newY: number;
            if (useDx) {
              newW = Math.max(50, w + dx);
              newH = newW / aspectRatio;
              const dh2 = newH - h;
              newX = x - dh2 / 2;
              newY = y - dh2 / 2;
            } else {
              newH = Math.max(50, h + dy);
              newW = newH * aspectRatio;
              const dw2 = newW - w;
              newX = x - dw2 / 2;
              newY = y - dw2 / 2;
            }
            const clamped = clampToCanvas(newX, newY, newW, newH);
            onUpdateLayerImage?.(id, clamped.x, clamped.y, newW, newH);
          }
        }
        if (isRotatingLayerImg && layerImgRotateRef.current) {
          const { startX, startY, centerX, centerY, origAngles } = layerImgRotateRef.current;
          const startAngle = Math.atan2(startY - centerY, startX - centerX);
          const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
          const deltaDeg = ((currentAngle - startAngle) * 180) / Math.PI;
          for (const { id, rotation } of origAngles) {
            let newRotation = rotation + deltaDeg;
            // 0~360 범위로 정규화
            newRotation = ((newRotation % 360) + 360) % 360;
            const layer = layers.find((l) => l.id === id);
            onUpdateLayerImage?.(id, layer?.imgX ?? 0, layer?.imgY ?? 0, layer?.imgW ?? 400, layer?.imgH ?? 400, newRotation);
          }
        }
      },
      [isDraggingLayerImg, isResizingLayerImg, isRotatingLayerImg, scale, layers, onUpdateLayerImage]
    );

    const handleLayerImgMouseUp = useCallback(() => {
      setIsDraggingLayerImg(false);
      setIsResizingLayerImg(false);
      setIsRotatingLayerImg(false);
      layerImgDragRef.current = null;
      layerImgResizeRef.current = null;
      layerImgRotateRef.current = null;
    }, []);

    const commitTextInput = useCallback(() => {
      if (!textInput || !textValue.trim()) {
        setTextInput(null);
        setTextValue("");
        return;
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.save();
          ctx.font = `${brushSize * 2}px "Noto Sans KR", sans-serif`;
          ctx.fillStyle = foregroundColor;
          ctx.globalAlpha = opacity / 100;
          ctx.fillText(textValue.trim(), textInput.canvasX, textInput.canvasY);
          ctx.restore();
        }
      }
      setTextInput(null);
      setTextValue("");
    }, [textInput, textValue, brushSize, foregroundColor, opacity]);

    // 마우스 휠로 선택된 이미지 확대/축소 (캐릭터/배경 레이어 + AI 이미지)
    const handleWheel = useCallback(
      (e: React.WheelEvent) => {
        // AI 캔버스 이미지 줌
        if (selectedImgId) {
          e.preventDefault();
          const img = canvasImages.find((i) => i.id === selectedImgId);
          if (!img) return;
          const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
          const newW = Math.max(50, Math.min(2000, img.w * zoomFactor));
          const newH = Math.max(50, Math.min(2000, img.h * zoomFactor));
          const dw = newW - img.w;
          const dh = newH - img.h;
          const newX = img.x - dw / 2;
          const newY = img.y - dh / 2;
          const clamped = clampToCanvas(newX, newY, newW, newH);
          onUpdateCanvasImage?.(selectedImgId, clamped.x, clamped.y, newW, newH);
          return;
        }

        if (selectedLayerImgIds.length === 0) return;

        e.preventDefault();

        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        for (const id of selectedLayerImgIds) {
          const layer = layers.find((l) => l.id === id);
          if (!layer || layer.imgW === undefined || layer.imgH === undefined || layer.imgX === undefined || layer.imgY === undefined) continue;

          const newW = Math.max(50, Math.min(2000, layer.imgW * zoomFactor));
          const newH = Math.max(50, Math.min(2000, layer.imgH * zoomFactor));
          const dw = newW - layer.imgW;
          const dh = newH - layer.imgH;
          const newX = layer.imgX - dw / 2;
          const newY = layer.imgY - dh / 2;
          const clamped = clampToCanvas(newX, newY, newW, newH);

          onUpdateLayerImage?.(id, clamped.x, clamped.y, newW, newH);
        }
      },
      [selectedLayerImgIds, layers, onUpdateLayerImage]
    );

    // ── 핀치 투 줌 핸들러 ──
    const getTouchDistance = (touches: React.TouchList): number => {
      if (touches.length < 2) return 0;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = getTouchDistance(e.touches);
        pinchRef.current = { initialDist: dist, lastZoom: zoom };
        setIsPinching(true);
      }
    }, [zoom]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const dist = getTouchDistance(e.touches);
        const threshold = 15;
        const diff = dist - pinchRef.current.initialDist;

        if (Math.abs(diff) >= threshold) {
          const steps = Math.floor(Math.abs(diff) / threshold);
          if (diff > 0) {
            for (let i = 0; i < steps; i++) onZoomIn();
          } else {
            for (let i = 0; i < steps; i++) onZoomOut();
          }
          pinchRef.current.initialDist = dist;
        }
      }
    }, [onZoomIn, onZoomOut]);

    const handleTouchEnd = useCallback(() => {
      pinchRef.current = null;
      setIsPinching(false);
    }, []);

    const getCursor = () => {
      if (isDraggingImg || isDraggingLayerImg) return "grabbing";
      if (isResizingImg || isResizingLayerImg) return "nwse-resize";
      if (isRotatingImg || isRotatingLayerImg) return "grabbing";
      if (isMovingStrokes) return "grabbing";
      if (activeTool === "stroke-select") return "default";
      if (activeTool === "stroke-eraser") return "crosshair";
      if (activeTool === "balloon") return "crosshair";
      if (activeTool === "hand") return "grab";
      if (activeTool === "zoom") return "zoom-in";
      if (activeTool === "eyedropper") return "crosshair";
      if (activeTool === "move" || activeTool === "select") return "default";
      return "crosshair";
    };

    // 라소 오버레이 렌더링 (SVG)
    const lassoDisplay = lassoRect
      ? {
          left: Math.min(lassoRect.x, lassoRect.x + lassoRect.w) * scale,
          top: Math.min(lassoRect.y, lassoRect.y + lassoRect.h) * scale,
          width: Math.abs(lassoRect.w) * scale,
          height: Math.abs(lassoRect.h) * scale,
        }
      : null;

    return (
      <div className="flex-1 flex flex-col bg-[#0d0d0d] relative overflow-hidden">
        {/* 상단 옵션 바 */}
        <div className="relative z-20 flex items-center h-9 bg-[#111] border-b border-[#2a2a2a] shrink-0">
          {/* 왼쪽: 스크롤 가능한 도구 안내 영역 */}
          <div className="flex-1 flex items-center gap-3 px-4 min-w-0 overflow-x-auto">
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => { if (onToggleRuler) onToggleRuler(); else setShowRuler((v) => !v); }}
                className={`flex items-center gap-1 px-2 h-6 rounded text-[10px] cursor-pointer transition-colors whitespace-nowrap ${
                  effectiveShowRuler ? "bg-orange-500/20 text-orange-400" : "text-[#666] hover:bg-[#2a2a2a] hover:text-[#aaa]"
                }`}
              >
                <i className="ri-ruler-line" /> 눈금자
              </button>
              <button
                onClick={() => { if (onToggleGrid) onToggleGrid(); else setShowGrid((v) => !v); }}
                className={`flex items-center gap-1 px-2 h-6 rounded text-[10px] cursor-pointer transition-colors whitespace-nowrap ${
                  effectiveShowGrid ? "bg-orange-500/20 text-orange-400" : "text-[#666] hover:bg-[#2a2a2a] hover:text-[#aaa]"
                }`}
              >
                <i className="ri-grid-line" /> 격자
              </button>
            </div>
            <div className="w-px h-4 bg-[#2a2a2a] shrink-0" />

            {/* 스트로크 선택 도구 안내 */}
            {activeTool === "stroke-select" && (
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1.5 px-2 h-6 bg-orange-500/10 rounded text-[10px] text-orange-400 whitespace-nowrap">
                  <i className="ri-cursor-line" />
                  클릭: 선 선택 · 드래그: 영역 선택 · Shift+클릭: 추가 선택
                </div>
                {selectedStrokeIds.length > 0 && (
                  <>
                    <div className="text-[10px] text-orange-300 whitespace-nowrap">
                      {selectedStrokeIds.length}개 선택됨
                    </div>
                    <button
                      onClick={onSelectAllStrokes}
                      className="flex items-center gap-1 px-2 h-6 bg-[#2a2a2a] rounded text-[10px] text-[#aaa] hover:bg-[#333] cursor-pointer transition-colors whitespace-nowrap"
                    >
                      전체 선택
                    </button>
                    <button
                      onClick={() => onDeleteStrokes(selectedStrokeIds)}
                      className="flex items-center gap-1 px-2 h-6 bg-red-500/20 rounded text-[10px] text-red-400 hover:bg-red-500/30 cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <i className="ri-delete-bin-line" /> 선택 삭제
                    </button>
                  </>
                )}
                {selectedStrokeIds.length === 0 && (
                  <button
                    onClick={onSelectAllStrokes}
                    className="flex items-center gap-1 px-2 h-6 bg-[#2a2a2a] rounded text-[10px] text-[#aaa] hover:bg-[#333] cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <i className="ri-checkbox-multiple-line" /> 전체 선택
                  </button>
                )}
              </div>
            )}

            {activeTool === "stroke-eraser" && (
              <div className="flex items-center gap-1.5 px-2 h-6 bg-red-500/10 rounded text-[10px] text-red-400 whitespace-nowrap shrink-0">
                <i className="ri-eraser-line" />
                선 위에 클릭하거나 드래그하면 해당 선이 삭제됩니다
              </div>
            )}

            {activeTool === "eyedropper" && (
              <div className="flex items-center gap-1.5 px-2 h-6 bg-emerald-500/10 rounded text-[10px] text-emerald-400 whitespace-nowrap shrink-0">
                <i className="ri-eye-2-line" />
                캔버스 위에 클릭하면 픽셀 색상을 추출합니다
              </div>
            )}

            {activeTool === "text" && (
              <div className="flex items-center gap-1.5 px-2 h-6 bg-blue-500/10 rounded text-[10px] text-blue-400 whitespace-nowrap shrink-0">
                <i className="ri-text" />
                캔버스 위에 클릭하면 텍스트를 입력합니다
              </div>
            )}

            {activeTool === "hand" && (
              <div className="flex items-center gap-1.5 px-2 h-6 bg-[#333] rounded text-[10px] text-[#888] whitespace-nowrap shrink-0">
                <i className="ri-drag-move-2-line" />
                드래그하면 화면을 이동합니다
              </div>
            )}

            {activeTool === "zoom" && (
              <div className="flex items-center gap-1.5 px-2 h-6 bg-[#333] rounded text-[10px] text-[#888] whitespace-nowrap shrink-0">
                <i className="ri-zoom-in-line" />
                좌클릭: 확대 · 우클릭: 축소
              </div>
            )}

            {activeTool === "balloon" && (
              <div className="flex items-center gap-1.5 px-2 h-6 bg-pink-500/10 rounded text-[10px] text-pink-400 whitespace-nowrap shrink-0">
                <i className="ri-chat-1-line" />
                캔버스 클릭 → 말풍선 배치 · 더블클릭 → 텍스트 입력
              </div>
            )}

            {selectedImgId && (
              (() => {
                const selImg = canvasImages.find((i) => i.id === selectedImgId);
                const iw = selImg?.w ?? 400;
                const ih = selImg?.h ?? 400;
                const irot = selImg?.rotation ?? 0;
                const handleImgZoom = (factor: number) => {
                  if (!selImg) return;
                  const newW = Math.max(50, Math.min(2000, selImg.w * factor));
                  const newH = Math.max(50, Math.min(2000, selImg.h * factor));
                  const dw = newW - selImg.w;
                  const dh = newH - selImg.h;
                  const clamped = clampToCanvas(selImg.x - dw / 2, selImg.y - dh / 2, newW, newH);
                  onUpdateCanvasImage?.(selectedImgId, clamped.x, clamped.y, newW, newH);
                };
                return (
              <div className="flex items-center gap-1.5 px-2 h-6 bg-orange-500/10 rounded text-[10px] text-orange-400 whitespace-nowrap shrink-0">
                <i className="ri-image-line" />
                AI 이미지: 드래그·휠·핸들로 확대축소/회전
                <span className="w-px h-3 bg-[#333] mx-0.5" />
                <button
                  onClick={() => handleImgZoom(0.9)}
                  title="축소"
                  className="px-1.5 py-0.5 bg-[#2a2a2a] text-[#aaa] rounded text-[9px] cursor-pointer hover:bg-[#333] transition-colors whitespace-nowrap"
                >
                  <i className="ri-zoom-out-line" />
                </button>
                <span className="text-[9px] text-[#ccc] font-mono">{Math.round(iw)}×{Math.round(ih)}</span>
                <button
                  onClick={() => handleImgZoom(1.1)}
                  title="확대"
                  className="px-1.5 py-0.5 bg-[#2a2a2a] text-[#aaa] rounded text-[9px] cursor-pointer hover:bg-[#333] transition-colors whitespace-nowrap"
                >
                  <i className="ri-zoom-in-line" />
                </button>
                <span className="w-px h-3 bg-[#333] mx-0.5" />
                <button
                  onClick={() => {
                    if (!selImg) return;
                    const newRot = ((irot + 15) % 360);
                    onUpdateCanvasImage?.(selectedImgId, selImg.x, selImg.y, selImg.w, selImg.h, newRot);
                  }}
                  title="15° 회전"
                  className="px-1.5 py-0.5 bg-[#2a2a2a] text-[#aaa] rounded text-[9px] cursor-pointer hover:bg-[#333] transition-colors whitespace-nowrap"
                >
                  <i className="ri-loop-right-line" />
                </button>
                <span className="w-px h-3 bg-[#333] mx-0.5" />
                <button
                  onClick={() => onUpdateCanvasImageLayerPosition?.(selectedImgId, "up")}
                  title="레이어 뒤로"
                  className="px-1.5 py-0.5 bg-[#2a2a2a] text-[#aaa] rounded text-[9px] cursor-pointer hover:bg-[#333] transition-colors whitespace-nowrap"
                >
                  <i className="ri-arrow-up-s-line" />
                </button>
                <span className="text-[9px] text-[#666]">{canvasImages.find((i) => i.id === selectedImgId)?.layerPosition ?? layers.length}/{layers.length}</span>
                <button
                  onClick={() => onUpdateCanvasImageLayerPosition?.(selectedImgId, "down")}
                  title="레이어 앞으로"
                  className="px-1.5 py-0.5 bg-[#2a2a2a] text-[#aaa] rounded text-[9px] cursor-pointer hover:bg-[#333] transition-colors whitespace-nowrap"
                >
                  <i className="ri-arrow-down-s-line" />
                </button>
                <span className="w-px h-3 bg-[#333] mx-0.5" />
                <button
                  onClick={() => { onDeleteCanvasImage?.(selectedImgId); setSelectedImgId(null); setSelectedLayerImgIds([]); }}
                  className="ml-1 px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[9px] cursor-pointer hover:bg-red-500/30 transition-colors whitespace-nowrap"
                >
                  <i className="ri-delete-bin-line" /> 삭제
                </button>
              </div>
                );
              })()
            )}

            {selectedLayerImgIds.length > 0 && (() => {
              const selLayer = layers.find((l) => l.id === selectedLayerImgIds[0]);
              const lw = selLayer?.imgW ?? 480;
              const lh = selLayer?.imgH ?? 680;
              const count = selectedLayerImgIds.length;
              const isBgSelected = selLayer?.type === "background";
              const layerLabel = isBgSelected ? "배경" : "캐릭터";
              const handleCharZoom = (factor: number) => {
                for (const id of selectedLayerImgIds) {
                  const l = layers.find((l2) => l2.id === id);
                  if (!l || l.imgW === undefined || l.imgH === undefined || l.imgX === undefined || l.imgY === undefined) continue;
                  const newW = Math.max(50, Math.min(2000, l.imgW * factor));
                  const newH = Math.max(50, Math.min(2000, l.imgH * factor));
                  const dw = newW - l.imgW;
                  const dh = newH - l.imgH;
                  const clamped = clampToCanvas(l.imgX - dw / 2, l.imgY - dh / 2, newW, newH);
                  onUpdateLayerImage?.(id, clamped.x, clamped.y, newW, newH);
                }
              };
              return (
              <div className="flex items-center gap-1.5 px-2 h-6 bg-orange-500/10 rounded text-[10px] text-orange-400 whitespace-nowrap shrink-0">
                <i className={isBgSelected ? "ri-landscape-line" : "ri-user-line"} />
                {count > 1 ? <span className="text-[9px] bg-orange-500/30 px-1 rounded">{count}개</span> : null}
                {layerLabel}: 드래그·휠·핸들로 확대축소/회전
                <span className="w-px h-3 bg-[#333] mx-0.5" />
                <button
                  onClick={() => handleCharZoom(0.9)}
                  title="축소"
                  className="px-1.5 py-0.5 bg-[#2a2a2a] text-[#aaa] rounded text-[9px] cursor-pointer hover:bg-[#333] transition-colors whitespace-nowrap"
                >
                  <i className="ri-zoom-out-line" />
                </button>
                <span className="text-[9px] text-[#ccc] font-mono">{Math.round(lw)}×{Math.round(lh)}</span>
                <button
                  onClick={() => handleCharZoom(1.1)}
                  title="확대"
                  className="px-1.5 py-0.5 bg-[#2a2a2a] text-[#aaa] rounded text-[9px] cursor-pointer hover:bg-[#333] transition-colors whitespace-nowrap"
                >
                  <i className="ri-zoom-in-line" />
                </button>
                <span className="w-px h-3 bg-[#333] mx-0.5" />
                <button
                  onClick={() => {
                    for (const id of selectedLayerImgIds) {
                      const l = layers.find((l2) => l2.id === id);
                      if (!l) continue;
                      const currentRotation = l.imgRotation ?? 0;
                      onUpdateLayerImage?.(id, l.imgX ?? 0, l.imgY ?? 0, l.imgW ?? 400, l.imgH ?? 400, ((currentRotation + 15) % 360));
                    }
                  }}
                  title="15° 회전"
                  className="px-1.5 py-0.5 bg-[#2a2a2a] text-[#aaa] rounded text-[9px] cursor-pointer hover:bg-[#333] transition-colors whitespace-nowrap"
                >
                  <i className="ri-loop-right-line" />
                </button>
                <button
                  onClick={() => { setSelectedLayerImgIds([]); }}
                  className="ml-1 px-1 py-0.5 text-[#666] hover:text-[#aaa] cursor-pointer whitespace-nowrap"
                  title="선택 해제"
                >
                  <i className="ri-close-line" />
                </button>
              </div>
              );
            })()}

            <div className="flex items-center gap-2 text-[10px] text-[#555] shrink-0">
              {cursorPos && activeTool !== "balloon" && (
                <span className="whitespace-nowrap">
                  X: <span className="text-[#888]">{Math.round(cursorPos.x)}</span>
                  &nbsp;Y: <span className="text-[#888]">{Math.round(cursorPos.y)}</span>
                </span>
              )}
            </div>
          </div>

          {/* 오른쪽: 항상 고정된 캔버스 지우기 버튼 */}
          <div className="relative z-30 flex items-center gap-1 px-4 border-l border-[#2a2a2a] shrink-0">
            <button
              onClick={handleClearCanvas}
              className="relative z-30 flex items-center gap-1 px-2 h-6 rounded text-[10px] text-[#666] hover:bg-[#2a2a2a] hover:text-[#aaa] cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-delete-bin-line" /> 캔버스 지우기
            </button>
          </div>
        </div>

        {/* 눈금자 */}
        {effectiveShowRuler && (
          <div className="absolute top-9 left-0 right-0 h-5 bg-[#1a1a1a] border-b border-[#2a2a2a] z-10 overflow-hidden">
            <div className="flex h-full items-end pb-0.5 pl-5">
              {Array.from({ length: 40 }).map((_, i) => (
                <div key={i} className="flex items-end" style={{ width: 50 * scale }}>
                  <div className="w-px h-2 bg-[#444]" />
                  <span className="text-[7px] text-[#555] ml-0.5 whitespace-nowrap">{i * 50}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {effectiveShowRuler && (
          <div className="absolute left-0 top-9 bottom-0 w-5 bg-[#1a1a1a] border-r border-[#2a2a2a] z-10 overflow-hidden">
            <div className="flex flex-col items-end pr-0.5 pt-5">
              {Array.from({ length: 50 }).map((_, i) => (
                <div key={i} className="flex items-center" style={{ height: 50 * scale }}>
                  <span className="text-[7px] text-[#555] whitespace-nowrap" style={{ writingMode: "vertical-rl" }}>{i * 50}</span>
                  <div className="h-px w-2 bg-[#444]" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 캔버스 스크롤 영역 */}
        <div
          className="flex-1 overflow-auto flex items-start justify-start"
          style={{ paddingTop: effectiveShowRuler ? 20 : 0, paddingLeft: effectiveShowRuler ? 20 : 0 }}
          onMouseMove={(e) => { handleImgMouseMove(e); handleLayerImgMouseMove(e); }}
          onMouseUp={(e) => { handleImgMouseUp(e); handleLayerImgMouseUp(e); }}
          onMouseLeave={(e) => { handleImgMouseUp(e); handleLayerImgMouseUp(e); }}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          {/* 격자 배경 */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />

          {/* 캔버스 래퍼 */}
          <div
            className="relative flex-shrink-0 m-8"
            style={{
              width: CANVAS_W * scale,
              height: CANVAS_H * scale,
              transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
              boxShadow: "0 0 0 1px #333, 0 8px 40px rgba(0,0,0,0.8)",
            }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) { setSelectedImgId(null); setSelectedLayerImgIds([]); } }}
          >
            {/* ── 흰 배경 레이어 (맨 아래) ── */}
            <div
              className="absolute top-0 left-0 bg-white"
              style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, zIndex: 1 }}
            />

            {/* ── 배경 + 캐릭터 레이어 이미지 — 드래그/리사이즈/회전 가능 ── */}
            {layers.filter((l) => (l.type === "background" || l.type === "character") && l.imageUrl && l.visible && l.imgX !== undefined && l.imgY !== undefined).map((layer) => {
              const lx = layer.imgX ?? (layer.type === "background" ? 0 : 160);
              const ly = layer.imgY ?? (layer.type === "background" ? 0 : 210);
              const lw = layer.imgW ?? (layer.type === "background" ? CANVAS_W : 480);
              const lh = layer.imgH ?? (layer.type === "background" ? CANVAS_H : 680);
              const rotation = layer.imgRotation ?? 0;
              const isSelected = selectedLayerImgIds.includes(layer.id);
              const isPrimary = isSelected && selectedLayerImgIds[0] === layer.id;
              const layerTypeLabel = layer.type === "background" ? "배경" : "캐릭터";
              const layerIdx = layers.findIndex((l) => l.id === layer.id);
              const layerZ = 2 + layerIdx;
              return (
                <div
                  key={layer.id}
                  className="absolute"
                  style={{
                    left: lx * scale,
                    top: ly * scale,
                    width: lw * scale,
                    height: lh * scale,
                    zIndex: layerZ,
                    opacity: layer.opacity / 100,
                    outline: isSelected ? "2px solid #f97316" : "none",
                    outlineOffset: "1px",
                    cursor: isDraggingLayerImg && isSelected ? "grabbing" : "grab",
                    transformOrigin: "center center",
                    transform: rotation !== 0 ? `rotate(${rotation}deg)` : "none",
                  }}
                  onMouseDown={(e) => handleLayerImgMouseDown(e, layer.id)}
                >
                  <img
                    src={layer.imageUrl}
                    alt={layer.name}
                    className="w-full h-full"
                    style={{ objectFit: "fill", display: "block", userSelect: "none", pointerEvents: "none" }}
                    draggable={false}
                  />
                  {isSelected && (
                    <>
                      <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-orange-500 rounded-full border-2 border-white" />
                      <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-orange-500 rounded-full border-2 border-white" />
                      <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-orange-500 rounded-full border-2 border-white" />
                      <div
                        className="absolute -bottom-2 -right-2 w-4 h-4 bg-orange-500 rounded-sm border-2 border-white cursor-nwse-resize flex items-center justify-center"
                        onMouseDown={(e) => { e.stopPropagation(); handleLayerImgResizeMouseDown(e, layer.id); }}
                      >
                        <i className="ri-arrow-right-down-line text-white" style={{ fontSize: 8 }} />
                      </div>
                      <div
                        className="absolute -top-6 left-1/2 -translate-x-1/2 w-4 h-4 bg-green-500 rounded-full border-2 border-white cursor-grab flex items-center justify-center"
                        onMouseDown={(e) => { e.stopPropagation(); handleLayerImgRotateMouseDown(e, layer.id); }}
                      >
                        <i className="ri-loop-right-line text-white" style={{ fontSize: 7 }} />
                      </div>
                      {isPrimary && (
                        <div className="absolute -bottom-5 left-0 text-[9px] text-orange-400 whitespace-nowrap bg-[#111]/80 px-1 rounded">
                          {layer.name} · {Math.round(lw)} × {Math.round(lh)}{rotation !== 0 ? ` · ${Math.round(rotation)}°` : ""}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {/* ── 이미지 레이어 (흰 배경 위, 드로잉 아래) ── */}
            {canvasImages.map((img) => {
              const isSelected = selectedImgId === img.id;
              const canvasImgZ = 2 + (img.layerPosition ?? layers.length);
              const rotation = img.rotation ?? 0;
              return (
                <div
                  key={img.id}
                  className="absolute"
                  style={{
                    left: img.x * scale,
                    top: img.y * scale,
                    width: img.w * scale,
                    height: img.h * scale,
                    zIndex: canvasImgZ,
                    outline: isSelected ? "2px solid #f97316" : "none",
                    outlineOffset: "1px",
                    cursor: isDraggingImg && isSelected ? "grabbing" : "grab",
                    transformOrigin: "center center",
                    transform: rotation !== 0 ? `rotate(${rotation}deg)` : "none",
                  }}
                  onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                  onMouseDown={(e) => handleImgMouseDown(e, img.id)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    src={img.url}
                    alt="canvas-layer"
                    className="w-full h-full"
                    style={{ objectFit: "fill", display: "block", userSelect: "none", pointerEvents: "none" }}
                    draggable={false}
                  />
                  {isSelected && (
                    <>
                      <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-orange-500 rounded-full border-2 border-white" />
                      <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-orange-500 rounded-full border-2 border-white" />
                      <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-orange-500 rounded-full border-2 border-white" />
                      <div
                        className="absolute -bottom-2 -right-2 w-4 h-4 bg-orange-500 rounded-sm border-2 border-white cursor-nwse-resize flex items-center justify-center"
                        onMouseDown={(e) => { e.stopPropagation(); handleImgResizeMouseDown(e, img.id); }}
                      >
                        <i className="ri-arrow-right-down-line text-white" style={{ fontSize: 8 }} />
                      </div>
                      <div
                        className="absolute -top-6 left-1/2 -translate-x-1/2 w-4 h-4 bg-green-500 rounded-full border-2 border-white cursor-grab flex items-center justify-center"
                        onMouseDown={(e) => { e.stopPropagation(); handleImgRotateMouseDown(e, img.id); }}
                      >
                        <i className="ri-loop-right-line text-white" style={{ fontSize: 7 }} />
                      </div>
                      <button
                        className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-lg shadow-black/40 flex items-center justify-center cursor-pointer z-10 hover:bg-red-600 hover:scale-110 transition-all"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); onDeleteCanvasImage?.(img.id); setSelectedImgId(null); }}
                        title="이미지 삭제"
                      >
                        <i className="ri-close-line text-white font-bold" style={{ fontSize: 12 }} />
                      </button>
                      <div className="absolute -bottom-5 left-0 text-[9px] text-orange-400 whitespace-nowrap bg-[#111]/80 px-1 rounded">
                        {Math.round(img.w)} × {Math.round(img.h)}{rotation !== 0 ? ` · ${Math.round(rotation)}°` : ""}
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {/* ── 메인 드로잉 캔버스 ── */}
            {(() => {
              const selectedLayerIndex = layers.findIndex(l => l.id === selectedLayerId);
              const strokeBaseZ = selectedLayerIndex >= 0 ? 2 + selectedLayerIndex : 5 + layers.length;
              return (
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="absolute top-0 left-0 origin-top-left"
              style={{
                transform: `scale(${scale})`,
                cursor: getCursor(),
                imageRendering: zoom > 200 ? "pixelated" : "auto",
                zIndex: strokeBaseZ,
                background: "transparent",
                touchAction: "none",
                pointerEvents: (activeTool === "select" || activeTool === "move") ? "none" : "auto",
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
              );
            })()}

            {/* 오버레이 캔버스 (도형 미리보기) */}
            {(() => {
              const selectedLayerIndex = layers.findIndex(l => l.id === selectedLayerId);
              const strokeBaseZ = selectedLayerIndex >= 0 ? 2 + selectedLayerIndex : 5 + layers.length;
              return (
            <canvas
              ref={overlayRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="absolute top-0 left-0 origin-top-left pointer-events-none"
              style={{ transform: `scale(${scale})`, zIndex: strokeBaseZ + 1 }}
            />
              );
            })()}

            {/* 라소 선택 영역 표시 */}
            {lassoDisplay && (
              <div
                className="absolute pointer-events-none border border-dashed border-orange-400 bg-orange-400/10"
                style={{
                  left: lassoDisplay.left,
                  top: lassoDisplay.top,
                  width: lassoDisplay.width,
                  height: lassoDisplay.height,
                  zIndex: (layers.findIndex(l => l.id === selectedLayerId) >= 0 ? 2 + layers.findIndex(l => l.id === selectedLayerId)! : 5 + layers.length) + 2,
                }}
              />
            )}

            {/* 텍스트 인라인 입력창 */}
            {textInput && (
              <div
                className="absolute z-[20] flex items-center"
                style={{ left: textInput.x, top: textInput.y }}
              >
                <input
                  ref={textInputRef}
                  type="text"
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitTextInput();
                    if (e.key === "Escape") { setTextInput(null); setTextValue(""); }
                  }}
                  onBlur={commitTextInput}
                  placeholder="텍스트 입력 후 Enter"
                  className="outline-none border-b-2 border-orange-400 bg-transparent px-1 text-sm"
                  style={{
                    fontFamily: '"Noto Sans KR", sans-serif',
                    fontSize: Math.max(12, brushSize * 2 * scale),
                    color: foregroundColor,
                    minWidth: 120,
                    caretColor: foregroundColor,
                  }}
                />
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={commitTextInput}
                  className="ml-1 px-2 py-0.5 bg-orange-500 text-white text-xs rounded cursor-pointer whitespace-nowrap"
                >
                  확인
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setTextInput(null); setTextValue(""); }}
                  className="ml-1 px-2 py-0.5 bg-[#333] text-[#aaa] text-xs rounded cursor-pointer whitespace-nowrap"
                >
                  취소
                </button>
              </div>
            )}

            {/* 말풍선 SVG 오버레이 */}
            {(() => {
              const selectedLayerIndex = layers.findIndex(l => l.id === selectedLayerId);
              const strokeBaseZ = selectedLayerIndex >= 0 ? 2 + selectedLayerIndex : 5 + layers.length;
              const visibleLayerIds = new Set(layers.filter(l => l.visible).map(l => l.id));
              const visibleBalloons = balloons.filter(b => visibleLayerIds.has(b.layerId));
              return (
            <div style={{ zIndex: strokeBaseZ + 3, position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}>
              <BalloonOverlay
                balloons={visibleBalloons}
                selectedBalloonId={selectedBalloonId}
                scale={scale}
                activeTool={activeTool}
                onSelect={onSelectBalloon}
                onAddBalloon={onAddBalloon}
                onUpdateText={onUpdateBalloonText}
                onUpdatePosition={onUpdateBalloonPosition}
                onUpdateSize={onUpdateBalloonSize}
                onDelete={onDeleteBalloon}
              />
            </div>
              );
            })()}

            {/* 격자 오버레이 */}
            {effectiveShowGrid && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(100,100,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(100,100,255,0.1) 1px, transparent 1px)",
                  backgroundSize: `${50 * scale}px ${50 * scale}px`,
                  zIndex: (layers.findIndex(l => l.id === selectedLayerId) >= 0 ? 2 + layers.findIndex(l => l.id === selectedLayerId)! : 5 + layers.length) + 4,
                }}
              />
            )}

            {/* 가이드라인 오버레이 */}
            {guideVisible && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  zIndex: (layers.findIndex(l => l.id === selectedLayerId) >= 0 ? 2 + layers.findIndex(l => l.id === selectedLayerId)! : 5 + layers.length) + 4,
                }}
              >
                {/* 3분할 가이드 (세로) */}
                {[1/3, 2/3].map((frac, i) => (
                  <div
                    key={`gv-${i}`}
                    className="absolute top-0 h-full"
                    style={{
                      left: `${CANVAS_W * scale * frac}px`,
                      borderLeft: "1px dashed rgba(0,200,200,0.25)",
                    }}
                  />
                ))}
                {/* 3분할 가이드 (가로) */}
                {[1/3, 2/3].map((frac, i) => (
                  <div
                    key={`gh-${i}`}
                    className="absolute left-0 w-full"
                    style={{
                      top: `${CANVAS_H * scale * frac}px`,
                      borderTop: "1px dashed rgba(0,200,200,0.25)",
                    }}
                  />
                ))}
                {/* 중앙 십자선 */}
                <div
                  className="absolute top-0 h-full"
                  style={{
                    left: `${CANVAS_W * scale / 2}px`,
                    borderLeft: "1px solid rgba(0,200,200,0.15)",
                  }}
                />
                <div
                  className="absolute left-0 w-full"
                  style={{
                    top: `${CANVAS_H * scale / 2}px`,
                    borderTop: "1px solid rgba(0,200,200,0.15)",
                  }}
                />
              </div>
            )}

            {/* 브러시 커서 미리보기 */}
            {cursorPos && !["select", "move", "hand", "zoom", "eyedropper", "balloon", "stroke-select"].includes(activeTool) && (
              <div
                className="absolute pointer-events-none border border-[#888] rounded-full"
                style={{
                  width: brushSize * scale,
                  height: brushSize * scale,
                  left: cursorPos.x * scale - (brushSize * scale) / 2,
                  top: cursorPos.y * scale - (brushSize * scale) / 2,
                  opacity: 0.6,
                  zIndex: (layers.findIndex(l => l.id === selectedLayerId) >= 0 ? 2 + layers.findIndex(l => l.id === selectedLayerId)! : 5 + layers.length) + 5,
                }}
              />
            )}

            {/* 선 지우개 커서 */}
            {cursorPos && activeTool === "stroke-eraser" && (
              <div
                className="absolute pointer-events-none border-2 border-red-400 rounded-full"
                style={{
                  width: Math.max(brushSize, 20) * scale,
                  height: Math.max(brushSize, 20) * scale,
                  left: cursorPos.x * scale - (Math.max(brushSize, 20) * scale) / 2,
                  top: cursorPos.y * scale - (Math.max(brushSize, 20) * scale) / 2,
                  opacity: 0.8,
                  zIndex: (layers.findIndex(l => l.id === selectedLayerId) >= 0 ? 2 + layers.findIndex(l => l.id === selectedLayerId)! : 5 + layers.length) + 5,
                }}
              />
            )}
          </div>
        </div>

        {/* 줌 컨트롤 */}
        <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-1 py-1 z-20">
          <button onClick={onZoomOut} className="w-7 h-7 flex items-center justify-center text-[#888] hover:text-[#ccc] cursor-pointer rounded hover:bg-[#2a2a2a] transition-colors">
            <i className="ri-subtract-line text-sm" />
          </button>
          <button onClick={onResetZoom} className="px-2 text-xs text-[#888] hover:text-[#ccc] cursor-pointer rounded hover:bg-[#2a2a2a] transition-colors h-7 flex items-center whitespace-nowrap">
            {zoom}%
          </button>
          <button onClick={onZoomIn} className="w-7 h-7 flex items-center justify-center text-[#888] hover:text-[#ccc] cursor-pointer rounded hover:bg-[#2a2a2a] transition-colors">
            <i className="ri-add-line text-sm" />
          </button>
        </div>

        {/* 캔버스 정보 */}
        <div className="absolute bottom-4 left-6 text-[10px] text-[#444] whitespace-nowrap z-20">
          {CANVAS_W} × {CANVAS_H}px · 웹툰 세로형
        </div>
      </div>
    );
  }
);

export default DrawingCanvas;