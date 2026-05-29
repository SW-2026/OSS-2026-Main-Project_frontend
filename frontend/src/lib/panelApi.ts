import api from "@/lib/api";

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
  characterAssetUrl: string | null;
  backgroundAssetUrl: string | null;
}

export interface CharacterMention {
  modelId: number;
  modelName: string;
  triggerWord?: string | null;
  loraModelPath?: string | null;
}

export interface BackgroundMention {
  name: string;
  assetId: number;
  assetUrl?: string | null;
}

export interface PanelsGenerateRequest {
  scenarioText: string;
  characters: CharacterMention[];
  backgrounds?: BackgroundMention[];
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
    `/api/episodes/${episodeId}/panels`
  );
  return res.data.data;
}

export async function deletePanel(panelId: number): Promise<void> {
  await api.delete(`/api/panels/${panelId}`);
}

// === Cut editor data — B0 cutover (supabase + PanelHistory 대체) ===

interface CutEditorDataResponse {
  cutEditorData: string | null;
}

// PATCH /api/panels/{panelId}/cut-data — strokes/balloons/canvasImages/layers JSON 문자열 저장
export async function saveCutEditorData(panelId: number, cutEditorData: string): Promise<void> {
  await api.patch(`/api/panels/${panelId}/cut-data`, { cutEditorData });
}

// GET /api/panels/{panelId}/cut-data — 저장 안 된 panel은 cutEditorData=null
export async function getCutEditorData(panelId: number): Promise<string | null> {
  const res = await api.get<ApiResponseEnvelope<CutEditorDataResponse>>(
    `/api/panels/${panelId}/cut-data`
  );
  return res.data.data.cutEditorData;
}