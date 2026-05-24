import { api } from "@/lib/api";

// backend ApiResponse<T> wrapper — auth 외 모든 API가 이 형식으로 응답
interface ApiResponseEnvelope<T> {
  data: T;
  message?: string;
}

// === Domain types — backend DTO와 1:1 ===

export type PanelStatus =
  | "CREATED"
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

// GET /api/episodes/{id}/panels, GET /api/panels/{id} — PanelDetailResponse
export interface PanelDetail {
  panelId: number;
  panelOrder: number;
  status: PanelStatus;
  finalImageUrl: string | null;
  layoutData: string | null;
  prompt: string | null;
}

// === API calls — ApiResponse는 호출지점에서 풀음 (auth/aiApi/projectApi/episodeApi 패턴) ===

export async function listPanels(episodeId: number): Promise<PanelDetail[]> {
  const res = await api.get<ApiResponseEnvelope<PanelDetail[]>>(
    `/api/episodes/${episodeId}/panels`
  );
  return res.data.data;
}

// POST /api/episodes/{id}/panels — 빈 panel 생성, panelId(Long)만 반환
export async function createPanel(episodeId: number): Promise<number> {
  const res = await api.post<ApiResponseEnvelope<number>>(
    `/api/episodes/${episodeId}/panels`,
    {}
  );
  return res.data.data;
}

// 미사용 — SortCutsModal에 reorder 저장 기능 추가 시 사용 예정 (별도 작업)
export async function reorderPanels(
  episodeId: number,
  panelIds: number[]
): Promise<void> {
  await api.patch(`/api/episodes/${episodeId}/panels/reorder`, { panelIds });
}

// 미사용 — Cut 개별 삭제 UI 추가 시 사용 예정 (별도 작업)
export async function deletePanel(panelId: number): Promise<void> {
  await api.delete(`/api/panels/${panelId}`);
}
