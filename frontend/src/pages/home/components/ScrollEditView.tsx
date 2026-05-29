import { useState, useEffect, useCallback, useRef } from "react";
import { loadCutExportData, renderCutToDataURL } from "@/lib/cutExportUtils";
import type { Cut } from "../../../hooks/useEditorState";

interface ScrollEditViewProps {
  cuts: Cut[];
  activeCutId: string;
  onSelectCut: (cutId: string) => void;
}

interface RenderedCutState {
  cutId: string;
  dataUrl: string | null;
  loading: boolean;
  error: boolean;
}

function CutRenderer({
  cut,
  isActive,
  onSelect,
}: {
  cut: Cut;
  isActive: boolean;
  onSelect: (id: string) => void;
}) {
  const [state, setState] = useState<RenderedCutState>({
    cutId: cut.id,
    dataUrl: null,
    loading: true,
    error: false,
  });
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  // IntersectionObserver - 뷰포트에 들어왔을 때만 렌더링
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin: "600px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // 컷 데이터 로드 및 렌더링
  useEffect(() => {
    if (!inView || renderedRef.current) return;
    renderedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const data = await loadCutExportData(cut.id);
        if (cancelled) return;

        if (
          data &&
          (data.strokes.length > 0 ||
            data.balloons.length > 0 ||
            data.canvasImages.length > 0)
        ) {
          const dataUrl = await renderCutToDataURL(data, "png", 90, 1);
          if (!cancelled) setState({ cutId: cut.id, dataUrl, loading: false, error: false });
        } else if (cut.thumbnail) {
          setState({ cutId: cut.id, dataUrl: cut.thumbnail, loading: false, error: false });
        } else {
          setState({ cutId: cut.id, dataUrl: null, loading: false, error: false });
        }
      } catch {
        if (!cancelled) {
          setState({
            cutId: cut.id,
            dataUrl: cut.thumbnail ?? null,
            loading: false,
            error: !cut.thumbnail,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inView, cut.id, cut.thumbnail]);

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-2 py-4">
      {/* 컷 라벨 */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-[#666] font-medium whitespace-nowrap">
          {cut.label}
        </span>
        {cut.isGenerated && (
          <span className="w-3.5 h-3.5 rounded-full bg-emerald-500/80 flex items-center justify-center">
            <i className="ri-check-line text-white text-[7px]" />
          </span>
        )}
      </div>

      {/* 컷 이미지 */}
      <button
        onClick={() => onSelect(cut.id)}
        className={`relative bg-[#0a0a0a] overflow-hidden transition-all duration-200 cursor-pointer group ${
          isActive
            ? "ring-[3px] ring-orange-500 shadow-[0_0_24px_rgba(249,115,22,0.35)] scale-[1.02]"
            : "ring-1 ring-[#1e1e1e] hover:ring-[#444] hover:scale-[1.01]"
        }`}
        style={{ width: 400, height: 550 }}
      >
        {state.loading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[#0d0d0d]">
            <div className="w-7 h-7 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
            <span className="text-[#444] text-[11px]">로딩 중...</span>
          </div>
        ) : state.dataUrl ? (
          <img
            src={state.dataUrl}
            alt={cut.label}
            className="w-full h-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#0d0d0d]">
            <i className="ri-image-line text-[#333] text-3xl" />
            <span className="text-[#444] text-[11px]">이미지 없음</span>
          </div>
        )}

        {/* 호버 오버레이 */}
        {!state.loading && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm">
              <i className="ri-edit-line text-white text-sm" />
              <span className="text-white text-xs font-medium whitespace-nowrap">
                이 컷 편집하기
              </span>
            </div>
          </div>
        )}

        {/* 활성 컷 표시 */}
        {isActive && (
          <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center shadow-lg">
            <i className="ri-pencil-fill text-white text-[10px]" />
          </div>
        )}
      </button>
    </div>
  );
}

export default function ScrollEditView({
  cuts,
  activeCutId,
  onSelectCut,
}: ScrollEditViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 활성 컷으로 자동 스크롤
  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current.querySelector(
      `[data-cut-id="${activeCutId}"]`
    ) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeCutId]);

  const validCuts = cuts.filter(
    (c) => c.isGenerated || c.thumbnail || c.index < 6
  );

  if (validCuts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0d0d0d]">
        <div className="flex flex-col items-center gap-3 text-[#444]">
          <i className="ri-emotion-sad-line text-3xl" />
          <span className="text-xs">표시할 컷이 없습니다</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto bg-[#0d0d0d]"
      style={{ scrollBehavior: "smooth" }}
    >
      <div className="flex flex-col items-center py-6 px-4">
        {validCuts.map((cut) => (
          <div key={cut.id} data-cut-id={cut.id} className="w-full flex justify-center">
            <CutRenderer
              cut={cut}
              isActive={cut.id === activeCutId}
              onSelect={onSelectCut}
            />
          </div>
        ))}

        {/* 하단 여백 */}
        <div className="h-20" />
      </div>
    </div>
  );
}