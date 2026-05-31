import { useEffect, useState } from "react";
import {
  listMyLoraRequests,
  listAllLoraRequests,
  checkAdmin,
  type LoraRequestResponse,
  type LoraRequestStatus,
} from "@/lib/loraRequestApi";

interface LoraRequestHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  refreshKey: number; // 신청 성공 시 증가 → 재조회
}

function statusBadge(s: LoraRequestStatus): string {
  switch (s) {
    case "PENDING":
      return "bg-[#333] text-[#aaa]";
    case "TRAINING":
      return "bg-yellow-500/20 text-yellow-400";
    case "COMPLETED":
      return "bg-green-500/20 text-green-400";
    case "FAILED":
    case "REJECTED":
      return "bg-red-500/20 text-red-400";
    default:
      return "bg-[#333] text-[#aaa]";
  }
}

const fmt = (s: string | null) => (s ? s.replace("T", " ").slice(0, 16) : "—");

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-[#555] w-20 shrink-0">{label}</span>
      <span className="text-[#ccc] break-all">{value}</span>
    </div>
  );
}

export default function LoraRequestHistoryModal({
  isOpen,
  onClose,
  refreshKey,
}: LoraRequestHistoryModalProps) {
  const [mine, setMine] = useState<LoraRequestResponse[]>([]);
  const [pending, setPending] = useState<LoraRequestResponse[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LoraRequestResponse | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    setLoading(true);
    setError(null);
    setSelected(null);
    (async () => {
      try {
        const list = await listMyLoraRequests();
        if (!alive) return;
        setMine(list);
        let admin = false;
        try {
          admin = await checkAdmin();
        } catch {
          admin = false;
        }
        if (!alive) return;
        setIsAdmin(admin);
        if (admin) {
          try {
            const p = await listAllLoraRequests("PENDING");
            if (alive) setPending(p);
          } catch {
            // 관리자 목록 실패는 무시 (내 목록은 표시)
          }
        }
      } catch (e: any) {
        if (alive) setError(e?.message ?? "내역 조회에 실패했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isOpen, refreshKey]);

  if (!isOpen) return null;

  const renderItem = (r: LoraRequestResponse) => (
    <button
      key={r.requestId}
      onClick={() => setSelected(r)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#444] text-left cursor-pointer"
    >
      <span className={`text-[9px] px-1.5 py-0.5 rounded shrink-0 ${statusBadge(r.status)}`}>
        {r.status}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[#ccc] truncate">{r.characterName}</p>
        <p className="text-[9px] text-[#555]">
          {fmt(r.createdAt)} · {r.imageCount}장
        </p>
      </div>
      <i className="ri-arrow-right-s-line text-[#555]" />
    </button>
  );

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[560px] max-h-[85vh] bg-[#161616] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a] shrink-0">
          <h2 className="text-white text-sm font-semibold">내 LoRA 신청 내역</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#666] hover:bg-[#2a2a2a] hover:text-[#ccc] cursor-pointer"
          >
            <i className="ri-close-line" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <p className="text-[11px] text-[#555] text-center pt-4">로딩 중...</p>
          ) : error ? (
            <p className="text-[11px] text-red-400 text-center pt-4">{error}</p>
          ) : (
            <>
              <div className="space-y-1.5">
                {mine.length === 0 ? (
                  <p className="text-[11px] text-[#555]">신청 내역이 없습니다.</p>
                ) : (
                  mine.map(renderItem)
                )}
              </div>
              {isAdmin && (
                <div className="pt-3 border-t border-[#2a2a2a]">
                  <p className="text-[10px] text-orange-400 uppercase tracking-wider font-medium mb-2">
                    [관리자] 전체 PENDING ({pending.length})
                  </p>
                  <div className="space-y-1.5">
                    {pending.length === 0 ? (
                      <p className="text-[11px] text-[#555]">대기 중인 신청이 없습니다.</p>
                    ) : (
                      pending.map(renderItem)
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 상세 (오버레이) */}
        {selected && (
          <div className="absolute inset-0 bg-[#161616] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a]">
              <button
                onClick={() => setSelected(null)}
                className="text-[#888] hover:text-[#ccc] text-sm cursor-pointer"
              >
                <i className="ri-arrow-left-line mr-1" />
                뒤로
              </button>
              <span className={`text-[9px] px-1.5 py-0.5 rounded ${statusBadge(selected.status)}`}>
                {selected.status}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-2 text-xs">
              <Row label="캐릭터명" value={selected.characterName} />
              <Row label="트리거" value={selected.triggerWord} />
              <Row label="이미지 수" value={`${selected.imageCount}장`} />
              <Row label="이미지 경로" value={selected.imageDir ?? "—"} />
              <Row label="신청일" value={fmt(selected.createdAt)} />
              <Row label="완료일" value={fmt(selected.completedAt)} />
              {selected.adminNotes && <Row label="관리자 메모" value={selected.adminNotes} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
