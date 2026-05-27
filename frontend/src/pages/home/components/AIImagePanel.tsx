import { useState, useRef, useCallback, useEffect } from "react";

export type AIGeneratedImage = {
  id: string;
  url: string;
  prompt: string;
  type: "generated" | "uploaded";
  timestamp: number;
  isLoading?: boolean;
};

interface AIImagePanelProps {
  promptText: string;
  onPromptChange: (v: string) => void;
  isGenerating: boolean;
  onGenerate: (prompt: string, options?: { count?: number; width?: number; height?: number }) => void;
  generatedImages: AIGeneratedImage[];
  onApplyImage: (img: AIGeneratedImage) => void;
  onVectorize: (img: AIGeneratedImage) => void;
  onEditCut: (img: AIGeneratedImage) => void;
  onUploadImage: (file: File) => void;
  isVectorizing: boolean;
  onImageLoad?: (id: string) => void;
}

const RATIOS = [
  { id: "portrait", label: "9:16 세로", width: 1024, height: 1536, icon: "ri-smartphone-line" },
  { id: "square", label: "1:1 정사각", width: 1024, height: 1024, icon: "ri-shape-line" },
  { id: "landscape", label: "16:9 가로", width: 1536, height: 1024, icon: "ri-tv-line" },
];

const QUICK_PROMPTS = [
  { label: "소녀 캐릭터", prompt: "beautiful girl character, expressive eyes, detailed face, full body" },
  { label: "소년 캐릭터", prompt: "handsome boy character, dynamic pose, casual outfit, confident expression" },
  { label: "교실 배경", prompt: "classroom interior, desks and chairs, window light, school atmosphere" },
  { label: "도시 배경", prompt: "city street scene, buildings, neon lights, night atmosphere, detailed" },
  { label: "감정 표현", prompt: "character close up face, emotional expression, dramatic lighting, detailed eyes" },
  { label: "액션 씬", prompt: "dynamic action scene, speed lines, dramatic angle, intense movement" },
];

