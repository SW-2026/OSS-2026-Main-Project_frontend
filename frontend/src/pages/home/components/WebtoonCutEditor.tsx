import { useState, useRef, useCallback, useEffect } from "react";

export interface StrokeLine {
  id: string;
  points: { x: number; y: number }[];
  strokeWidth: number;
  strokeColor: string;
  opacity: number;
  selected: boolean;
  // bounding box for hit testing
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface FillRegion {
  id: string;
  x: number;
  y: number;
  color: string;
  opacity: number;
  // flood fill pixel data stored as ImageData
  pixels: { x: number; y: number }[];
}

interface WebtoonCutEditorProps {
  imageUrl: string;
  width: number;
  height: number;
  onClose: () => void;
  onApplyToCanvas: (canvas: HTMLCanvasElement) => void;
}

type EditMode = "select" | "move" | "fill" | "stroke-edit" | "erase";

// ── Sobel edge detection ──────────────────────────────────────────────────────
function detectEdges(imageData: ImageData, threshold = 60): Uint8ClampedArray {
  const { data, width, height } = imageData;
  const out = new Uint8ClampedArray(width * height);
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
          const ki = (ky + 1) * 3 + (kx + 1);
          gx += sobelX[ki] * gray;
          gy += sobelY[ki] * gray;
        }
      }
      const mag = Math.sqrt(gx * gx + gy * gy);
      out[y * width + x] = mag > threshold ? 255 : 0;
    }
  }
  return out;
}

// ── Trace edge pixels into stroke lines ──────────────────────────────────────
function traceStrokes(edgeMap: Uint8ClampedArray, width: number, height: number): StrokeLine[] {
  const visited = new Uint8Array(width * height);
  const lines: StrokeLine[] = [];
  const dirs = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
  let id = 0;

  for (let sy = 0; sy < height; sy += 1) {
    for (let sx = 0; sx < width; sx += 1) {
      if (!edgeMap[sy * width + sx] || visited[sy * width + sx]) continue;
      const pts: { x: number; y: number }[] = [];
      let cx = sx, cy = sy, steps = 0;
      while (steps < 3000) {
        const idx = cy * width + cx;
        if (visited[idx]) break;
        visited[idx] = 1;
        pts.push({ x: cx, y: cy });
        let found = false;
        for (const [dx, dy] of dirs) {
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height && edgeMap[ny * width + nx] && !visited[ny * width + nx]) {
            cx = nx; cy = ny; found = true; break;
          }
        }
        if (!found) break;
        steps++;
      }
      if (pts.length < 5) continue;
      // simplify
      const simplified = simplify(pts, 1.5);
      if (simplified.length < 2) continue;
      const xs = simplified.map(p => p.x);
      const ys = simplified.map(p => p.y);
      lines.push({
        id: `stroke-${id++}`,
        points: simplified,
        strokeWidth: 1.5,
        strokeColor: "#1a1a1a",
        opacity: 100,
        selected: false,
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys),
      });
      if (lines.length >= 500) return lines;
    }
  }
  return lines;
}

function simplify(pts: { x: number; y: number }[], tol: number) {
  if (pts.length <= 2) return pts;
  const res = [pts[0]];
  let last = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const dx = pts[i].x - pts[last].x;
    const dy = pts[i].y - pts[last].y;
    if (Math.sqrt(dx*dx + dy*dy) >= tol) { res.push(pts[i]); last = i; }
  }
  res.push(pts[pts.length - 1]);
  return res;
}

function ptsToPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    if (i >= 2) {
      const pp = pts[i-2], p = pts[i-1], c = pts[i];
      const cp1x = p.x + (c.x - pp.x) * 0.15;
      const cp1y = p.y + (c.y - pp.y) * 0.15;
      d += ` Q ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${c.x} ${c.y}`;
    } else {
      d += ` L ${pts[i].x} ${pts[i].y}`;
    }
  }
  return d;
}

