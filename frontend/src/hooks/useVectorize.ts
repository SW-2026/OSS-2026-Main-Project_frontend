import { useCallback, useState } from "react";
import type { VectorPath } from "@/pages/home/components/VectorEditor";

// Canvas 기반 Edge Detection (Sobel Filter)
function applySobelFilter(imageData: ImageData): Uint8ClampedArray {
  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data.length);

  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const gray = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
          const ki = (ky + 1) * 3 + (kx + 1);
          gx += sobelX[ki] * gray;
          gy += sobelY[ki] * gray;
        }
      }

      const magnitude = Math.min(255, Math.sqrt(gx * gx + gy * gy));
      const outIdx = (y * width + x) * 4;
      output[outIdx] = magnitude;
      output[outIdx + 1] = magnitude;
      output[outIdx + 2] = magnitude;
      output[outIdx + 3] = 255;
    }
  }

  return output;
}

// AI 컬러 이미지를 고대비 라인아트로 전처리 (색상/그라데이션 제거, 선만 남김)
function preprocessToLineArt(imageData: ImageData, threshold: number = 140): ImageData {
  const { data, width, height } = imageData;
  const output = new ImageData(width, height);

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    // 어두운 픽셀은 선(0), 밝은 픽셀은 배경(255)
    const val = gray < threshold ? 0 : 255;
    output.data[i] = val;
    output.data[i + 1] = val;
    output.data[i + 2] = val;
    output.data[i + 3] = 255;
  }

  return output;
}

// 엣지 픽셀을 경로로 변환 (간단한 연결 알고리즘)
function edgePixelsToSVGPaths(
  edgeData: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number = 80,
  simplify: number = 3
): VectorPath[] {
  const visited = new Uint8Array(width * height);
  const paths: VectorPath[] = [];

  const getEdge = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const idx = (y * width + x) * 4;
    return edgeData[idx] > threshold;
  };

  const directions = [
    [1, 0], [1, 1], [0, 1], [-1, 1],
    [-1, 0], [-1, -1], [0, -1], [1, -1],
  ];

  let pathId = 0;

  for (let startY = 0; startY < height; startY += simplify) {
    for (let startX = 0; startX < width; startX += simplify) {
      const startIdx = startY * width + startX;
      if (!getEdge(startX, startY) || visited[startIdx]) continue;

      const points: { x: number; y: number }[] = [];
      let cx = startX;
      let cy = startY;
      let steps = 0;
      const maxSteps = 2000;

      while (steps < maxSteps) {
        const idx = cy * width + cx;
        if (visited[idx]) break;
        visited[idx] = 1;
        points.push({ x: cx, y: cy });

        let found = false;
        for (const [dx, dy] of directions) {
          const nx = cx + dx;
          const ny = cy + dy;
          const nIdx = ny * width + nx;
          if (getEdge(nx, ny) && !visited[nIdx]) {
            cx = nx;
            cy = ny;
            found = true;
            break;
          }
        }
        if (!found) break;
        steps++;
      }

      if (points.length < 4) continue;

      // 포인트 단순화 (Douglas-Peucker 간소화)
      const simplified = simplifyPoints(points, 2);
      if (simplified.length < 2) continue;

      // SVG path 생성
      const d = pointsToSmoothPath(simplified);

      paths.push({
        id: `path-${pathId++}`,
        d,
        strokeWidth: 1.5,
        strokeColor: "#000000",
        opacity: 100,
        points: simplified,
      });

      if (paths.length > 300) break;
    }
    if (paths.length > 300) break;
  }

  return paths;
}

// 포인트 단순화
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
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist >= tolerance) {
      result.push(points[i]);
      lastKept = i;
    }
  }

  result.push(points[points.length - 1]);
  return result;
}

// 포인트를 부드러운 SVG 경로로 변환
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

