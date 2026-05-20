import { useRef, useState, useCallback } from "react";
import type { BalloonItem, BalloonShape } from "./BalloonPanel";

interface BalloonOverlayProps {
  balloons: BalloonItem[];
  selectedBalloonId: string | null;
  scale: number;
  activeTool: string;
  onSelect: (id: string | null) => void;
  onAddBalloon: (x: number, y: number) => string;
  onUpdateText: (id: string, text: string) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onUpdateSize: (id: string, w: number, h: number) => void;
  onDelete: (id: string) => void;
}

function drawBalloonPath(
  shape: BalloonShape,
  w: number,
  h: number,
  tailDir: BalloonItem["tailDir"]
): string {
  const r = Math.min(16, w * 0.15, h * 0.25);
  const tailSize = 18;
  const bodyH = tailDir === "none" ? h : h - tailSize;

  const buildRoundRect = (bh: number, radius: number = r) =>
    `M ${radius},0 H ${w - radius} Q ${w},0 ${w},${radius} V ${bh - radius} Q ${w},${bh} ${w - radius},${bh} H ${radius} Q 0,${bh} 0,${bh - radius} V ${radius} Q 0,0 ${radius},0 Z`;

  const buildTail = (bh: number) => {
    if (tailDir === "none") return "";
    const tails: Record<string, string> = {
      "bottom-left": `M ${r * 2},${bh} L ${r},${bh + tailSize} L ${r * 4},${bh} Z`,
      "bottom-right": `M ${w - r * 4},${bh} L ${w - r},${bh + tailSize} L ${w - r * 2},${bh} Z`,
      "top-left": `M ${r * 2},0 L ${r},${-tailSize} L ${r * 4},0 Z`,
      "top-right": `M ${w - r * 4},0 L ${w - r},${-tailSize} L ${w - r * 2},0 Z`,
    };
    return tails[tailDir] ?? "";
  };

  switch (shape) {
    case "round":
    case "rect":
    case "whisper": {
      const bh = bodyH;
      return `${buildRoundRect(bh)} ${buildTail(bh)}`;
    }
    case "rounded-rect": {
      const bh = bodyH;
      const rr = Math.min(12, w * 0.12, bh * 0.2);
      return `${buildRoundRect(bh, rr)} ${buildTail(bh)}`;
    }
    case "cloud": {
      const cx = w / 2;
      const cy = bodyH / 2;
      const rx = w * 0.42;
      const ry = bodyH * 0.38;
      return `M ${cx - rx},${cy} A ${rx * 0.6},${ry * 0.7} 0 0,1 ${cx - rx * 0.3},${cy - ry} A ${rx * 0.5},${ry * 0.6} 0 0,1 ${cx + rx * 0.3},${cy - ry} A ${rx * 0.6},${ry * 0.7} 0 0,1 ${cx + rx},${cy} A ${rx * 0.5},${ry * 0.6} 0 0,1 ${cx + rx * 0.3},${cy + ry} A ${rx * 0.6},${ry * 0.7} 0 0,1 ${cx - rx * 0.3},${cy + ry} A ${rx * 0.5},${ry * 0.6} 0 0,1 ${cx - rx},${cy} Z ${buildTail(bodyH)}`;
    }
    case "spiky": {
      const pts: string[] = [];
      const cx = w / 2;
      const cy = bodyH / 2;
      const outerR = Math.min(w, bodyH) * 0.48;
      const innerR = outerR * 0.72;
      const spikes = 10;
      for (let i = 0; i < spikes * 2; i++) {
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        const r2 = i % 2 === 0 ? outerR : innerR;
        pts.push(`${cx + r2 * Math.cos(angle)},${cy + r2 * Math.sin(angle)}`);
      }
      return `M ${pts.join(" L ")} Z ${buildTail(bodyH)}`;
    }
    case "shout": {
      const pts: string[] = [];
      const cx = w / 2;
      const cy = bodyH / 2;
      const outerR = Math.min(w, bodyH) * 0.48;
      const innerR = outerR * 0.72;
      const spikes = 14;
      for (let i = 0; i < spikes * 2; i++) {
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        const r2 = i % 2 === 0 ? outerR : innerR;
        pts.push(`${cx + r2 * Math.cos(angle)},${cy + r2 * Math.sin(angle)}`);
      }
      return `M ${pts.join(" L ")} Z ${buildTail(bodyH)}`;
    }
    case "thought": {
      const bh = bodyH;
      // tailDir에 따라 원(버블) 위치 결정
      let bubble1x: number, bubble1y: number, bubble2x: number, bubble2y: number;
      if (tailDir === "bottom-left") {
        bubble1x = r * 2; bubble1y = bh + 5;
        bubble2x = r * 1.2; bubble2y = bh + 15;
      } else if (tailDir === "bottom-right") {
        bubble1x = w - r * 2; bubble1y = bh + 5;
        bubble2x = w - r * 1.2; bubble2y = bh + 15;
      } else if (tailDir === "top-left") {
        bubble1x = r * 2; bubble1y = -5;
        bubble2x = r * 1.2; bubble2y = -15;
      } else if (tailDir === "top-right") {
        bubble1x = w - r * 2; bubble1y = -5;
        bubble2x = w - r * 1.2; bubble2y = -15;
      } else {
        // none: 버블 안 그림
        return buildRoundRect(bh);
      }
      return `${buildRoundRect(bh)} M ${bubble1x - 4},${bubble1y} A 4,4 0 1,0 ${bubble1x + 4},${bubble1y} A 4,4 0 1,0 ${bubble1x - 4},${bubble1y} Z M ${bubble2x - 3},${bubble2y} A 3,3 0 1,0 ${bubble2x + 3},${bubble2y} A 3,3 0 1,0 ${bubble2x - 3},${bubble2y} Z`;
    }
    case "double": {
      const bh = bodyH;
      return `${buildRoundRect(bh)} M ${r},${r * 0.5} H ${w - r} Q ${w - r * 0.5},${r * 0.5} ${w - r * 0.5},${r} V ${bh - r} Q ${w - r * 0.5},${bh - r * 0.5} ${w - r},${bh - r * 0.5} H ${r} Q ${r * 0.5},${bh - r * 0.5} ${r * 0.5},${bh - r} V ${r} Q ${r * 0.5},${r * 0.5} ${r},${r * 0.5} Z ${buildTail(bh)}`;
    }
    case "burst": {
      const pts: string[] = [];
      const cx = w / 2;
      const cy = bodyH / 2;
      const spikes = 16;
      for (let i = 0; i < spikes * 2; i++) {
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        const outerR = Math.min(w, bodyH) * 0.48;
        const innerR = outerR * 0.7;
        const r2 = i % 2 === 0 ? outerR : innerR;
        pts.push(`${cx + r2 * Math.cos(angle)},${cy + r2 * Math.sin(angle)}`);
      }
      return `M ${pts.join(" L ")} Z ${buildTail(bodyH)}`;
    }
    default:
      return buildRoundRect(bodyH);
  }
}

