import { useCallback, useState } from "react";
import type { VectorPath } from "@/pages/home/components/VectorEditor";

// ─── Zhang-Suen 골격화 (Skeletonization) ───
// 이진 이미지의 선을 1px 두께 골격으로 축소
function zhangSuenThinning(binary: Uint8Array, width: number, height: number): Uint8Array {
  const skeleton = new Uint8Array(binary);
  let changed = true;

  const neighbors = (x: number, y: number): [number, number, number, number, number, number, number, number] => {
    const idx = (y - 1) * width + x;     const p2 = skeleton[idx] > 0 ? 1 : 0;
    const idx3 = (y - 1) * width + (x + 1); const p3 = skeleton[idx3] > 0 ? 1 : 0;
    const idx4 = y * width + (x + 1);       const p4 = skeleton[idx4] > 0 ? 1 : 0;
    const idx5 = (y + 1) * width + (x + 1); const p5 = skeleton[idx5] > 0 ? 1 : 0;
    const idx6 = (y + 1) * width + x;     const p6 = skeleton[idx6] > 0 ? 1 : 0;
    const idx7 = (y + 1) * width + (x - 1); const p7 = skeleton[idx7] > 0 ? 1 : 0;
    const idx8 = y * width + (x - 1);       const p8 = skeleton[idx8] > 0 ? 1 : 0;
    const idx9 = (y - 1) * width + (x - 1); const p9 = skeleton[idx9] > 0 ? 1 : 0;
    return [p2, p3, p4, p5, p6, p7, p8, p9];
  };

  while (changed) {
    changed = false;
    const toRemove: number[] = [];

    // ── Step 1 ──
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (skeleton[idx] === 0) continue;

        const [p2, p3, p4, p5, p6, p7, p8, p9] = neighbors(x, y);
        const nbrs = [p2, p3, p4, p5, p6, p7, p8, p9];
        const nCount = nbrs.reduce((a, b) => a + b, 0);
        if (nCount < 2 || nCount > 6) continue;

        let transitions = 0;
        for (let i = 0; i < 8; i++) {
          if (nbrs[i] === 0 && nbrs[(i + 1) % 8] === 1) transitions++;
        }
        if (transitions !== 1) continue;

        if (p2 * p4 * p6 !== 0) continue;
        if (p4 * p6 * p8 !== 0) continue;

        toRemove.push(idx);
      }
    }
    if (toRemove.length > 0) { changed = true; for (const i of toRemove) skeleton[i] = 0; }

    // ── Step 2 ──
    toRemove.length = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (skeleton[idx] === 0) continue;

        const [p2, p3, p4, p5, p6, p7, p8, p9] = neighbors(x, y);
        const nbrs = [p2, p3, p4, p5, p6, p7, p8, p9];
        const nCount = nbrs.reduce((a, b) => a + b, 0);
        if (nCount < 2 || nCount > 6) continue;

        let transitions = 0;
        for (let i = 0; i < 8; i++) {
          if (nbrs[i] === 0 && nbrs[(i + 1) % 8] === 1) transitions++;
        }
        if (transitions !== 1) continue;

        if (p2 * p4 * p8 !== 0) continue;
        if (p2 * p6 * p8 !== 0) continue;

        toRemove.push(idx);
      }
    }
    if (toRemove.length > 0) { changed = true; for (const i of toRemove) skeleton[i] = 0; }
  }

  return skeleton;
}

