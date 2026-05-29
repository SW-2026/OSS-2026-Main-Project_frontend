import { supabase } from "@/lib/supabase";
import api from "@/lib/api";
import type { Stroke, Layer } from "@/hooks/useEditorState";
import type { BalloonItem } from "@/pages/home/components/BalloonPanel";

export interface CutExportData {
  strokes: Stroke[];
  balloons: BalloonItem[];
  canvasImages: { id: string; url: string; x: number; y: number; w: number; h: number; layerPosition?: number }[];
  layers: Layer[];
}

const CANVAS_W = 800;
const CANVAS_H = 1100;

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

function getCutDataKey(cutId: string): string {
  return `webtoon-cut-data:${cutId}`;
}

// --- Render helpers (duplicated from DrawingCanvas to keep it self-contained) ---

interface Point { x: number; y: number }

function renderStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  layers: Layer[]
) {
  if (stroke.points.length < 2) return;
  const layer = stroke.layerId ? layers.find((l) => l.id === stroke.layerId) : undefined;
  const layerOpacity = layer ? layer.opacity : 100;
  const layerBlendMode = layer ? layer.blendMode : "normal";
  const layerVisible = layer ? layer.visible : true;
  if (!layerVisible) return;

  ctx.save();
  const validBlendModes = [
    "source-over", "multiply", "screen", "overlay", "darken", "lighten",
    "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion",
    "hue", "saturation", "color", "luminosity",
  ];
  ctx.globalCompositeOperation = validBlendModes.includes(layerBlendMode) ? layerBlendMode : "source-over";
  const finalAlpha = (stroke.opacity / 100) * (layerOpacity / 100);
  ctx.globalAlpha = finalAlpha;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (stroke.tool === "fill") {
    ctx.fillStyle = stroke.color;
    ctx.globalAlpha = finalAlpha;
    if (stroke.points.length >= 4) {
      const minX = Math.min(...stroke.points.map((p: Point) => p.x));
      const minY = Math.min(...stroke.points.map((p: Point) => p.y));
      const maxX = Math.max(...stroke.points.map((p: Point) => p.x));
      const maxY = Math.max(...stroke.points.map((p: Point) => p.y));
      ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
    }
    ctx.restore();
    return;
  }
  if (stroke.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.lineWidth = stroke.size;
  } else if (stroke.tool === "pen") {
    ctx.globalCompositeOperation = layerBlendMode === "normal" ? "source-over" : layerBlendMode;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size * 0.6;
  } else if (stroke.tool === "pencil") {
    ctx.globalCompositeOperation = layerBlendMode === "normal" ? "source-over" : layerBlendMode;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size * 0.4;
    ctx.globalAlpha = finalAlpha * 0.7;
  } else if (stroke.tool === "marker") {
    ctx.globalCompositeOperation = layerBlendMode === "normal" ? "source-over" : layerBlendMode;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size * 2;
    ctx.globalAlpha = finalAlpha * 0.5;
  } else {
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

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// --- Public API ---

/** Load cut data from Supabase → backend history API → localStorage */
export async function loadCutExportData(cutId: string): Promise<CutExportData | null> {
  try {
    let data: any = null;

    if (isValidUUID(cutId)) {
      const { data: dbData, error } = await supabase
        .from("cut_data")
        .select("*")
        .eq("cut_id", cutId)
        .maybeSingle();
      if (error) throw error;
      if (dbData) {
        data = dbData;
      } else {
        data = await loadFromBackendHistory(cutId);
        if (!data) data = loadFromLocal(cutId);
      }
    } else {
      data = await loadFromBackendHistory(cutId);
      if (!data) data = loadFromLocal(cutId);
    }

    if (!data) return null;

    return {
      strokes: Array.isArray(data.strokes) ? data.strokes : [],
      balloons: Array.isArray(data.balloons) ? data.balloons : [],
      canvasImages: Array.isArray(data.canvas_images) ? data.canvas_images : [],
      layers: Array.isArray(data.layers) && data.layers.length > 0 ? data.layers : [],
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[cutExportUtils] Failed to load cut ${cutId}:`, err);
    return null;
  }
}

async function loadFromBackendHistory(panelId: string): Promise<any | null> {
  try {
    const listRes = await api.get(`/api/panels/${panelId}/history`);
    const historyList = listRes.data?.data ?? listRes.data ?? [];
    if (!Array.isArray(historyList) || historyList.length === 0) return null;
    const sorted = [...historyList].sort((a: any, b: any) => (b.version ?? 0) - (a.version ?? 0));
    const latest = sorted[0];
    if (latest.data) return latest.data;
    const version = latest.version;
    if (version != null) {
      const restoreRes = await api.post(`/api/panels/${panelId}/history/${version}/restore`);
      if (restoreRes.data?.data) return restoreRes.data.data;
    }
    return null;
  } catch {
    return null;
  }
}

function loadFromLocal(cutId: string): any | null {
  try {
    const stored = localStorage.getItem(getCutDataKey(cutId));
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/** Render cut data to an offscreen canvas, returns PNG data URL */
export async function renderCutToDataURL(
  data: CutExportData,
  format: "png" | "jpeg",
  quality: number,
  scale: number = 1
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Cannot get 2d context");

  // 1. White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // 2. Layer images (background / character)
  const layers = data.layers;
  for (const layer of layers) {
    if (!layer.imageUrl || !layer.visible) continue;
    if (layer.type !== "background" && layer.type !== "character") continue;
    try {
      const img = await loadImage(layer.imageUrl);
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
    } catch {
      // image load failed, skip
    }

    // AI images at this layer position
    const layerIdx = layers.findIndex((l) => l.id === layer.id);
    const imagesAtLevel = data.canvasImages.filter(
      (ci) => (ci.layerPosition ?? layers.length) === layerIdx
    );
    for (const cimg of imagesAtLevel) {
      try {
        const el = await loadImage(cimg.url);
        ctx.drawImage(el, cimg.x, cimg.y, cimg.w, cimg.h);
      } catch {
        // skip
      }
    }
  }

  // 3. Remaining AI images
  const remaining = data.canvasImages.filter(
    (ci) => (ci.layerPosition ?? layers.length) >= layers.length
  );
  for (const cimg of remaining) {
    try {
      const el = await loadImage(cimg.url);
      ctx.drawImage(el, cimg.x, cimg.y, cimg.w, cimg.h);
    } catch {
      // skip
    }
  }

  // 4. Strokes
  for (const stroke of data.strokes) {
    renderStroke(ctx, stroke, layers);
  }

  // 5. Balloons as SVG
  if (data.balloons.length > 0) {
    const tailPad = 18;
    const svgContent = data.balloons
      .map((b: BalloonItem) => {
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
        const strokeColor = b.borderColor || "#333333";
        const fill = b.bgColor || "#ffffff";

        const fontSize = b.fontSize ?? 16;
        const fontFamily = b.fontFamily ?? "sans-serif";
        const textColor = b.textColor || "#000000";
        const lines = (b.text || "").split("\n");
        const lineH = fontSize * 1.4;
        const totalTextH = lines.length * lineH;
        const textStartY = (bh - totalTextH) / 2 + fontSize;

        const textEls = lines
          .map((line: string, i: number) => {
            const escaped = line
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;");
            return `<text x="${b.width / 2}" y="${textStartY + i * lineH}" text-anchor="middle" font-size="${fontSize}" font-family="${fontFamily}" fill="${textColor}">${escaped}</text>`;
          })
          .join("");

        return `<g transform="translate(${b.x}, ${b.y})">
          <path d="${fullPath}" fill="${fill}" stroke="${strokeColor}" stroke-width="1.5" ${isDashed ? 'stroke-dasharray="6,3"' : ""} />
          ${textEls}
        </g>`;
      })
      .join("");

    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">${svgContent}</svg>`;
    try {
      const blob = new Blob([svgStr], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const svgImg = await loadImage(url);
      ctx.drawImage(svgImg, 0, 0);
      URL.revokeObjectURL(url);
    } catch {
      // skip
    }
  }

  // Final export with scale
  if (scale !== 1) {
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = Math.round(CANVAS_W * scale);
    exportCanvas.height = Math.round(CANVAS_H * scale);
    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) throw new Error("Cannot get 2d context for export");
    exportCtx.imageSmoothingEnabled = true;
    exportCtx.imageSmoothingQuality = "high";
    exportCtx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);
    const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
    return exportCanvas.toDataURL(mimeType, quality / 100);
  }

  const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
  return canvas.toDataURL(mimeType, quality / 100);
}