// ── Flood fill ────────────────────────────────────────────────────────────────
function floodFill(
  edgeMap: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  maxPixels = 80000
): { x: number; y: number }[] {
  const visited = new Uint8Array(width * height);
  const queue: number[] = [startY * width + startX];
  const result: { x: number; y: number }[] = [];
  visited[startY * width + startX] = 1;

  while (queue.length > 0 && result.length < maxPixels) {
    const idx = queue.shift()!;
    const x = idx % width;
    const y = Math.floor(idx / width);
    if (edgeMap[idx]) continue; // edge pixel = boundary
    result.push({ x, y });
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const ni = ny * width + nx;
      if (!visited[ni]) { visited[ni] = 1; queue.push(ni); }
    }
  }
  return result;
}

export default function WebtoonCutEditor({ imageUrl, width, height, onClose, onApplyToCanvas }: WebtoonCutEditorProps) {
  const [mode, setMode] = useState<EditMode>("select");
  const [strokes, setStrokes] = useState<StrokeLine[]>([]);
  const [fills, setFills] = useState<FillRegion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<Set<string>>(new Set());
  const [fillColor, setFillColor] = useState("#ffccaa");
  const [fillOpacity, setFillOpacity] = useState(80);
  const [strokeColor, setStrokeColor] = useState("#1a1a1a");
  const [strokeWidth, setStrokeWidth] = useState(1.5);
  const [globalOpacity, setGlobalOpacity] = useState(100);
  const [showOriginal, setShowOriginal] = useState(true);
  const [originalOpacity, setOriginalOpacity] = useState(30);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; strokeId?: string } | null>(null);
  const [strokeOffset, setStrokeOffset] = useState<{ [id: string]: { dx: number; dy: number } }>({});

  const edgeMapRef = useRef<Uint8ClampedArray | null>(null);
  const edgeWidthRef = useRef(0);
  const edgeHeightRef = useRef(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fillCanvasRef = useRef<HTMLCanvasElement>(null);

  // ── Load image & extract strokes ──────────────────────────────────────────
  useEffect(() => {
    setIsLoading(true);
    setLoadError(false);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const maxDim = 600;
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      edgeWidthRef.current = w;
      edgeHeightRef.current = h;

      const offscreen = document.createElement("canvas");
      offscreen.width = w; offscreen.height = h;
      const ctx = offscreen.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const edgeMap = detectEdges(imageData, 55);
      edgeMapRef.current = edgeMap;

      const traced = traceStrokes(edgeMap, w, h);
      setStrokes(traced);
      setIsLoading(false);
    };
    img.onerror = () => { setLoadError(true); setIsLoading(false); };
    img.src = imageUrl;
  }, [imageUrl]);

  // ── Render fills onto fill canvas ─────────────────────────────────────────
  useEffect(() => {
    const canvas = fillCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    fills.forEach((fill) => {
      if (fill.pixels.length === 0) return;
      ctx.globalAlpha = fill.opacity / 100;
      ctx.fillStyle = fill.color;
      fill.pixels.forEach(({ x, y }) => {
        ctx.fillRect(x, y, 1, 1);
      });
      ctx.globalAlpha = 1;
    });
  }, [fills]);

  // ── SVG click handler ─────────────────────────────────────────────────────
  const handleSVGClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgW = edgeWidthRef.current || width;
    const svgH = edgeHeightRef.current || height;
    const scaleX = svgW / rect.width;
    const scaleY = svgH / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    if (mode === "fill") {
      const edgeMap = edgeMapRef.current;
      if (!edgeMap) return;
      const pixels = floodFill(edgeMap, edgeWidthRef.current, edgeHeightRef.current, x, y);
      if (pixels.length < 10) return;
      const newFill: FillRegion = {
        id: `fill-${Date.now()}`,
        x, y,
        color: fillColor,
        opacity: fillOpacity,
        pixels,
      };
      setFills((prev) => [...prev, newFill]);
    }
  }, [mode, fillColor, fillOpacity, width, height]);

  const handleStrokeClick = useCallback((e: React.MouseEvent, strokeId: string) => {
    e.stopPropagation();
    if (mode !== "select" && mode !== "move" && mode !== "stroke-edit") return;
    if (mode === "erase") {
      setStrokes((prev) => prev.filter((s) => s.id !== strokeId));
      return;
    }
    setSelectedStrokeIds((prev) => {
      const next = new Set(prev);
      if (e.shiftKey) {
        if (next.has(strokeId)) next.delete(strokeId);
        else next.add(strokeId);
      } else {
        if (next.has(strokeId) && next.size === 1) next.clear();
        else { next.clear(); next.add(strokeId); }
      }
      return next;
    });
  }, [mode]);

  // ── Drag to move selected strokes ─────────────────────────────────────────
  const handleStrokeMouseDown = useCallback((e: React.MouseEvent, strokeId: string) => {
    if (mode !== "move") return;
    e.stopPropagation();
    setSelectedStrokeIds((prev) => {
      const next = new Set(prev);
      if (!next.has(strokeId)) { next.clear(); next.add(strokeId); }
      return next;
    });
    setDragStart({ x: e.clientX, y: e.clientY, strokeId });
    setIsDragging(true);
  }, [mode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgW = edgeWidthRef.current || width;
    const scaleX = svgW / rect.width;
    const dx = (e.clientX - dragStart.x) * scaleX;
    const dy = (e.clientY - dragStart.y) * scaleX;
    const newOffsets: { [id: string]: { dx: number; dy: number } } = {};
    selectedStrokeIds.forEach((id) => {
      newOffsets[id] = { dx, dy };
    });
    setStrokeOffset(newOffsets);
  }, [isDragging, dragStart, selectedStrokeIds, width]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    // commit offsets into actual stroke positions
    setStrokes((prev) =>
      prev.map((s) => {
        const off = strokeOffset[s.id];
        if (!off) return s;
        const newPts = s.points.map((p) => ({ x: p.x + off.dx, y: p.y + off.dy }));
        const xs = newPts.map(p => p.x);
        const ys = newPts.map(p => p.y);
        return { ...s, points: newPts, minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
      })
    );
    setStrokeOffset({});
    setIsDragging(false);
    setDragStart(null);
  }, [isDragging, strokeOffset]);

  // ── Apply selected stroke style ───────────────────────────────────────────
  const applyStyleToSelected = useCallback(() => {
    if (selectedStrokeIds.size === 0) return;
    setStrokes((prev) =>
      prev.map((s) =>
        selectedStrokeIds.has(s.id)
          ? { ...s, strokeColor, strokeWidth, opacity: globalOpacity }
          : s
      )
    );
  }, [selectedStrokeIds, strokeColor, strokeWidth, globalOpacity]);

  const deleteSelected = useCallback(() => {
    setStrokes((prev) => prev.filter((s) => !selectedStrokeIds.has(s.id)));
    setSelectedStrokeIds(new Set());
  }, [selectedStrokeIds]);

  const clearFills = useCallback(() => setFills([]), []);

  const undoLastFill = useCallback(() => setFills((prev) => prev.slice(0, -1)), []);

  // ── Export to canvas ──────────────────────────────────────────────────────
  const handleApply = useCallback(() => {
    const offscreen = document.createElement("canvas");
    const ew = edgeWidthRef.current || width;
    const eh = edgeHeightRef.current || height;
    offscreen.width = ew;
    offscreen.height = eh;
    const ctx = offscreen.getContext("2d")!;

    // 1. fills
    const fillCanvas = fillCanvasRef.current;
    if (fillCanvas) ctx.drawImage(fillCanvas, 0, 0);

    // 2. strokes as SVG
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ew} ${eh}" width="${ew}" height="${eh}">
      ${strokes.map((s) => {
        const off = strokeOffset[s.id] || { dx: 0, dy: 0 };
        const pts = s.points.map(p => ({ x: p.x + off.dx, y: p.y + off.dy }));
        return `<path d="${ptsToPath(pts)}" stroke="${s.strokeColor}" stroke-width="${s.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${s.opacity / 100}"/>`;
      }).join("")}
    </svg>`;
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      onApplyToCanvas(offscreen);
      onClose();
    };
    img.src = url;
  }, [strokes, fills, strokeOffset, width, height, onApplyToCanvas, onClose]);

  const svgW = edgeWidthRef.current || width;
  const svgH = edgeHeightRef.current || height;

  const MODES: { key: EditMode; icon: string; label: string; desc: string }[] = [
    { key: "select", icon: "ri-cursor-line", label: "선택", desc: "선 클릭으로 선택" },
    { key: "move", icon: "ri-drag-move-line", label: "이동", desc: "선 드래그로 이동" },
    { key: "fill", icon: "ri-paint-fill", label: "채색", desc: "영역 클릭으로 색 채우기" },
    { key: "stroke-edit", icon: "ri-pen-nib-line", label: "선 편집", desc: "선 스타일 변경" },
    { key: "erase", icon: "ri-eraser-line", label: "선 지우기", desc: "선 클릭으로 삭제" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex bg-black/90">
      {/* ── 왼쪽 툴바 ── */}
      <div className="w-52 bg-[#111] border-r border-[#2a2a2a] flex flex-col shrink-0">
        <div className="flex items-center justify-between px-3 py-3 border-b border-[#2a2a2a]">
          <div>
            <h2 className="text-xs text-white font-semibold">웹툰 컷 편집기</h2>
            <p className="text-[9px] text-[#555] mt-0.5">선 이동 · 영역 채색</p>
          </div>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center text-[#666] hover:text-[#ccc] cursor-pointer rounded hover:bg-[#2a2a2a]">
            <i className="ri-close-line text-sm" />
          </button>
        </div>

        {/* 편집 모드 */}
        <div className="p-3 border-b border-[#2a2a2a]">
          <p className="text-[9px] text-[#555] uppercase tracking-wider mb-2">편집 모드</p>
          <div className="space-y-1">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[10px] transition-all cursor-pointer text-left ${
                  mode === m.key
                    ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                    : "text-[#888] hover:bg-[#1e1e1e] hover:text-[#ccc] border border-transparent"
                }`}
              >
                <i className={`${m.icon} text-xs w-3 h-3 flex items-center justify-center`} />
                <div>
                  <div className="font-medium whitespace-nowrap">{m.label}</div>
                  <div className="text-[8px] text-[#555] whitespace-nowrap">{m.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 채색 설정 */}
        {mode === "fill" && (
          <div className="p-3 border-b border-[#2a2a2a]">
            <p className="text-[9px] text-[#555] uppercase tracking-wider mb-2">채색 설정</p>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-[#888]">채색 색상</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded border border-[#333]" style={{ background: fillColor }} />
                    <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent" />
                  </div>
                </div>
                {/* 빠른 색상 팔레트 */}
                <div className="grid grid-cols-6 gap-1">
                  {["#ffccaa","#ffd6e0","#c8e6c9","#bbdefb","#fff9c4","#f3e5f5","#ffab91","#f48fb1","#a5d6a7","#90caf9","#fff176","#ce93d8","#1a1a1a","#555555","#888888","#cccccc","#ffffff","#e53935"].map((c) => (
                    <button
                      key={c}
                      onClick={() => setFillColor(c)}
                      className={`w-5 h-5 rounded cursor-pointer border-2 transition-all ${fillColor === c ? "border-orange-400 scale-110" : "border-transparent hover:border-[#555]"}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-[#888]">불투명도</span>
                  <span className="text-[10px] text-orange-400 font-mono">{fillOpacity}%</span>
                </div>
                <input type="range" min={10} max={100} value={fillOpacity} onChange={(e) => setFillOpacity(Number(e.target.value))}
                  className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
                  style={{ background: `linear-gradient(to right, #f97316 ${fillOpacity}%, #2a2a2a ${fillOpacity}%)` }}
                />
              </div>
              <div className="flex gap-1">
                <button onClick={undoLastFill} className="flex-1 py-1.5 rounded-lg text-[10px] text-[#888] bg-[#1e1e1e] hover:bg-[#2a2a2a] cursor-pointer transition-colors whitespace-nowrap border border-[#2a2a2a]">
                  <i className="ri-arrow-go-back-line mr-1" />되돌리기
                </button>
                <button onClick={clearFills} className="flex-1 py-1.5 rounded-lg text-[10px] text-red-400 bg-red-500/10 hover:bg-red-500/20 cursor-pointer transition-colors whitespace-nowrap border border-red-500/20">
                  <i className="ri-delete-bin-line mr-1" />전체 삭제
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 선 스타일 설정 */}
        {(mode === "select" || mode === "stroke-edit") && (
          <div className="p-3 border-b border-[#2a2a2a]">
            <p className="text-[9px] text-[#555] uppercase tracking-wider mb-2">
              선 스타일 {selectedStrokeIds.size > 0 && <span className="text-orange-400">({selectedStrokeIds.size}개 선택)</span>}
            </p>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-[#888]">색상</span>
                  <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-[#888]">굵기</span>
                  <span className="text-[10px] text-orange-400 font-mono">{strokeWidth}px</span>
                </div>
                <input type="range" min={0.5} max={8} step={0.5} value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))}
                  className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
                  style={{ background: `linear-gradient(to right, #f97316 ${strokeWidth * 12.5}%, #2a2a2a ${strokeWidth * 12.5}%)` }}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-[#888]">불투명도</span>
                  <span className="text-[10px] text-orange-400 font-mono">{globalOpacity}%</span>
                </div>
                <input type="range" min={10} max={100} value={globalOpacity} onChange={(e) => setGlobalOpacity(Number(e.target.value))}
                  className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
                  style={{ background: `linear-gradient(to right, #f97316 ${globalOpacity}%, #2a2a2a ${globalOpacity}%)` }}
                />
              </div>
              {selectedStrokeIds.size > 0 && (
                <div className="flex gap-1">
                  <button onClick={applyStyleToSelected} className="flex-1 py-1.5 rounded-lg text-[10px] text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 cursor-pointer transition-colors whitespace-nowrap border border-orange-500/20">
                    <i className="ri-check-line mr-1" />스타일 적용
                  </button>
                  <button onClick={deleteSelected} className="flex-1 py-1.5 rounded-lg text-[10px] text-red-400 bg-red-500/10 hover:bg-red-500/20 cursor-pointer transition-colors whitespace-nowrap border border-red-500/20">
                    <i className="ri-delete-bin-line mr-1" />삭제
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 원본 이미지 오버레이 */}
        <div className="p-3 border-b border-[#2a2a2a]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-[#888]">원본 이미지 참조</span>
            <button
              onClick={() => setShowOriginal((v) => !v)}
              className={`w-8 h-4 rounded-full transition-colors cursor-pointer relative ${showOriginal ? "bg-orange-500" : "bg-[#333]"}`}
            >
              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${showOriginal ? "left-4" : "left-0.5"}`} />
            </button>
          </div>
          {showOriginal && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-[#555]">투명도</span>
                <span className="text-[10px] text-[#888] font-mono">{originalOpacity}%</span>
              </div>
              <input type="range" min={5} max={80} value={originalOpacity} onChange={(e) => setOriginalOpacity(Number(e.target.value))}
                className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
                style={{ background: `linear-gradient(to right, #f97316 ${originalOpacity * 1.25}%, #2a2a2a ${originalOpacity * 1.25}%)` }}
              />
            </div>
          )}
        </div>

        {/* 통계 */}
        <div className="p-3 mt-auto border-t border-[#2a2a2a]">
          <div className="space-y-1 text-[9px] text-[#555]">
            <div className="flex justify-between">
              <span>추출된 선</span>
              <span className="text-[#888]">{strokes.length}개</span>
            </div>
            <div className="flex justify-between">
              <span>채색 영역</span>
              <span className="text-[#888]">{fills.length}개</span>
            </div>
            <div className="flex justify-between">
              <span>선택된 선</span>
              <span className="text-orange-400">{selectedStrokeIds.size}개</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 중앙 편집 영역 ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 상단 바 */}
        <div className="flex items-center gap-3 px-4 h-10 bg-[#111] border-b border-[#2a2a2a] shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] text-[#555]">
            <i className="ri-information-line text-orange-400" />
            {mode === "fill" && "영역을 클릭하면 색이 채워져요"}
            {mode === "select" && "선을 클릭해서 선택 · Shift+클릭으로 다중 선택"}
            {mode === "move" && "선을 드래그해서 이동하세요"}
            {mode === "stroke-edit" && "선 선택 후 왼쪽에서 스타일 변경 → 적용 버튼"}
            {mode === "erase" && "지울 선을 클릭하세요"}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#1a1a1a] rounded-lg px-1 py-1 border border-[#2a2a2a]">
              <button onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))} className="w-6 h-6 flex items-center justify-center text-[#888] hover:text-[#ccc] cursor-pointer rounded hover:bg-[#2a2a2a] transition-colors">
                <i className="ri-subtract-line text-xs" />
              </button>
              <span className="text-[10px] text-[#888] w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(3, z + 0.1))} className="w-6 h-6 flex items-center justify-center text-[#888] hover:text-[#ccc] cursor-pointer rounded hover:bg-[#2a2a2a] transition-colors">
                <i className="ri-add-line text-xs" />
              </button>
            </div>
            <button
              onClick={handleApply}
              className="flex items-center gap-1.5 px-4 h-7 rounded-lg bg-orange-500 hover:bg-orange-600 text-[10px] text-white font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-check-line text-xs" />
              캔버스에 적용
            </button>
          </div>
        </div>

        {/* 편집 캔버스 */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-[#0a0a0a] p-6">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 text-[#555]">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">선 추출 중...</p>
              <p className="text-[10px] text-[#444]">이미지에서 윤곽선을 분석하고 있어요</p>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center gap-3 text-[#555]">
              <i className="ri-error-warning-line text-3xl text-red-400" />
              <p className="text-xs text-red-400">이미지를 불러올 수 없어요</p>
              <p className="text-[10px] text-[#444]">CORS 제한으로 인해 외부 이미지는 처리할 수 없어요</p>
            </div>
          ) : (
            <div
              ref={containerRef}
              className="relative bg-white rounded-lg overflow-hidden"
              style={{
                width: svgW * zoom,
                height: svgH * zoom,
                cursor: mode === "fill" ? "crosshair" : mode === "move" ? (isDragging ? "grabbing" : "grab") : mode === "erase" ? "cell" : "default",
              }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* 원본 이미지 참조 레이어 */}
              {showOriginal && (
                <img
                  src={imageUrl}
                  alt="original"
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{ objectFit: "fill", opacity: originalOpacity / 100, zIndex: 0 }}
                  draggable={false}
                />
              )}

              {/* 채색 레이어 */}
              <canvas
                ref={fillCanvasRef}
                width={svgW}
                height={svgH}
                className="absolute inset-0 pointer-events-none"
                style={{ width: "100%", height: "100%", zIndex: 1 }}
              />

              {/* 선 SVG 레이어 */}
              <svg
                ref={svgRef}
                viewBox={`0 0 ${svgW} ${svgH}`}
                width="100%"
                height="100%"
                className="absolute inset-0"
                style={{ zIndex: 2 }}
                onClick={handleSVGClick}
              >
                {strokes.map((s) => {
                  const off = strokeOffset[s.id] || { dx: 0, dy: 0 };
                  const pts = s.points.map(p => ({ x: p.x + off.dx, y: p.y + off.dy }));
                  const isSelected = selectedStrokeIds.has(s.id);
                  return (
                    <g key={s.id}>
                      {/* 히트 영역 */}
                      <path
                        d={ptsToPath(pts)}
                        stroke="transparent"
                        strokeWidth={Math.max(s.strokeWidth + 10, 14)}
                        fill="none"
                        className="cursor-pointer"
                        onClick={(e) => handleStrokeClick(e, s.id)}
                        onMouseDown={(e) => handleStrokeMouseDown(e, s.id)}
                      />
                      {/* 선택 하이라이트 */}
                      {isSelected && (
                        <path
                          d={ptsToPath(pts)}
                          stroke="#f97316"
                          strokeWidth={s.strokeWidth + 3}
                          fill="none"
                          opacity={0.4}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="pointer-events-none"
                        />
                      )}
                      {/* 실제 선 */}
                      <path
                        d={ptsToPath(pts)}
                        stroke={isSelected ? "#f97316" : s.strokeColor}
                        strokeWidth={s.strokeWidth}
                        fill="none"
                        opacity={s.opacity / 100}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="pointer-events-none"
                      />
                    </g>
                  );
                })}
              </svg>

              {/* 채색 모드 힌트 오버레이 */}
              {mode === "fill" && (
                <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 3 }}>
                  <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 rounded text-[9px] text-orange-300">
                    <i className="ri-paint-fill mr-1" />클릭으로 채색
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 오른쪽 레이어 패널 ── */}
      <div className="w-44 bg-[#111] border-l border-[#2a2a2a] flex flex-col shrink-0">
        <div className="px-3 py-2.5 border-b border-[#2a2a2a]">
          <p className="text-[9px] text-[#555] uppercase tracking-wider">채색 레이어</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {fills.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-[#444] text-[10px] text-center">
              <i className="ri-paint-fill text-lg mb-1" />
              채색 영역이 없어요
            </div>
          ) : (
            [...fills].reverse().map((fill, i) => (
              <div key={fill.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] group">
                <div className="w-5 h-5 rounded border border-[#333] shrink-0" style={{ background: fill.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] text-[#888] truncate whitespace-nowrap">채색 {fills.length - i}</p>
                  <p className="text-[8px] text-[#555]">{fill.pixels.length.toLocaleString()}px</p>
                </div>
                <button
                  onClick={() => setFills((prev) => prev.filter((f) => f.id !== fill.id))}
                  className="w-4 h-4 flex items-center justify-center text-[#555] hover:text-red-400 cursor-pointer opacity-0 group-hover:opacity-100 transition-all"
                >
                  <i className="ri-close-line text-xs" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="px-3 py-2.5 border-t border-[#2a2a2a]">
          <p className="text-[9px] text-[#555] uppercase tracking-wider mb-2">선 레이어</p>
          <div className="text-[9px] text-[#555] space-y-1">
            <div className="flex justify-between">
              <span>총 선</span>
              <span className="text-[#888]">{strokes.length}개</span>
            </div>
            <div className="flex justify-between">
              <span>선택됨</span>
              <span className="text-orange-400">{selectedStrokeIds.size}개</span>
            </div>
          </div>
          {selectedStrokeIds.size > 0 && (
            <button
              onClick={() => setSelectedStrokeIds(new Set())}
              className="w-full mt-2 py-1 rounded text-[9px] text-[#666] hover:text-[#aaa] bg-[#1a1a1a] cursor-pointer transition-colors whitespace-nowrap"
            >
              선택 해제
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