function LazyImage({
  src,
  alt,
  className,
  onLoad,
  onErrorDone,
  isLoading,
}: {
  src: string;
  alt: string;
  className?: string;
  onLoad?: () => void;
  onErrorDone?: () => void;
  isLoading?: boolean;
}) {
  const [displaySrc, setDisplaySrc] = useState(src);
  const retryCount = useRef(0);

  useEffect(() => {
    setDisplaySrc(src);
    retryCount.current = 0;
  }, [src]);

  const handleError = useCallback(() => {
    if (retryCount.current < 6) {
      retryCount.current += 1;
      const delay = retryCount.current * 2000;
      setTimeout(() => {
        setDisplaySrc((prev) => {
          const separator = prev.includes("?") ? "&" : "?";
          return `${prev}${separator}_retry=${Date.now()}`;
        });
      }, delay);
    } else {
      onErrorDone?.();
    }
  }, [onErrorDone]);

  return (
    <div className="relative w-full h-full">
      <img
        src={displaySrc}
        alt={alt}
        className={className}
        crossOrigin="anonymous"
        onLoad={onLoad}
        onError={handleError}
      />
      {isLoading && (
        <div className="absolute inset-0 bg-[#111]/80 flex flex-col items-center justify-center gap-1">
          <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-[9px] text-[#888]">생성 중...</span>
        </div>
      )}
    </div>
  );
}

export default function AIImagePanel({
  promptText,
  onPromptChange,
  isGenerating,
  onGenerate,
  generatedImages,
  onApplyImage,
  onVectorize,
  onEditCut,
  onUploadImage,
  isVectorizing,
  onImageLoad,
}: AIImagePanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<"generate" | "upload" | "history">("generate");
  const [selectedRatio, setSelectedRatio] = useState("portrait");
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleQuickPrompt = (prompt: string) => {
    onPromptChange(prompt);
  };

  const handleGenerate = () => {
    if (!promptText.trim() || isGenerating) return;
    const ratio = RATIOS.find((r) => r.id === selectedRatio)!;
    onGenerate(promptText.trim(), { count: 4, width: ratio.width, height: ratio.height });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUploadImage(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) onUploadImage(file);
    },
    [onUploadImage]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  // 최신 생성된 4개 = "현재 배치"
  const generatedAll = generatedImages.filter((img) => img.type === "generated");
  const latestBatch = generatedAll.slice(0, 4);
  const previousResults = generatedAll.slice(4);

  const selectedImage = generatedImages.find((img) => img.id === selectedImageId);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* 서브 탭 */}
      <div className="flex border-b border-[#2a2a2a] shrink-0">
        {(
          [
            { key: "generate", label: "AI 생성", icon: "ri-sparkling-line" },
            { key: "upload", label: "업로드", icon: "ri-upload-2-line" },
            { key: "history", label: "히스토리", icon: "ri-history-line" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-[10px] transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === tab.key
                ? "text-orange-400 border-b-2 border-orange-500 bg-orange-500/5"
                : "text-[#666] hover:text-[#aaa]"
            }`}
          >
            <i className={`${tab.icon} text-xs`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── 생성 탭 ─── */}
      {activeSubTab === "generate" && (
        <div className="flex flex-col flex-1 overflow-y-auto p-3 gap-3">
          {/* 프롬프트 입력 영역 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[9px] text-[#555] uppercase tracking-wider font-medium">프롬프트</label>
              <button
                onClick={() => onPromptChange("")}
                className="text-[9px] text-[#555] hover:text-[#888] cursor-pointer whitespace-nowrap"
              >
                초기화
              </button>
            </div>
            <textarea
              value={promptText}
              onChange={(e) => onPromptChange(e.target.value)}
              placeholder="원하는 장면을 자세히 설명해보세요. 예: 교실 창가에 서 있는 소녀, 슬픈 표정, 저녁 노을..."
              className="w-full h-20 bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg p-2.5 text-xs text-[#ccc] placeholder-[#444] resize-none outline-none focus:border-orange-500/50 transition-colors leading-relaxed"
              maxLength={500}
            />
            <div className="flex justify-end mt-0.5">
              <span className="text-[9px] text-[#555]">{promptText.length}/500</span>
            </div>
          </div>

          {/* 빠른 프롬프트 */}
          <div>
            <p className="text-[9px] text-[#555] uppercase tracking-wider font-medium mb-2">빠른 선택</p>
            <div className="flex flex-wrap gap-1">
              {QUICK_PROMPTS.map((qp) => (
                <button
                  key={qp.label}
                  onClick={() => handleQuickPrompt(qp.prompt)}
                  className="px-2 py-1 rounded-full text-[10px] bg-[#1e1e1e] text-[#aaa] border border-[#2a2a2a] hover:border-orange-500/40 hover:text-orange-400 transition-all cursor-pointer whitespace-nowrap"
                >
                  {qp.label}
                </button>
              ))}
            </div>
          </div>

          {/* 비율 선택 */}
          <div>
            <p className="text-[9px] text-[#555] uppercase tracking-wider font-medium mb-2">비율</p>
            <div className="flex gap-1.5">
              {RATIOS.map((ratio) => (
                <button
                  key={ratio.id}
                  onClick={() => setSelectedRatio(ratio.id)}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] transition-all cursor-pointer whitespace-nowrap border ${
                    selectedRatio === ratio.id
                      ? "bg-orange-500/15 text-orange-400 border-orange-500/40"
                      : "bg-[#1e1e1e] text-[#888] border-[#2a2a2a] hover:border-[#444]"
                  }`}
                >
                  <i className={`${ratio.icon} text-xs`} />
                  {ratio.label}
                </button>
              ))}
            </div>
          </div>

          {/* 웹툰 스타일 고정 배지 */}
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <i className="ri-book-open-line text-orange-400 text-xs" />
            <span className="text-[10px] text-orange-400 font-medium">웹툰 스타일 자동 적용</span>
            <span className="text-[9px] text-[#666] ml-auto">Korean webtoon / manhwa</span>
          </div>

          {/* 생성 버튼 */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !promptText.trim()}
            className="w-full h-10 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shadow-[0_0_20px_rgba(249,115,22,0.25)]"
          >
            {isGenerating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                이미지 생성 중...
              </>
            ) : (
              <>
                <i className="ri-sparkling-fill" />
                이미지 4개 생성
              </>
            )}
          </button>

          {/* 방금 생성된 결과 — 2x2 그리드 */}
          {latestBatch.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] text-[#555] uppercase tracking-wider font-medium">생성 결과</p>
                <span className="text-[9px] text-[#555]">{latestBatch.filter((i) => !i.isLoading).length}/4</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {latestBatch.map((img) => (
                  <div
                    key={img.id}
                    className={`relative rounded-xl overflow-hidden border cursor-pointer group transition-all ${
                      selectedImageId === img.id
                        ? "border-orange-500 ring-1 ring-orange-500/30"
                        : "border-[#2a2a2a] hover:border-[#444]"
                    }`}
                    onClick={() =>
                      setSelectedImageId(img.id === selectedImageId ? null : img.id)
                    }
                  >
                    <div className="w-full aspect-[3/4] bg-[#1a1a1a]">
                      <LazyImage
                        src={img.url}
                        alt={img.prompt}
                        className="w-full h-full object-cover"
                        onLoad={() => onImageLoad?.(img.id)}
                        onErrorDone={() => onImageLoad?.(img.id)}
                        isLoading={img.isLoading}
                      />
                    </div>

                    {/* 호버 액션 오버레이 */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onApplyImage(img);
                        }}
                        className="w-full px-2 py-1 bg-orange-500 text-white text-[9px] rounded-md cursor-pointer whitespace-nowrap font-semibold flex items-center justify-center gap-1"
                      >
                        <i className="ri-image-add-line" />
                        캔버스 적용
                      </button>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditCut(img);
                          }}
                          className="flex-1 px-2 py-1 bg-[#333] text-[#ddd] text-[9px] rounded-md cursor-pointer whitespace-nowrap flex items-center justify-center gap-1"
                        >
                          <i className="ri-edit-2-line" />
                          편집
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onVectorize(img);
                          }}
                          disabled={isVectorizing}
                          className="flex-1 px-2 py-1 bg-[#222] text-[#aaa] text-[9px] rounded-md cursor-pointer whitespace-nowrap disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <i className="ri-node-tree" />
                          {isVectorizing ? "처리 중" : "벡터화"}
                        </button>
                      </div>
                    </div>

                    {/* 선택 표시 배지 */}
                    {selectedImageId === img.id && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                        <i className="ri-check-line text-white text-xs" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 선택된 이미지 일괄 액션 */}
              {selectedImage && (
                <div className="flex gap-1.5 mt-2">
                  <button
                    onClick={() => onApplyImage(selectedImage)}
                    className="flex-1 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-[10px] rounded-lg cursor-pointer whitespace-nowrap font-semibold flex items-center justify-center gap-1 transition-colors"
                  >
                    <i className="ri-image-add-line" />
                    선택 이미지 적용
                  </button>
                  <button
                    onClick={() => onEditCut(selectedImage)}
                    className="px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#333] text-[#ccc] text-[10px] rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1 transition-colors"
                  >
                    <i className="ri-edit-2-line" />
                    편집
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 이전 생성 결과 — 작게 */}
          {previousResults.length > 0 && (
            <div>
              <p className="text-[9px] text-[#555] uppercase tracking-wider font-medium mb-2">이전 결과</p>
              <div className="grid grid-cols-2 gap-1.5">
                {previousResults.slice(0, 4).map((img) => (
                  <div
                    key={img.id}
                    className="relative rounded-lg overflow-hidden border border-[#2a2a2a] hover:border-[#444] cursor-pointer group transition-all"
                    onClick={() => setSelectedImageId(img.id === selectedImageId ? null : img.id)}
                  >
                    <div className="w-full aspect-square bg-[#1a1a1a]">
                      <LazyImage
                        src={img.url}
                        alt={img.prompt}
                        className="w-full h-full object-cover"
                        onLoad={() => onImageLoad?.(img.id)}
                        onErrorDone={() => onImageLoad?.(img.id)}
                        isLoading={img.isLoading}
                      />
                    </div>
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 p-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onApplyImage(img);
                        }}
                        className="px-2 py-0.5 bg-orange-500 text-white text-[9px] rounded cursor-pointer whitespace-nowrap font-semibold"
                      >
                        적용
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onVectorize(img);
                        }}
                        className="px-2 py-0.5 bg-[#333] text-[#ddd] text-[9px] rounded cursor-pointer whitespace-nowrap"
                      >
                        벡터화
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── 업로드 탭 ─── */}
      {activeSubTab === "upload" && (
        <div className="flex flex-col flex-1 overflow-y-auto p-3 gap-3">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-3 h-36 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
              isDragOver
                ? "border-orange-500 bg-orange-500/10"
                : "border-[#2a2a2a] hover:border-[#444] bg-[#1a1a1a]"
            }`}
          >
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#222]">
              <i className="ri-upload-cloud-2-line text-xl text-[#666]" />
            </div>
            <div className="text-center">
              <p className="text-xs text-[#888]">이미지를 드래그하거나 클릭</p>
              <p className="text-[10px] text-[#555] mt-0.5">PNG, JPG, WEBP 지원</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="bg-[#1a1a1a] rounded-lg p-3 border border-[#2a2a2a]">
            <p className="text-[10px] text-[#888] font-medium mb-2 flex items-center gap-1.5">
              <i className="ri-information-line text-orange-400" />
              업로드 후 가능한 작업
            </p>
            <ul className="space-y-1.5">
              {[
                { icon: "ri-focus-3-line", text: "선 자동 추출 (Edge Detection)" },
                { icon: "ri-node-tree", text: "SVG 벡터로 변환" },
                { icon: "ri-edit-line", text: "선 굵기/곡률 직접 편집" },
                { icon: "ri-magic-line", text: "AI 선 자동 보정" },
              ].map((item) => (
                <li key={item.text} className="flex items-center gap-2 text-[10px] text-[#666]">
                  <i className={`${item.icon} text-orange-400/70 text-xs`} />
                  {item.text}
                </li>
              ))}
            </ul>
          </div>

          {/* 업로드된 이미지 목록 */}
          {generatedImages.filter((img) => img.type === "uploaded").length > 0 && (
            <div>
              <p className="text-[9px] text-[#555] uppercase tracking-wider font-medium mb-2">업로드된 이미지</p>
              <div className="grid grid-cols-2 gap-1.5">
                {generatedImages
                  .filter((img) => img.type === "uploaded")
                  .map((img) => (
                    <div
                      key={img.id}
                      className="relative rounded-lg overflow-hidden border border-[#2a2a2a] hover:border-[#444] cursor-pointer group transition-all"
                    >
                      <div className="w-full aspect-square bg-[#1a1a1a]">
                        <LazyImage
                          src={img.url}
                          alt="업로드"
                          className="w-full h-full object-cover"
                          onLoad={() => onImageLoad?.(img.id)}
                          onErrorDone={() => onImageLoad?.(img.id)}
                          isLoading={img.isLoading}
                        />
                      </div>
                      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
                        <button
                          onClick={() => onEditCut(img)}
                          className="w-full px-2 py-1 bg-orange-500 text-white text-[9px] rounded cursor-pointer whitespace-nowrap font-semibold flex items-center justify-center gap-1"
                        >
                          <i className="ri-edit-2-line" />
                          컷 편집
                        </button>
                        <button
                          onClick={() => onApplyImage(img)}
                          className="w-full px-2 py-0.5 bg-[#444] text-[#ddd] text-[9px] rounded cursor-pointer whitespace-nowrap flex items-center justify-center gap-1"
                        >
                          <i className="ri-image-add-line" />
                          캔버스 적용
                        </button>
                        <button
                          onClick={() => onVectorize(img)}
                          disabled={isVectorizing}
                          className="w-full px-2 py-0.5 bg-[#333] text-[#aaa] text-[9px] rounded cursor-pointer whitespace-nowrap disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <i className="ri-node-tree" />
                          {isVectorizing ? "처리 중..." : "선 벡터화"}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── 히스토리 탭 ─── */}
      {activeSubTab === "history" && (
        <div className="flex flex-col flex-1 overflow-y-auto p-3 gap-2">
          {generatedImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-2 text-[#555]">
              <i className="ri-history-line text-2xl" />
              <p className="text-xs">아직 생성된 이미지가 없어요</p>
            </div>
          ) : (
            generatedImages.map((img) => (
              <div
                key={img.id}
                className="flex gap-2 p-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#333] transition-colors"
              >
                <div className="w-12 h-12 rounded-md overflow-hidden shrink-0 bg-[#111]">
                  <LazyImage
                    src={img.url}
                    alt={img.prompt}
                    className="w-full h-full object-cover"
                    onLoad={() => onImageLoad?.(img.id)}
                    onErrorDone={() => onImageLoad?.(img.id)}
                    isLoading={img.isLoading}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span
                      className={`text-[8px] px-1.5 py-0.5 rounded-full ${
                        img.type === "generated"
                          ? "bg-orange-500/20 text-orange-400"
                          : "bg-[#333] text-[#888]"
                      }`}
                    >
                      {img.type === "generated" ? "AI 생성" : "업로드"}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#888] truncate leading-relaxed">
                    {img.prompt || "업로드된 이미지"}
                  </p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    <button
                      onClick={() => onApplyImage(img)}
                      className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-[9px] rounded cursor-pointer whitespace-nowrap hover:bg-orange-500/30 transition-colors"
                    >
                      적용
                    </button>
                    <button
                      onClick={() => onEditCut(img)}
                      className="px-1.5 py-0.5 bg-[#222] text-[#888] text-[9px] rounded cursor-pointer whitespace-nowrap hover:bg-[#2a2a2a] transition-colors"
                    >
                      편집
                    </button>
                    <button
                      onClick={() => onVectorize(img)}
                      className="px-1.5 py-0.5 bg-[#222] text-[#888] text-[9px] rounded cursor-pointer whitespace-nowrap hover:bg-[#2a2a2a] transition-colors"
                    >
                      벡터화
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}