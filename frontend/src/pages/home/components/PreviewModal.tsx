import { useState, useEffect, useCallback, useRef } from "react";
import { loadCutExportData, renderCutToDataURL } from "@/lib/cutExportUtils";
import type { Cut } from "../../../hooks/useEditorState";

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  cuts: Cut[];
  episodeTitle: string;
}

interface RenderedCut {
  cutId: string;
  dataUrl: string | null;
  loading: boolean;
  error: boolean;
}

export default function PreviewModal({
  isOpen,
  onClose,
  cuts,
  episodeTitle,
}: PreviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [renderedCuts, setRenderedCuts] = useState<Map<string, RenderedCut>>(new Map());
  const renderInProgress = useRef<Set<string>>(new Set());

  const validCuts = cuts.filter((c) => c.isGenerated || c.thumbnail);

  // 초기화
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setIsPlaying(false);
      setShowInfo(true);
      setRenderedCuts(new Map());
      renderInProgress.current = new Set();
    }
  }, [isOpen]);

  // 컷 렌더링
  const renderCut = useCallback(async (cut: Cut) => {
    const cutId = cut.id;
    if (renderInProgress.current.has(cutId)) return;
    if (renderedCuts.has(cutId) && (renderedCuts.get(cutId)!.dataUrl || renderedCuts.get(cutId)!.error)) return;

    renderInProgress.current.add(cutId);
    setRenderedCuts((prev) => {
      const next = new Map(prev);
      next.set(cutId, { cutId, dataUrl: null, loading: true, error: false });
      return next;
    });

    try {
      const data = await loadCutExportData(cutId);
      if (data && (data.strokes.length > 0 || data.balloons.length > 0 || data.canvasImages.length > 0)) {
        const dataUrl = await renderCutToDataURL(data, "png", 90, 1);
        setRenderedCuts((prev) => {
          const next = new Map(prev);
          next.set(cutId, { cutId, dataUrl, loading: false, error: false });
          return next;
        });
      } else if (cut.thumbnail) {
        setRenderedCuts((prev) => {
          const next = new Map(prev);
          next.set(cutId, { cutId, dataUrl: cut.thumbnail, loading: false, error: false });
          return next;
        });
      } else {
        setRenderedCuts((prev) => {
          const next = new Map(prev);
          next.set(cutId, { cutId, dataUrl: null, loading: false, error: true });
          return next;
        });
      }
    } catch {
      if (cut.thumbnail) {
        setRenderedCuts((prev) => {
          const next = new Map(prev);
          next.set(cutId, { cutId, dataUrl: cut.thumbnail, loading: false, error: false });
          return next;
        });
      } else {
        setRenderedCuts((prev) => {
          const next = new Map(prev);
          next.set(cutId, { cutId, dataUrl: null, loading: false, error: true });
          return next;
        });
      }
    } finally {
      renderInProgress.current.delete(cutId);
    }
  }, [renderedCuts]);

  // 현재 컷 + 다음 컷 미리 렌더링
  useEffect(() => {
    if (!isOpen || validCuts.length === 0) return;
    const toRender = [
      currentIndex,
      (currentIndex + 1) % validCuts.length,
      (currentIndex + 2) % validCuts.length,
    ].filter((idx, i, arr) => arr.indexOf(idx) === i);

    toRender.forEach((idx) => {
      renderCut(validCuts[idx]);
    });
  }, [isOpen, currentIndex, validCuts, renderCut]);

  // 자동 재생
  useEffect(() => {
    if (isPlaying && validCuts.length > 1) {
      timerRef.current = setInterval(() => {
        setCurrentIndex((i) => (i + 1) % validCuts.length);
      }, 2500);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, validCuts.length]);

  const goNext = useCallback(() => {
    if (validCuts.length <= 1) return;
    setCurrentIndex((i) => (i + 1) % validCuts.length);
    setIsPlaying(false);
  }, [validCuts.length]);

  const goPrev = useCallback(() => {
    if (validCuts.length <= 1) return;
    setCurrentIndex((i) => (i - 1 + validCuts.length) % validCuts.length);
    setIsPlaying(false);
  }, [validCuts.length]);

  // 키보드 컨트롤
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "Escape") onClose();
      if (e.key === " ") {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
      if (e.key.toLowerCase() === "i") setShowInfo((s) => !s);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, goNext, goPrev, onClose]);

  if (!isOpen || validCuts.length === 0) return null;

  const current = validCuts[currentIndex];
  const currentRendered = renderedCuts.get(current.id);
  const isLoading = !currentRendered || currentRendered.loading;
  const displayUrl = currentRendered?.dataUrl ?? current.thumbnail ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={onClose}>
      {/* 닫기 버튼 */}
      <button
        className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer z-10"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        title="닫기 (Esc)"
      >
        <i className="ri-close-line text-lg" />
      </button>

      {/* 정보 오버레이 */}
      {showInfo && (
        <div className="absolute top-4 left-4 flex items-center gap-3 z-10">
          <div className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-medium">
            {episodeTitle}
          </div>
          <div className="px-2.5 py-1.5 rounded-lg bg-white/10 text-white/70 text-xs">
            {currentIndex + 1} / {validCuts.length}
          </div>
        </div>
      )}

      {/* 메인 이미지 */}
      <div
        className="relative max-w-[90vw] max-h-[80vh] rounded-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading ? (
          <div className="w-[600px] h-[400px] bg-[#111] flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            <span className="text-[#555] text-xs">컷 렌더링 중...</span>
          </div>
        ) : displayUrl ? (
          <img
            src={displayUrl}
            alt={current.label}
            className="max-w-[90vw] max-h-[80vh] object-contain bg-[#111]"
            draggable={false}
          />
        ) : (
          <div className="w-[600px] h-[400px] bg-[#111] flex items-center justify-center text-[#555] text-sm">
            {current.label} — 이미지 없음
          </div>
        )}

        {/* 컷 라벨 */}
        {showInfo && (
          <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/70 to-transparent">
            <span className="text-white text-sm font-medium">{current.label}</span>
          </div>
        )}

        {/* 좌우 화살표 */}
        {validCuts.length > 1 && (
          <>
            <button
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer"
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
            >
              <i className="ri-arrow-left-s-line text-xl" />
            </button>
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer"
              onClick={(e) => { e.stopPropagation(); goNext(); }}
            >
              <i className="ri-arrow-right-s-line text-xl" />
            </button>
          </>
        )}
      </div>

      {/* 하단 컨트롤 바 */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setIsPlaying((p) => !p)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          title={isPlaying ? "일시정지" : "재생"}
        >
          <i className={isPlaying ? "ri-pause-line text-lg" : "ri-play-line text-lg"} />
        </button>

        {/* 썸네일 스트립 */}
        <div className="flex items-center gap-1.5 bg-black/40 rounded-full px-3 py-1.5">
          {validCuts.map((cut, idx) => {
            const rendered = renderedCuts.get(cut.id);
            const thumbUrl = rendered?.dataUrl ?? cut.thumbnail ?? null;
            return (
              <button
                key={cut.id}
                onClick={() => { setCurrentIndex(idx); setIsPlaying(false); }}
                className={`w-8 h-10 rounded overflow-hidden border transition-all cursor-pointer ${
                  idx === currentIndex
                    ? "border-orange-500 ring-1 ring-orange-500"
                    : "border-transparent opacity-50 hover:opacity-80"
                }`}
              >
                {thumbUrl ? (
                  <img src={thumbUrl} alt="" className="w-full h-full object-cover" draggable={false} />
                ) : rendered?.loading ? (
                  <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center">
                    <div className="w-3 h-3 border border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="w-full h-full bg-[#222]" />
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setShowInfo((s) => !s)}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors cursor-pointer text-xs"
          title="정보 토글 (I)"
        >
          <i className="ri-information-line" />
        </button>
      </div>
    </div>
  );
}