// ─── 골격에서 엔드포인트/분기점 기반 경로 추적 ───
function traceSkeletonPaths(skeleton: Uint8Array, width: number, height: number): VectorPath[] {
  const visited = new Uint8Array(width * height);
  const paths: VectorPath[] = [];
  let pathId = 0;
  const MAX_PATHS = 500;

  const countNeighbors = (x: number, y: number): number => {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && skeleton[ny * width + nx] > 0) count++;
      }
    }
    return count;
  };

  const DIRS: [number, number][] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

  // 엔드포인트 찾기 (이웃 1개 = 끝점)
  const endpoints: { x: number; y: number }[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (skeleton[y * width + x] > 0 && countNeighbors(x, y) === 1) {
        endpoints.push({ x, y });
      }
    }
  }

  // 엔드포인트에서 출발하여 분기점/다른 엔드포인트까지 추적
  for (const ep of endpoints) {
    if (visited[ep.y * width + ep.x]) continue;
    if (paths.length >= MAX_PATHS) break;

    const points: { x: number; y: number }[] = [{ x: ep.x, y: ep.y }];
    visited[ep.y * width + ep.x] = 1;

    let cx = ep.x, cy = ep.y;
    while (true) {
      let found = false;
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = ny * width + nx;
          if (skeleton[nIdx] > 0 && !visited[nIdx]) {
            cx = nx; cy = ny;
            visited[nIdx] = 1;
            points.push({ x: cx, y: cy });
            found = true;
            break;
          }
        }
      }
      if (!found) break;
      const n = countNeighbors(cx, cy);
      if (n >= 3 || n === 1) break; // 분기점 또는 다른 엔드포인트 도달
    }

    if (points.length >= 3) {
      const simplified = simplifyPoints(points, 1.5);
      paths.push({
        id: `path-${pathId++}`,
        d: pointsToSmoothPath(simplified),
        strokeWidth: 1.5,
        strokeColor: "#000000",
        opacity: 100,
        points: simplified,
      });
    }
  }

  // 남은 골격 픽셀 처리 (고립된 루프, 분기점에서 분기점)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (skeleton[idx] === 0 || visited[idx]) continue;
      if (paths.length >= MAX_PATHS) break;

      const points: { x: number; y: number }[] = [{ x, y }];
      visited[idx] = 1;
      let cx = x, cy = y;

      while (true) {
        let found = false;
        for (const [dx, dy] of DIRS) {
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = ny * width + nx;
            if (skeleton[nIdx] > 0 && !visited[nIdx]) {
              cx = nx; cy = ny;
              visited[nIdx] = 1;
              points.push({ x: cx, y: cy });
              found = true;
              break;
            }
          }
        }
        if (!found) break;
        if (countNeighbors(cx, cy) >= 3) break;
      }

      if (points.length >= 3) {
        const simplified = simplifyPoints(points, 1.5);
        paths.push({
          id: `path-${pathId++}`,
          d: pointsToSmoothPath(simplified),
          strokeWidth: 1.5,
          strokeColor: "#000000",
          opacity: 100,
          points: simplified,
        });
      }
    }
  }

  return paths;
}

// ─── AI 컬러 이미지를 고대비 라인아트로 전처리 ───
function preprocessToLineArt(imageData: ImageData, threshold: number = 120): ImageData {
  const { data, width, height } = imageData;
  const output = new ImageData(width, height);

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const val = gray < threshold ? 0 : 255;
    output.data[i] = val;
    output.data[i + 1] = val;
    output.data[i + 2] = val;
    output.data[i + 3] = 255;
  }

  return output;
}

// ─── 포인트 단순화 ───
function simplifyPoints(
  points: { x: number; y: number }[],
  tolerance: number
): { x: number; y: number }[] {
  if (points.length <= 2) return points;
  const result: { x: number; y: number }[] = [points[0]];
  let lastKept = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const dx = points[i].x - points[lastKept].x;
    const dy = points[i].y - points[lastKept].y;
    if (Math.sqrt(dx * dx + dy * dy) >= tolerance) {
      result.push(points[i]);
      lastKept = i;
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

// ─── 포인트 → 부드러운 SVG 경로 ───
function pointsToSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (i === 1) {
      d += ` L ${curr.x} ${curr.y}`;
    } else {
      const prevPrev = points[i - 2];
      const cp1x = prev.x + (curr.x - prevPrev.x) * 0.2;
      const cp1y = prev.y + (curr.y - prevPrev.y) * 0.2;
      d += ` Q ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${curr.x} ${curr.y}`;
    }
  }
  return d;
}

