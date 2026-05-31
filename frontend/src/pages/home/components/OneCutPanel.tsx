// 1컷 생성 패널 — 단계 1 placeholder (실구현은 단계 2)
export default function OneCutPanel() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* 헤더 */}
      <div className="px-3 py-2 border-b border-[#2a2a2a] shrink-0">
        <p className="text-[10px] text-[#888]">1컷 생성 (@캐릭터/#배경 태그)</p>
        <p className="text-[9px] text-[#555] mt-0.5">준비 중 — 단계 2에서 구현됩니다</p>
      </div>

      {/* 안내 + 비활성 미리보기 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <i className="ri-tools-line text-3xl text-[#333] mb-2" />
          <p className="text-xs text-[#888] font-medium">🛠 1컷 생성 준비 중</p>
          <p className="text-[10px] text-[#555] mt-1">
            한 문장으로 단일 컷을 생성하는 기능입니다.
          </p>
        </div>

        {/* disabled 미리보기 */}
        <div className="space-y-2 opacity-50 pointer-events-none select-none">
          <p className="text-[9px] text-[#555] uppercase tracking-wider font-medium">
            시나리오 (1컷)
          </p>
          <textarea
            disabled
            rows={4}
            placeholder="예: @지우 가 #카페 에서 미소짓는다"
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-2 text-xs text-white placeholder-[#444] resize-none"
          />
          <button
            type="button"
            disabled
            className="w-full py-2 bg-orange-500 text-white text-xs font-semibold rounded-lg cursor-not-allowed"
          >
            생성
          </button>
        </div>
      </div>
    </div>
  );
}