// AI 선 보정 (스무딩)
function smoothPaths(paths: VectorPath[]): VectorPath[] {
  return paths.map((path) => {
    if (path.points.length < 3) return path;

    // 가우시안 스무딩
    const smoothed = path.points.map((pt, i) => {
      if (i === 0 || i === path.points.length - 1) return pt;
      const prev = path.points[i - 1];
      const next = path.points[i + 1];
      return {
        x: Math.round(prev.x * 0.25 + pt.x * 0.5 + next.x * 0.25),
        y: Math.round(prev.y * 0.25 + pt.y * 0.5 + next.y * 0.25),
      };
    });

    return {
      ...path,
      points: smoothed,
      d: pointsToSmoothPath(smoothed),
    };
  });
}

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
        // blob URL은 same-origin이라 crossOrigin을 설정하면 오히려 로드 실패할 수 있음
        if (!imageUrl.startsWith("blob:")) {
          img.crossOrigin = "anonymous";
        }
        img.onload = () => {
          const maxSize = 400;
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

          // 전처리: AI 컬러 이미지를 고대비 라인아트로 변환 (색상 노이즈 제거)
          const lineArtData = preprocessToLineArt(imageData, 140);

          // Sobel edge detection on the preprocessed binary image
          const edgeData = applySobelFilter(lineArtData);

          // 엣지 → SVG 경로 (더 높은 임계값과 간격으로 노이즈 감소)
          const paths = edgePixelsToSVGPaths(edgeData, w, h, 120, 4);

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

// 데모용 경로 생성 (이미지 로드 실패 시)
function generateDemoPaths(): VectorPath[] {
  const paths: VectorPath[] = [];

  // 얼굴 윤곽
  paths.push({
    id: "demo-face",
    d: "M 200 80 Q 260 60 300 100 Q 340 140 330 200 Q 320 260 280 290 Q 240 320 200 310 Q 160 300 140 260 Q 120 220 130 170 Q 140 120 200 80",
    strokeWidth: 2,
    strokeColor: "#000000",
    opacity: 100,
    points: [
      { x: 200, y: 80 }, { x: 260, y: 60 }, { x: 300, y: 100 },
      { x: 330, y: 200 }, { x: 280, y: 290 }, { x: 200, y: 310 },
      { x: 140, y: 260 }, { x: 130, y: 170 }, { x: 200, y: 80 },
    ],
  });

  // 눈 (왼쪽)
  paths.push({
    id: "demo-eye-l",
    d: "M 165 160 Q 180 150 195 160 Q 180 175 165 160",
    strokeWidth: 1.5,
    strokeColor: "#000000",
    opacity: 100,
    points: [{ x: 165, y: 160 }, { x: 180, y: 150 }, { x: 195, y: 160 }, { x: 180, y: 175 }],
  });

  // 눈 (오른쪽)
  paths.push({
    id: "demo-eye-r",
    d: "M 225 160 Q 240 150 255 160 Q 240 175 225 160",
    strokeWidth: 1.5,
    strokeColor: "#000000",
    opacity: 100,
    points: [{ x: 225, y: 160 }, { x: 240, y: 150 }, { x: 255, y: 160 }, { x: 240, y: 175 }],
  });

  // 코
  paths.push({
    id: "demo-nose",
    d: "M 210 190 Q 205 220 200 230 Q 210 235 220 230 Q 215 220 210 190",
    strokeWidth: 1.2,
    strokeColor: "#000000",
    opacity: 100,
    points: [{ x: 210, y: 190 }, { x: 200, y: 230 }, { x: 220, y: 230 }],
  });

  // 입
  paths.push({
    id: "demo-mouth",
    d: "M 175 265 Q 200 280 225 265",
    strokeWidth: 1.5,
    strokeColor: "#000000",
    opacity: 100,
    points: [{ x: 175, y: 265 }, { x: 200, y: 280 }, { x: 225, y: 265 }],
  });

  // 머리카락
  paths.push({
    id: "demo-hair",
    d: "M 140 120 Q 160 60 200 50 Q 240 40 270 70 Q 300 100 290 80 Q 260 30 200 30 Q 140 30 120 90 Q 110 120 140 120",
    strokeWidth: 2.5,
    strokeColor: "#000000",
    opacity: 100,
    points: [
      { x: 140, y: 120 }, { x: 200, y: 50 }, { x: 270, y: 70 },
      { x: 290, y: 80 }, { x: 200, y: 30 }, { x: 120, y: 90 },
    ],
  });

  return paths;
}
