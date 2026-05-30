import { useState, useCallback } from "react";
import type { Cut } from "@/hooks/useEditorState";
import { loadCutExportData, renderCutToDataURL } from "@/lib/cutExportUtils";

interface ProjectExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  cuts: Cut[];
  episodeTitle: string;
}

type ExportFormat = "png" | "jpeg";

export default function ProjectExportModal({ isOpen, onClose, cuts, episodeTitle }: ProjectExportModalProps) {
  const [selectedCutIds, setSelectedCutIds] = useState<Set<string>>(new Set(cuts.map((c) => c.id)));
  const [format, setFormat] = useState<ExportFormat>("png");
  const [scale, setScale] = useState(1);
  const [quality, setQuality] = useState(95);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, status: "" });
  const [exportDone, setExportDone] = useState(false);

  if (!isOpen) return null;

  const selectedCuts = cuts.filter((c) => selectedCutIds.has(c.id));
  const allSelected = selectedCutIds.size === cuts.length;
  const noneSelected = selectedCutIds.size === 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedCutIds(new Set());
    } else {
      setSelectedCutIds(new Set(cuts.map((c) => c.id)));
    }
  };

  const toggleCut = (cutId: string) => {
    setSelectedCutIds((prev) => {
      const next = new Set(prev);
      if (next.has(cutId)) {
        next.delete(cutId);
      } else {
        next.add(cutId);
      }
      return next;
    });
  };

  const handleExport = async () => {
    if (selectedCuts.length === 0) return;
    setIsExporting(true);
    setExportDone(false);
    setProgress({ current: 0, total: selectedCuts.length, status: "데이터 로드 중..." });

    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      for (let i = 0; i < selectedCuts.length; i++) {
        const cut = selectedCuts[i];
        setProgress({ current: i, total: selectedCuts.length, status: `${cut.label} 처리 중...` });

        // Load cut data
        const data = await loadCutExportData(cut.id);
        if (!data) {
          setProgress({ current: i + 1, total: selectedCuts.length, status: `${cut.label} 데이터 없음 (건너뜀)` });
          continue;
        }

        // Render to data URL
        const dataUrl = await renderCutToDataURL(data, format, quality, scale);

        // Convert data URL to blob and add to zip
        const ext = format === "jpeg" ? "jpg" : "png";
        const base64 = dataUrl.split(",")[1];
        const fileName = `${cut.label.replace(/[^a-zA-Z0-9가-힣_-]/g, "_")}.${ext}`;
        zip.file(fileName, base64, { base64: true });

        setProgress({ current: i + 1, total: selectedCuts.length, status: `${cut.label} 완료` });
      }

      setProgress({ current: selectedCuts.length, total: selectedCuts.length, status: "ZIP 파일 생성 중..." });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      const safeTitle = episodeTitle.replace(/[^a-zA-Z0-9가-힣_-]/g, "_");
      link.download = `${safeTitle}_내보내기_${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      URL.revokeObjectURL(url);

      setExportDone(true);
      setTimeout(() => setExportDone(false), 3000);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[ProjectExport] Failed:", err);
      setProgress({ current: 0, total: 0, status: "내보내기 실패" });
    } finally {
      setIsExporting(false);
    }
  };

  const formatOptions: { value: ExportFormat; label: string; icon: string; desc: string }[] = [
    { value: "png", label: "PNG", icon: "ri-file-image-line", desc: "투명 배경, 고품질 무손실" },
    { value: "jpeg", label: "JPEG", icon: "ri-image-line", desc: "작은 파일 크기" },
  ];

  const scaleOptions = [
    { value: 1, label: "1x", desc: "800×1100" },
    { value: 2, label: "2x", desc: "1600×2200" },
    { value: 3, label: "3x", desc: "2400×3300" },
  ];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 모달 */}
      <div className="relative w-[520px] max-h-[85vh] bg-[#161616] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <i className="ri-folder-zip-line text-emerald-400 text-sm" />
            </div>
            <div>
              <h2 className="text-white text-sm font-semibold">프로젝트 내보내기</h2>
              <p className="text-[#555] text-[10px]">{episodeTitle} — {cuts.length}개 컷</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#666] hover:bg-[#2a2a2a] hover:text-[#ccc] transition-colors cursor-pointer"
          >
            <i className="ri-close-line" />
          </button>
        </div>

        {/* 내용 - 스크롤 가능 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 컷 선택 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] text-[#888] font-medium uppercase tracking-wider">
                내보낼 컷 ({selectedCuts.length}/{cuts.length})
              </label>
              <button
                onClick={toggleAll}
                className="text-[10px] text-orange-400 hover:text-orange-300 cursor-pointer transition-colors whitespace-nowrap"
              >
                {allSelected ? "전체 해제" : "전체 선택"}
              </button>
            </div>
            <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] max-h-[200px] overflow-y-auto">
              {cuts.map((cut) => {
                const isSelected = selectedCutIds.has(cut.id);
                return (
                  <label
                    key={cut.id}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b border-[#2a2a2a] last:border-b-0 hover:bg-[#222] ${
                      isSelected ? "bg-[#222]" : ""
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-orange-500 border-orange-500"
                          : "border-[#444] bg-transparent"
                      }`}
                    >
                      {isSelected && <i className="ri-check-line text-white text-[10px]" />}
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {cut.thumbnail ? (
                        <img
                          src={cut.thumbnail}
                          alt={cut.label}
                          className="w-8 h-11 object-cover rounded shrink-0 bg-[#111]"
                        />
                      ) : (
                        <div className="w-8 h-11 rounded bg-[#111] flex items-center justify-center shrink-0">
                          <i className="ri-image-line text-[#444] text-xs" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs text-[#ccc] font-medium truncate">{cut.label}</div>
                        <div className="text-[9px] text-[#555]">
                          {cut.isGenerated ? "생성됨" : "미생성"}
                          {cut.prompt ? ` · ${cut.prompt.slice(0, 30)}${cut.prompt.length > 30 ? "..." : ""}` : ""}
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleCut(cut.id)}
                      className="sr-only"
                    />
                  </label>
                );
              })}
            </div>
          </div>

          {/* 형식 선택 */}
          <div>
            <label className="text-[11px] text-[#888] font-medium uppercase tracking-wider mb-2 block">
              파일 형식
            </label>
            <div className="grid grid-cols-2 gap-2">
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

          {/* 해상도 배율 */}
          <div>
            <label className="text-[11px] text-[#888] font-medium uppercase tracking-wider mb-2 block">
              해상도 배율
            </label>
            <div className="grid grid-cols-3 gap-2">
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

          {/* 품질 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] text-[#888] font-medium uppercase tracking-wider">
                압축 품질
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
              <span>낮음</span>
              <span>높음</span>
            </div>
          </div>

          {/* 내보내기 정보 */}
          <div className="bg-[#1a1a1a] rounded-xl p-3 border border-[#2a2a2a]">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#555]">컷 개수</span>
                <span className="text-[#aaa]">{selectedCuts.length}개</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#555]">파일 형식</span>
                <span className="text-[#aaa]">{format.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#555]">해상도</span>
                <span className="text-[#aaa]">{Math.round(800 * scale)}×{Math.round(1100 * scale)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#555]">출력</span>
                <span className="text-[#aaa]">ZIP 압축 파일</span>
              </div>
            </div>
          </div>

          {/* 진행 상태 */}
          {isExporting && (
            <div className="bg-[#1a1a1a] rounded-xl p-3 border border-[#2a2a2a]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-[#888]">{progress.status}</span>
                <span className="text-[11px] text-orange-400 font-medium">
                  {progress.current}/{progress.total}
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full transition-all duration-300"
                  style={{
                    width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : "0%",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#2a2a2a] bg-[#111] shrink-0">
          <button
            onClick={onClose}
            className="px-4 h-9 rounded-lg text-sm text-[#888] hover:bg-[#2a2a2a] hover:text-[#ccc] transition-colors cursor-pointer whitespace-nowrap"
          >
            취소
          </button>

          <button
            onClick={handleExport}
            disabled={isExporting || noneSelected}
            className={`flex items-center gap-2 px-5 h-9 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
              exportDone
                ? "bg-emerald-500 text-white"
                : noneSelected
                ? "bg-[#2a2a2a] text-[#555] cursor-not-allowed"
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
                <i className="ri-folder-zip-line" />
                {selectedCuts.length}개 컷 ZIP으로 내보내기
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}