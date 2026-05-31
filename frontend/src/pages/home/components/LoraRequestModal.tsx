import { useEffect, useRef, useState } from "react";
import type { AxiosProgressEvent } from "axios";
import { createLoraRequest } from "@/lib/loraRequestApi";
import { hangulToRoman, suggestTriggerWord } from "@/lib/romaja";

interface LoraRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void; // 성공 시 부모(내역) 새로고침
}

const MAX_IMAGES = 60;

interface Preview {
  file: File;
  url: string;
}

// 이미지 수 색 단계: 1미만 disabled / 1-9 빨강 / 10-19 노랑 / 20-39 파랑 / 40+ 초록
function countColor(n: number): string {
  if (n < 1) return "text-[#555]";
  if (n < 10) return "text-red-400";
  if (n < 20) return "text-yellow-400";
  if (n < 40) return "text-blue-400";
  return "text-green-400";
}

export default function LoraRequestModal({ isOpen, onClose, onCreated }: LoraRequestModalProps) {
  const [characterName, setCharacterName] = useState("");
  const [romanName, setRomanName] = useState("");
  const [triggerWord, setTriggerWord] = useState("");
  const [manualRoman, setManualRoman] = useState(false);
  const [manualTrigger, setManualTrigger] = useState(false);

  const [previews, setPreviews] = useState<Preview[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef<Preview[]>([]);
  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  // unmount 시 모든 objectURL 정리
  useEffect(() => () => previewsRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  if (!isOpen) return null;

  const count = previews.length;
  const tooMany = count >= MAX_IMAGES;

  // 자동 채움 — 사용자가 직접 수정하면 멈춤
  const handleNameChange = (v: string) => {
    setCharacterName(v);
    if (!manualRoman) {
      const roman = hangulToRoman(v);
      setRomanName(roman);
      if (!manualTrigger) setTriggerWord(suggestTriggerWord(roman));
    }
  };
  const handleRomanChange = (v: string) => {
    setRomanName(v);
    setManualRoman(true);
    if (!manualTrigger) setTriggerWord(suggestTriggerWord(v));
  };
  const handleTriggerChange = (v: string) => {
    setTriggerWord(v);
    setManualTrigger(true);
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list).filter((f) => f.type.startsWith("image/"));
    setPreviews((prev) => {
      const room = MAX_IMAGES - prev.length;
      const added = incoming.slice(0, room).map((f) => ({ file: f, url: URL.createObjectURL(f) }));
      return [...prev, ...added];
    });
  };
  const removeFile = (idx: number) => {
    setPreviews((prev) => {
      const target = prev[idx];
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const canSubmit =
    !!characterName.trim() && !!triggerWord.trim() && count >= 1 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    setProgress(0);
    try {
      await createLoraRequest(
        { characterName: characterName.trim(), triggerWord: triggerWord.trim() },
        previews.map((p) => p.file),
        (e: AxiosProgressEvent) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        }
      );
      previews.forEach((p) => URL.revokeObjectURL(p.url));
      onCreated();
      onClose();
      // reset
      setCharacterName("");
      setRomanName("");
      setTriggerWord("");
      setManualRoman(false);
      setManualTrigger(false);
      setPreviews([]);
      setProgress(0);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "신청에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={isSubmitting ? undefined : onClose}
      />
      <div className="relative w-[96vw] h-[92vh] bg-[#161616] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <i className="ri-magic-line text-orange-400 text-sm" />
            </div>
            <div>
              <h2 className="text-white text-sm font-semibold">LoRA 신청</h2>
              <p className="text-[#555] text-[10px]">레퍼런스 이미지로 캐릭터 학습을 신청합니다</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#666] hover:bg-[#2a2a2a] hover:text-[#ccc] transition-colors cursor-pointer disabled:opacity-40"
          >
            <i className="ri-close-line" />
          </button>
        </div>

        {/* 본문: 좌 1/3 입력 / 우 2/3 이미지 */}
        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/3 max-w-[380px] border-r border-[#2a2a2a] p-5 space-y-4 overflow-y-auto">
            <div>
              <label className="text-[11px] text-[#888] font-medium">캐릭터명</label>
              <input
                value={characterName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="예: 지우"
                className="w-full mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-[#888] font-medium">
                영문명 <span className="text-[#555]">(자동 제안 · 수정 가능)</span>
              </label>
              <input
                value={romanName}
                onChange={(e) => handleRomanChange(e.target.value)}
                placeholder="Jiwoo"
                className="w-full mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-[#888] font-medium">트리거 워드</label>
              <textarea
                value={triggerWord}
                onChange={(e) => handleTriggerChange(e.target.value)}
                rows={4}
                placeholder="Jiwoo, ..."
                className="w-full mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-orange-500 resize-none"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#888]">이미지 수</span>
              <span className={`text-sm font-semibold ${countColor(count)}`}>{count}장</span>
            </div>
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-2 py-1.5 text-red-400 text-[11px]">
                {error}
              </div>
            )}
            {isSubmitting && (
              <div>
                <div className="flex justify-between text-[10px] text-[#888] mb-1">
                  <span>{progress < 100 ? "업로드 중..." : "처리 중..."}</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 p-5 flex flex-col overflow-hidden">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                addFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`shrink-0 border-2 border-dashed rounded-xl py-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                dragOver ? "border-orange-500 bg-orange-500/5" : "border-[#2a2a2a] hover:border-[#444]"
              } ${tooMany ? "opacity-40 pointer-events-none" : ""}`}
            >
              <i className="ri-upload-cloud-2-line text-2xl text-[#555] mb-1" />
              <p className="text-xs text-[#888]">드래그하거나 클릭하여 이미지 추가</p>
              <p className="text-[10px] text-[#555] mt-0.5">
                PNG/JPEG/WebP · 최대 {MAX_IMAGES}장 {tooMany ? "(상한 도달)" : ""}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="flex-1 overflow-y-auto mt-3">
              {count === 0 ? (
                <p className="text-[11px] text-[#555] text-center pt-6">아직 이미지가 없습니다.</p>
              ) : (
                <div className="grid grid-cols-6 gap-2">
                  {previews.map((p, i) => (
                    <div
                      key={p.url}
                      className="relative aspect-square rounded-lg overflow-hidden border border-[#2a2a2a] bg-[#111]"
                    >
                      <img src={p.url} alt={`이미지 ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeFile(i)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center bg-black/70 rounded text-white hover:bg-red-500 cursor-pointer"
                      >
                        <i className="ri-close-line text-xs" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#2a2a2a] bg-[#111] shrink-0">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 h-9 rounded-lg text-sm text-[#888] hover:bg-[#2a2a2a] hover:text-[#ccc] transition-colors cursor-pointer disabled:opacity-40"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-5 h-9 rounded-lg text-sm font-medium transition-all cursor-pointer bg-orange-500 text-white hover:bg-orange-600 disabled:bg-[#2a2a2a] disabled:text-[#555] disabled:cursor-not-allowed"
          >
            {isSubmitting ? "신청 중..." : `신청 제출 (${count}장)`}
          </button>
        </div>
      </div>
    </div>
  );
}
