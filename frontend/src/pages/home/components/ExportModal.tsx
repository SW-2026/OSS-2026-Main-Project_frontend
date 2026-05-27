import { useState, useRef, useEffect } from "react";
import type { RefObject } from "react";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  getCanvas: () => HTMLCanvasElement | null;
  getCompositeCanvas?: () => Promise<HTMLCanvasElement | null>;
  initialFormat?: "png" | "jpeg" | "pdf";
}

type ExportFormat = "png" | "jpeg" | "pdf";
type PdfLayout = "portrait" | "landscape";

export default function ExportModal({ isOpen, onClose, getCanvas, getCompositeCanvas, initialFormat = "png" }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>(initialFormat);
  const [quality, setQuality] = useState(95);
  const [scale, setScale] = useState(1);
  const [pdfLayout, setPdfLayout] = useState<PdfLayout>("portrait");
  const [isExporting, setIsExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormat(initialFormat);
      setExportDone(false);
    }
  }, [isOpen, initialFormat]);

  if (!isOpen) return null;

  const getSourceCanvas = async (): Promise<HTMLCanvasElement | null> => {
    if (getCompositeCanvas) {
      return getCompositeCanvas();
    }
    return getCanvas();
  };

  const handleExportPNG = async () => {
    const canvas = await getSourceCanvas();
    if (!canvas) return;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvas.width * scale;
    exportCanvas.height = canvas.height * scale;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);

    const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
    const ext = format === "jpeg" ? "jpg" : "png";
    const dataUrl = exportCanvas.toDataURL(mimeType, quality / 100);

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `webtoon-cut-${Date.now()}.${ext}`;
    link.click();
  };

  const handleExportPDF = async () => {
    const canvas = await getSourceCanvas();
    if (!canvas) return;

    const { jsPDF } = await import("jspdf");

    const imgData = canvas.toDataURL("image/jpeg", quality / 100);
    const canvasW = canvas.width;
    const canvasH = canvas.height;

    const isPortrait = pdfLayout === "portrait";
    const pdfW = isPortrait ? 210 : 297;
    const pdfH = isPortrait ? 297 : 210;

    const doc = new jsPDF({
      orientation: pdfLayout,
      unit: "mm",
      format: "a4",
    });

    const ratio = canvasW / canvasH;
    let imgW = pdfW - 20;
    let imgH = imgW / ratio;

    if (imgH > pdfH - 20) {
      imgH = pdfH - 20;
      imgW = imgH * ratio;
    }

    const x = (pdfW - imgW) / 2;
    const y = (pdfH - imgH) / 2;

    doc.addImage(imgData, "JPEG", x, y, imgW, imgH);
    doc.save(`webtoon-cut-${Date.now()}.pdf`);
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportDone(false);
    try {
      if (format === "pdf") {
        await handleExportPDF();
      } else {
        await handleExportPNG();
      }
      setExportDone(true);
      setTimeout(() => setExportDone(false), 2500);
    } finally {
      setIsExporting(false);
    }
  };

  const formatOptions: { value: ExportFormat; label: string; icon: string; desc: string }[] = [
    { value: "png", label: "PNG", icon: "ri-file-image-line", desc: "투명 배경 지원, 고품질 무손실" },
    { value: "jpeg", label: "JPEG", icon: "ri-image-line", desc: "작은 파일 크기, 웹 공유용" },
    { value: "pdf", label: "PDF", icon: "ri-file-pdf-line", desc: "인쇄 및 배포용 문서 형식" },
  ];

  const scaleOptions = [
    { value: 0.5, label: "0.5x", desc: "절반 크기" },
    { value: 1, label: "1x", desc: "원본 크기" },
    { value: 2, label: "2x", desc: "2배 고해상도" },
    { value: 3, label: "3x", desc: "3배 초고해상도" },
  ];

  const canvas = getCanvas();
  const exportW = canvas ? Math.round(canvas.width * scale) : 800;
  const exportH = canvas ? Math.round(canvas.height * scale) : 1100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 모달 */}
      <div className="relative w-[480px] bg-[#161616] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <i className="ri-export-line text-orange-400 text-sm" />
            </div>
            <div>
              <h2 className="text-white text-sm font-semibold">컷 내보내기</h2>
              <p className="text-[#555] text-[10px]">현재 캔버스를 파일로 저장합니다</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#666] hover:bg-[#2a2a2a] hover:text-[#ccc] transition-colors cursor-pointer"
          >
            <i className="ri-close-line" />
          </button>
        </div>

        {/* 내용 */}
        <div className="p-5 space-y-5">
          {/* 형식 선택 */}
          <div>
            <label className="text-[11px] text-[#888] font-medium uppercase tracking-wider mb-2 block">
              파일 형식
            </label>
            <div className="grid grid-cols-3 gap-2">
              {formatOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFormat(opt.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer ${
                    format === opt.value
                      ? "border-orange-500 bg-orange-500/10 text-orange-400"
                      : "border-[#2a2a2a] bg-[#1a1a1a] text-[#666] hover:border-[#3a3a3a] hover:text-[#aaa]"
                  }`}
                >
                  <i className={`${opt.icon} text-xl`} />
                  <span className="text-xs font-bold">{opt.label}</span>
                  <span className="text-[9px] text-center leading-tight opacity-70">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* PDF 레이아웃 (PDF 선택 시만) */}
          {format === "pdf" && (
            <div>
              <label className="text-[11px] text-[#888] font-medium uppercase tracking-wider mb-2 block">
                PDF 방향
              </label>
              <div className="flex gap-2">
                {(["portrait", "landscape"] as PdfLayout[]).map((layout) => (
                  <button
                    key={layout}
                    onClick={() => setPdfLayout(layout)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all cursor-pointer flex-1 justify-center ${
                      pdfLayout === layout
                        ? "border-orange-500 bg-orange-500/10 text-orange-400"
                        : "border-[#2a2a2a] bg-[#1a1a1a] text-[#666] hover:border-[#3a3a3a] hover:text-[#aaa]"
                    }`}
                  >
                    <i className="ri-file-line" />
                    {layout === "portrait" ? "세로 (A4)" : "가로 (A4)"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 해상도 배율 (PNG/JPEG만) */}
          {format !== "pdf" && (
            <div>
              <label className="text-[11px] text-[#888] font-medium uppercase tracking-wider mb-2 block">
                해상도 배율
              </label>
              <div className="grid grid-cols-4 gap-2">
                {scaleOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setScale(opt.value)}
                    className={`flex flex-col items-center gap-0.5 py-2 rounded-lg border text-xs transition-all cursor-pointer ${
                      scale === opt.value
                        ? "border-orange-500 bg-orange-500/10 text-orange-400"
                        : "border-[#2a2a2a] bg-[#1a1a1a] text-[#666] hover:border-[#3a3a3a] hover:text-[#aaa]"
                    }`}
                  >
                    <span className="font-bold">{opt.label}</span>
                    <span className="text-[9px] opacity-70">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 품질 슬라이더 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] text-[#888] font-medium uppercase tracking-wider">
                {format === "pdf" ? "이미지 품질" : "압축 품질"}
              </label>
              <span className="text-xs text-orange-400 font-medium">{quality}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #f97316 0%, #f97316 ${quality}%, #2a2a2a ${quality}%, #2a2a2a 100%)`,
              }}
            />
            <div className="flex justify-between text-[9px] text-[#555] mt-1">
              <span>낮음 (작은 파일)</span>
              <span>높음 (큰 파일)</span>
            </div>
          </div>

          {/* 내보내기 정보 */}
          <div className="bg-[#1a1a1a] rounded-xl p-3 border border-[#2a2a2a]">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#555]">출력 크기</span>
                <span className="text-[#aaa]">
                  {format === "pdf" ? "A4 (210×297mm)" : `${exportW} × ${exportH}px`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#555]">파일 형식</span>
                <span className="text-[#aaa]">{format.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#555]">품질</span>
                <span className="text-[#aaa]">{quality}%</span>
              </div>
              {format !== "pdf" && (
                <div className="flex justify-between">
                  <span className="text-[#555]">배율</span>
                  <span className="text-[#aaa]">{scale}x</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#2a2a2a] bg-[#111]">
          <button
            onClick={onClose}
            className="px-4 h-9 rounded-lg text-sm text-[#888] hover:bg-[#2a2a2a] hover:text-[#ccc] transition-colors cursor-pointer whitespace-nowrap"
          >
            취소
          </button>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className={`flex items-center gap-2 px-5 h-9 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
              exportDone
                ? "bg-emerald-500 text-white"
                : isExporting
                ? "bg-orange-500/50 text-white/50 cursor-not-allowed"
                : "bg-orange-500 text-white hover:bg-orange-600"
            }`}
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                내보내는 중...
              </>
            ) : exportDone ? (
              <>
                <i className="ri-checkbox-circle-line" />
                저장 완료!
              </>
            ) : (
              <>
                <i className={format === "pdf" ? "ri-file-pdf-line" : "ri-download-line"} />
                {format.toUpperCase()}로 내보내기
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
