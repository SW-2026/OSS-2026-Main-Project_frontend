import { useState, useRef, useCallback } from "react";

export interface VectorPath {
  id: string;
  d: string;
  strokeWidth: number;
  strokeColor: string;
  opacity: number;
  points: { x: number; y: number; cp1x?: number; cp1y?: number; cp2x?: number; cp2y?: number }[];
}

interface VectorEditorProps {
  paths: VectorPath[];
  width: number;
  height: number;
  onUpdatePath: (id: string, updates: Partial<VectorPath>) => void;
  onDeletePath: (id: string) => void;
  onApplyToCanvas: () => void;
  onAISmooth: () => void;
  isSmoothing: boolean;
  onClose: () => void;
}

export default function VectorEditor({
  paths,
  width,
  height,
  onUpdatePath,
  onDeletePath,
  onApplyToCanvas,
  onAISmooth,
  isSmoothing,
  onClose,
}: VectorEditorProps) {
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<"select" | "node" | "stroke">("select");
  const [globalStrokeWidth, setGlobalStrokeWidth] = useState(2);
  const [globalOpacity, setGlobalOpacity] = useState(100);
  const [showNodes, setShowNodes] = useState(true);
  // 노드 드래그 상태
  const [draggingNode, setDraggingNode] = useState<{ pathId: string; nodeIndex: number } | null>(null);
  // 경로 이동 상태
  const [draggingPath, setDraggingPath] = useState<{
    pathId: string;
    origPoints: { x: number; y: number }[];
    startX: number;
    startY: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const selectedPath = paths.find((p) => p.id === selectedPathId);

  const handlePathClick = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedPathId(id === selectedPathId ? null : id);
  };

  const handleGlobalStrokeChange = (v: number) => {
    setGlobalStrokeWidth(v);
    paths.forEach((p) => onUpdatePath(p.id, { strokeWidth: v }));
  };

  const handleGlobalOpacityChange = (v: number) => {
    setGlobalOpacity(v);
    paths.forEach((p) => onUpdatePath(p.id, { opacity: v }));
  };

  const handleSelectedStrokeChange = (v: number) => {
    if (selectedPathId) onUpdatePath(selectedPathId, { strokeWidth: v });
  };

  // 노드 드래그 시작
  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, pathId: string, nodeIndex: number) => {
      e.stopPropagation();
      if (editMode !== "node") return;
      setDraggingNode({ pathId, nodeIndex });
    },
    [editMode]
  );

  // 노드 드래그 이동
  const handleSVGMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!svgRef.current || (!draggingNode && !draggingPath)) return;
      const rect = svgRef.current.getBoundingClientRect();
      const svgW = Math.min(width, 500);
      const svgH = Math.min(height, 480);
      const scaleX = width / svgW;
      const scaleY = height / svgH;
      const cx = ((e.clientX - rect.left) * scaleX);
      const cy = ((e.clientY - rect.top) * scaleY);

      if (draggingNode) {
        const path = paths.find((p) => p.id === draggingNode.pathId);
        if (!path) return;
        const newPoints = [...path.points];
        newPoints[draggingNode.nodeIndex] = { ...newPoints[draggingNode.nodeIndex], x: Math.round(cx), y: Math.round(cy) };
        onUpdatePath(draggingNode.pathId, {
          points: newPoints,
          d: pointsToSmoothPath(newPoints),
        });
      }

      if (draggingPath) {
        const dx = cx - draggingPath.startX;
        const dy = cy - draggingPath.startY;
        const newPoints = draggingPath.origPoints.map((p) => ({
          x: Math.round(p.x + dx),
          y: Math.round(p.y + dy),
        }));
        onUpdatePath(draggingPath.pathId, {
          points: newPoints,
          d: pointsToSmoothPath(newPoints),
        });
      }
    },
    [draggingNode, draggingPath, paths, width, height, onUpdatePath]
  );

  // 경로 드래그 시작 (select 모드에서)
  const handlePathMouseDown = useCallback(
    (e: React.MouseEvent, pathId: string) => {
      if (editMode !== "select") return;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const svgW = Math.min(width, 500);
      const svgH = Math.min(height, 480);
      const scaleX = width / svgW;
      const scaleY = height / svgH;
      const x = ((e.clientX - rect.left) * scaleX);
      const y = ((e.clientY - rect.top) * scaleY);
      const path = paths.find((p) => p.id === pathId);
      if (!path) return;
      setDraggingPath({
        pathId,
        origPoints: path.points.map((p) => ({ x: p.x, y: p.y })),
        startX: x,
        startY: y,
      });
      setSelectedPathId(pathId);
    },
    [editMode, paths, width, height]
  );

  // 마우스 업
  const handleSVGMouseUp = useCallback(() => {
    if (draggingNode) {
      setDraggingNode(null);
    }
    if (draggingPath) {
      setDraggingPath(null);
    }
  }, [draggingNode, draggingPath]);

  // SVG 외 클릭으로 선택 해제
  const handleSVGClick = useCallback(() => {
    if (!draggingNode && !draggingPath) {
      setSelectedPathId(null);
    }
  }, [draggingNode, draggingPath]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="flex w-[900px] h-[620px] bg-[#111] rounded-2xl overflow-hidden border border-[#2a2a2a]">
        {/* 왼쪽 툴바 */}
        <div className="w-48 bg-[#151515] border-r border-[#2a2a2a] flex flex-col p-3 gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs text-[#ccc] font-semibold">벡터 편집기</h3>
            <button onClick={onClose} className="w-6 h-6 flex items-center justify-center text-[#666] hover:text-[#ccc] cursor-pointer rounded hover:bg-[#2a2a2a]">
              <i className="ri-close-line text-sm" />
            </button>
          </div>

          {/* 편집 모드 */}
          <div>
            <p className="text-[9px] text-[#555] uppercase tracking-wider mb-1.5">편집 모드</p>
            <div className="space-y-1">
              {([
                { key: "select", icon: "ri-cursor-line", label: "선택/이동" },
                { key: "node", icon: "ri-node-tree", label: "노드 편집" },
                { key: "stroke", icon: "ri-pen-nib-line", label: "선 편집" },
              ] as const).map((mode) => (
                <button
                  key={mode.key}
                  onClick={() => setEditMode(mode.key)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] transition-colors cursor-pointer whitespace-nowrap ${
                    editMode === mode.key
                      ? "bg-orange-500/20 text-orange-400"
                      : "text-[#888] hover:bg-[#1e1e1e] hover:text-[#ccc]"
                  }`}
                >
                  <i className={`${mode.icon} text-xs`} />
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* 전체 선 설정 */}
          <div className="border-t border-[#2a2a2a] pt-3">
            <p className="text-[9px] text-[#555] uppercase tracking-wider mb-2">전체 선 설정</p>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-[#888]">굵기</span>
                  <span className="text-[10px] text-orange-400 font-mono">{globalStrokeWidth}px</span>
                </div>
                <input
                  type="range" min={0.5} max={10} step={0.5}
                  value={globalStrokeWidth}
                  onChange={(e) => handleGlobalStrokeChange(Number(e.target.value))}
                  className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
                  style={{ background: `linear-gradient(to right, #f97316 ${globalStrokeWidth * 10}%, #2a2a2a ${globalStrokeWidth * 10}%)` }}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-[#888]">불투명도</span>
                  <span className="text-[10px] text-orange-400 font-mono">{globalOpacity}%</span>
                </div>
                <input
                  type="range" min={10} max={100}
                  value={globalOpacity}
                  onChange={(e) => handleGlobalOpacityChange(Number(e.target.value))}
                  className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
                  style={{ background: `linear-gradient(to right, #f97316 ${globalOpacity}%, #2a2a2a ${globalOpacity}%)` }}
                />
              </div>
            </div>
          </div>

          {/* 선택된 선 설정 */}
          {selectedPath && (
            <div className="border-t border-[#2a2a2a] pt-3">
              <p className="text-[9px] text-[#555] uppercase tracking-wider mb-2">선택된 선</p>
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[#888]">굵기</span>
                    <span className="text-[10px] text-orange-400 font-mono">{selectedPath.strokeWidth}px</span>
                  </div>
                  <input
                    type="range" min={0.5} max={20} step={0.5}
                    value={selectedPath.strokeWidth}
                    onChange={(e) => handleSelectedStrokeChange(Number(e.target.value))}
                    className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
                    style={{ background: `linear-gradient(to right, #f97316 ${selectedPath.strokeWidth * 5}%, #2a2a2a ${selectedPath.strokeWidth * 5}%)` }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#888]">색상</span>
                  <input
                    type="color"
                    value={selectedPath.strokeColor}
                    onChange={(e) => onUpdatePath(selectedPath.id, { strokeColor: e.target.value })}
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                  />
                </div>
                <button
                  onClick={() => { onDeletePath(selectedPath.id); setSelectedPathId(null); }}
                  className="w-full py-1 rounded text-[10px] text-red-400 bg-red-500/10 hover:bg-red-500/20 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <i className="ri-delete-bin-line mr-1" />선 삭제
                </button>
              </div>
            </div>
          )}

          {/* 노드 표시 토글 */}
          <div className="border-t border-[#2a2a2a] pt-3">
            <button
              onClick={() => setShowNodes((v) => !v)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] transition-colors cursor-pointer whitespace-nowrap ${
                showNodes ? "bg-orange-500/10 text-orange-400" : "text-[#888] hover:bg-[#1e1e1e]"
              }`}
            >
              <i className="ri-focus-3-line text-xs" />
              노드 표시 {showNodes ? "ON" : "OFF"}
            </button>
          </div>

          {/* 경로 수 */}
          <div className="mt-auto border-t border-[#2a2a2a] pt-3">
            <p className="text-[9px] text-[#555]">총 {paths.length}개 경로</p>
            {selectedPathId && editMode === "select" && (
              <p className="text-[9px] text-orange-400 mt-1">선택된 경로를 드래그해서 이동하세요</p>
            )}
            {selectedPathId && editMode === "node" && (
              <p className="text-[9px] text-orange-400 mt-1">노드를 드래그해서 움직이세요</p>
            )}
          </div>
        </div>

        {/* 중앙 SVG 편집 영역 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 h-10 bg-[#111] border-b border-[#2a2a2a] shrink-0">
            <span className="text-[10px] text-[#555]">벡터 미리보기</span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={onAISmooth}
                disabled={isSmoothing}
                className="flex items-center gap-1.5 px-3 h-7 rounded-lg bg-[#1e1e1e] border border-[#2a2a2a] text-[10px] text-[#aaa] hover:border-orange-500/40 hover:text-orange-400 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                {isSmoothing ? (
                  <><div className="w-3 h-3 border border-orange-400 border-t-transparent rounded-full animate-spin" />AI 보정 중...</>
                ) : (
                  <><i className="ri-magic-line text-xs" />AI 선 보정</>
                )}
              </button>
              <button
                onClick={onApplyToCanvas}
                className="flex items-center gap-1.5 px-3 h-7 rounded-lg bg-orange-500 hover:bg-orange-600 text-[10px] text-white font-medium transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-check-line text-xs" />
                캔버스에 적용
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto flex items-center justify-center bg-[#0d0d0d] p-6">
            <div
              className="relative bg-white rounded-lg overflow-hidden"
              style={{ width: Math.min(width, 500), height: Math.min(height, 480) }}
            >
              <svg
                ref={svgRef}
                viewBox={`0 0 ${width} ${height}`}
                width={Math.min(width, 500)}
                height={Math.min(height, 480)}
                className="absolute inset-0"
                style={{ cursor: draggingNode ? "grabbing" : draggingPath ? "grabbing" : editMode === "node" ? "crosshair" : "default" }}
                onClick={handleSVGClick}
                onMouseMove={handleSVGMouseMove}
                onMouseUp={handleSVGMouseUp}
                onMouseLeave={handleSVGMouseUp}
              >
                {paths.map((path) => (
                  <g key={path.id}>
                    {/* 히트 영역 (클릭 감지용 넓은 투명 선) */}
                    <path
                      d={path.d}
                      stroke="transparent"
                      strokeWidth={Math.max(path.strokeWidth + 8, 12)}
                      fill="none"
                      className="cursor-pointer"
                      onClick={(e) => handlePathClick(path.id, e)}
                      onMouseDown={(e) => handlePathMouseDown(e, path.id)}
                    />
                    {/* 실제 선 */}
                    <path
                      d={path.d}
                      stroke={selectedPathId === path.id ? "#f97316" : path.strokeColor}
                      strokeWidth={path.strokeWidth}
                      fill="none"
                      opacity={path.opacity / 100}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-colors"
                    />
                    {/* 노드 표시 (노드 모드 또는 선택된 경로) */}
                    {(showNodes || editMode === "node") && selectedPathId === path.id && path.points.map((pt, i) => (
                      <g key={i}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={5}
                          fill="#f97316"
                          stroke="white"
                          strokeWidth={1.5}
                          className="cursor-move"
                          onMouseDown={(e) => handleNodeMouseDown(e, path.id, i)}
                        />
                        {/* 인덱스 라벨 */}
                        <text
                          x={pt.x}
                          y={pt.y - 10}
                          textAnchor="middle"
                          fill="#f97316"
                          fontSize={8}
                          fontFamily="monospace"
                          pointerEvents="none"
                        >
                          {i}
                        </text>
                      </g>
                    ))}
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </div>

        {/* 오른쪽 경로 목록 */}
        <div className="w-40 bg-[#151515] border-l border-[#2a2a2a] flex flex-col">
          <div className="px-3 py-2 border-b border-[#2a2a2a]">
            <p className="text-[9px] text-[#555] uppercase tracking-wider">경로 목록</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {paths.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-[#555]">
                <i className="ri-node-tree text-xl" />
                <p className="text-[10px]">추출된 선이 없습니다</p>
                <p className="text-[9px] text-[#444] text-center leading-relaxed">
                  이미지의 선이 선명할수록<br />좋은 결과가 나옵니다
                </p>
              </div>
            )}
            {paths.map((path, i) => (
              <button
                key={path.id}
                onClick={() => handlePathClick(path.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] transition-colors cursor-pointer text-left ${
                  selectedPathId === path.id
                    ? "bg-orange-500/20 text-orange-400"
                    : "text-[#888] hover:bg-[#1e1e1e] hover:text-[#ccc]"
                }`}
              >
                <div
                  className="w-4 h-0.5 rounded-full shrink-0"
                  style={{ backgroundColor: path.strokeColor, height: Math.min(path.strokeWidth, 4) }}
                />
                <span className="truncate whitespace-nowrap">경로 {i + 1}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
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