// ─── AI 선 보정 (가우시안 스무딩) ───
function smoothPaths(paths: VectorPath[]): VectorPath[] {
  return paths.map((path) => {
    if (path.points.length < 3) return path;
    const smoothed = path.points.map((pt, i) => {
      if (i === 0 || i === path.points.length - 1) return pt;
      const prev = path.points[i - 1];
      const next = path.points[i + 1];
      return {
        x: Math.round(prev.x * 0.25 + pt.x * 0.5 + next.x * 0.25),
        y: Math.round(prev.y * 0.25 + pt.y * 0.5 + next.y * 0.25),
      };
    });
    return { ...path, points: smoothed, d: pointsToSmoothPath(smoothed) };
  });
}

// ─── 이미지에서 Uint8Array 이진 데이터 추출 ───
function imageDataToBinary(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const binary = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    binary[i / 4] = data[i] < 128 ? 1 : 0; // 0 = 검정(선), 1 = 흰색(배경) → 값 반전해서 1=선
  }
  return binary;
}

// ─── Hook ───
export function useVectorize() {
  const [isVectorizing, setIsVectorizing] = useState(false);
  const [isSmoothing, setIsSmoothing] = useState(false);
  const [vectorPaths, setVectorPaths] = useState<VectorPath[]>([]);
  const [vectorSize, setVectorSize] = useState({ width: 800, height: 600 });
  const [showVectorEditor, setShowVectorEditor] = useState(false);

  const vectorizeImage = useCallback(async (imageUrl: string) => {
    setIsVectorizing(true);

    try {
      await new Promise<void>((resolve) => {
        const img = new Image();
        if (!imageUrl.startsWith("blob:")) {
          img.crossOrigin = "anonymous";
        }
        img.onload = () => {
          // 골격화 품질을 위해 이미지 크기 유지 (최대 800px로 상향)
          const maxSize = 800;
          const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);

          setVectorSize({ width: w, height: h });

          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(); return; }

          ctx.drawImage(img, 0, 0, w, h);
          const imageData = ctx.getImageData(0, 0, w, h);

          // Step 1: 컬러 → 고대비 라인아트 (임계값 120)
          const lineArt = preprocessToLineArt(imageData, 120);

          // Step 2: 라인아트 → 이진 배열 (1=선, 0=배경)
          const binary = imageDataToBinary(lineArt.data, w, h);

          // Step 3: Zhang-Suen 골격화
          const skeleton = zhangSuenThinning(binary, w, h);

          // Step 4: 골격 → SVG 경로 (엔드포인트/분기점 기반 세그먼트 추적)
          const paths = traceSkeletonPaths(skeleton, w, h);

          setVectorPaths(paths);
          setShowVectorEditor(true);
          resolve();
        };
        img.onerror = () => {
          // eslint-disable-next-line no-console
          console.error("[Vectorize] Failed to load image:", imageUrl);
          setVectorPaths([]);
          setVectorSize({ width: 400, height: 400 });
          setShowVectorEditor(true);
          resolve();
        };
        img.src = imageUrl;
      });
    } finally {
      setIsVectorizing(false);
    }
  }, []);

  const smoothVectorPaths = useCallback(async () => {
    setIsSmoothing(true);
    await new Promise((r) => setTimeout(r, 800));
    setVectorPaths((prev) => smoothPaths(prev));
    setIsSmoothing(false);
  }, []);

  const updatePath = useCallback((id: string, updates: Partial<VectorPath>) => {
    setVectorPaths((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  }, []);

  const deletePath = useCallback((id: string) => {
    setVectorPaths((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const closeVectorEditor = useCallback(() => {
    setShowVectorEditor(false);
  }, []);

  return {
    isVectorizing,
    isSmoothing,
    vectorPaths,
    vectorSize,
    showVectorEditor,
    vectorizeImage,
    smoothVectorPaths,
    updatePath,
    deletePath,
    closeVectorEditor,
    setVectorPaths,
  };
}