import { useState, useRef, useCallback, useEffect } from "react";

export type AIGeneratedImage = {
  id: string;
  url: string;
  prompt: string;
  type: "generated" | "uploaded";
  timestamp: number;
  isLoading?: boolean;
};

interface ImagePanelProps {
  generatedImages: AIGeneratedImage[];
  onApplyImage: (img: AIGeneratedImage) => void;
  onVectorize: (img: AIGeneratedImage) => void;
  onEditCut: (img: AIGeneratedImage) => void;
  onUploadImage: (file: File) => void;
  isVectorizing: boolean;
  onImageLoad?: (id: string) => void;
}

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
          <span className="text-[9px] text-[#888]">로딩 중...</span>
        </div>
      )}
    </div>
  );
}

export default function ImagePanel({
  generatedImages,
  onApplyImage,
  onVectorize,
  onEditCut,
  onUploadImage,
  isVectorizing,
  onImageLoad,
}: ImagePanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<"upload" | "history">("upload");
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const selectedImage = generatedImages.find((img) => img.id === selectedImageId);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* 서브 탭 */}
      <div className="flex border-b border-[#2a2a2a] shrink-0">
        {(
          [
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
                { icon: "ri-focus-3-line", text: "선 자동 추출 (벡터화)" },
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
              <p className="text-xs">아직 업로드된 이미지가 없어요</p>
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