interface EditingState {
  id: string;
  text: string;
}

export default function BalloonOverlay({
  balloons,
  selectedBalloonId,
  scale,
  activeTool,
  onSelect,
  onAddBalloon,
  onUpdateText,
  onUpdatePosition,
  onUpdateSize,
  onDelete,
}: BalloonOverlayProps) {
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startY: number; origW: number; origH: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (activeTool !== "balloon") return;
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;
      const id = onAddBalloon(x - 90, y - 40);
      setEditing({ id, text: "" });
      setTimeout(() => textareaRef.current?.focus(), 50);
    },
    [activeTool, onAddBalloon, scale]
  );

  const handleBalloonMouseDown = useCallback(
    (e: React.MouseEvent, balloon: BalloonItem) => {
      e.stopPropagation();
      if (activeTool !== "balloon" && activeTool !== "select" && activeTool !== "move") return;
      onSelect(balloon.id);
      if (editing?.id !== balloon.id) {
        setDragging({
          id: balloon.id,
          startX: e.clientX,
          startY: e.clientY,
          origX: balloon.x,
          origY: balloon.y,
        });
      }
    },
    [activeTool, editing, onSelect]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragging) {
        const dx = (e.clientX - dragging.startX) / scale;
        const dy = (e.clientY - dragging.startY) / scale;
        onUpdatePosition(dragging.id, dragging.origX + dx, dragging.origY + dy);
      }
      if (resizing) {
        const dx = (e.clientX - resizing.startX) / scale;
        const dy = (e.clientY - resizing.startY) / scale;
        onUpdateSize(resizing.id, Math.max(80, resizing.origW + dx), Math.max(40, resizing.origH + dy));
      }
    },
    [dragging, resizing, onUpdatePosition, onUpdateSize, scale]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setResizing(null);
  }, []);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent, balloon: BalloonItem) => {
      e.stopPropagation();
      setEditing({ id: balloon.id, text: balloon.text });
      setTimeout(() => textareaRef.current?.focus(), 50);
    },
    []
  );

  const handleTextBlur = useCallback(() => {
    if (editing) {
      onUpdateText(editing.id, editing.text);
      setEditing(null);
    }
  }, [editing, onUpdateText]);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, balloon: BalloonItem) => {
      e.stopPropagation();
      setResizing({
        id: balloon.id,
        startX: e.clientX,
        startY: e.clientY,
        origW: balloon.width,
        origH: balloon.height,
      });
    },
    []
  );

  const isBalloonInteractive = activeTool === "balloon" || activeTool === "select" || activeTool === "move";

  return (
    <svg
      className="absolute top-0 left-0 origin-top-left overflow-visible"
      style={{
        width: 800,
        height: 1100,
        transform: `scale(${scale})`,
        pointerEvents: isBalloonInteractive ? "all" : "none",
        cursor: activeTool === "balloon" ? "crosshair" : "default",
      }}
      onClick={handleOverlayClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {balloons.map((balloon) => {
        const isSelected = selectedBalloonId === balloon.id;
        const isEditingThis = editing?.id === balloon.id;
        const tailSize = balloon.tailDir === "none" ? 0 : 18;
        const bodyH = balloon.height - tailSize;
        const pathD = drawBalloonPath(balloon.shape, balloon.width, balloon.height, balloon.tailDir);
        const isDashed = balloon.shape === "whisper";

        return (
          <g
            key={balloon.id}
            transform={`translate(${balloon.x}, ${balloon.y})`}
            style={{ cursor: isEditingThis ? "text" : "move" }}
            onMouseDown={(e) => handleBalloonMouseDown(e, balloon)}
            onDoubleClick={(e) => handleDoubleClick(e, balloon)}
          >
            {/* 말풍선 본체 */}
            <path
              d={pathD}
              fill={balloon.bgColor}
              stroke={balloon.borderColor}
              strokeWidth={isSelected ? 2 : 1.5}
              strokeDasharray={isDashed ? "5,3" : undefined}
              style={{ filter: isSelected ? `drop-shadow(0 0 4px ${balloon.borderColor}88)` : undefined }}
            />

            {/* 텍스트 (편집 중이 아닐 때) */}
            {!isEditingThis && balloon.text && (
              <foreignObject
                x={8}
                y={4}
                width={balloon.width - 16}
                height={bodyH - 8}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: balloon.fontFamily,
                    fontSize: balloon.fontSize,
                    color: balloon.textColor,
                    textAlign: "center",
                    wordBreak: "break-word",
                    lineHeight: 1.4,
                    padding: "2px",
                    pointerEvents: "none",
                  }}
                >
                  {balloon.text}
                </div>
              </foreignObject>
            )}

            {/* 텍스트 편집 중 */}
            {isEditingThis && (
              <foreignObject x={8} y={4} width={balloon.width - 16} height={bodyH - 8}>
                <textarea
                  ref={textareaRef}
                  value={editing?.text ?? ""}
                  onChange={(e) => setEditing((prev) => prev ? { ...prev, text: e.target.value } : null)}
                  onBlur={handleTextBlur}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: "100%",
                    height: "100%",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    resize: "none",
                    fontFamily: balloon.fontFamily,
                    fontSize: balloon.fontSize,
                    color: balloon.textColor,
                    textAlign: "center",
                    lineHeight: 1.4,
                    padding: "2px",
                    cursor: "text",
                  }}
                  placeholder="대사 입력..."
                />
              </foreignObject>
            )}

            {/* 선택 핸들 */}
            {isSelected && !isEditingThis && (
              <>
                {/* 선택 테두리 */}
                <rect
                  x={-3}
                  y={-3}
                  width={balloon.width + 6}
                  height={balloon.height + 6}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth={1}
                  strokeDasharray="4,3"
                  rx={4}
                />
                {/* 리사이즈 핸들 (우하단) */}
                <rect
                  x={balloon.width - 6}
                  y={balloon.height - 6}
                  width={12}
                  height={12}
                  fill="#f97316"
                  rx={2}
                  style={{ cursor: "se-resize" }}
                  onMouseDown={(e) => handleResizeMouseDown(e, balloon)}
                />
                {/* 삭제 버튼 */}
                <g
                  transform={`translate(${balloon.width - 8}, -16)`}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => { e.stopPropagation(); onDelete(balloon.id); }}
                >
                  <circle cx={8} cy={8} r={8} fill="#ef4444" />
                  <line x1={5} y1={5} x2={11} y2={11} stroke="white" strokeWidth={1.5} />
                  <line x1={11} y1={5} x2={5} y2={11} stroke="white" strokeWidth={1.5} />
                </g>
                {/* 편집 버튼 */}
                <g
                  transform={`translate(${balloon.width - 28}, -16)`}
                  style={{ cursor: "pointer" }}
                  onMouseDown={(e) => { e.stopPropagation(); handleDoubleClick(e as unknown as React.MouseEvent, balloon); }}
                >
                  <circle cx={8} cy={8} r={8} fill="#f97316" />
                  <text x={8} y={12} textAnchor="middle" fill="white" fontSize={10}>T</text>
                </g>
              </>
            )}

            {/* 빈 말풍선 안내 텍스트 */}
            {!balloon.text && !isEditingThis && (
              <text
                x={balloon.width / 2}
                y={bodyH / 2 + 4}
                textAnchor="middle"
                fill="#aaa"
                fontSize={11}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                더블클릭하여 입력
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
