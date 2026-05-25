import { api } from "@/lib/api";

// backend ApiResponse<T> wrapper — auth 외 모든 API가 이 형식으로 응답
interface ApiResponseEnvelope<T> {
  data: T;
  message?: string;
}

// === Domain types — backend DTO와 1:1 ===

export type TaskStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
export type TaskType = "CHARACTER" | "PANELS" | "COMPOSE" | "BACKGROUND" | "SEGMENT" | "REFINE";
export type PanelStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface TaskResponse {
  taskId: number;
  taskType: TaskType;
  status: TaskStatus;
  progressPercent: number | null;
  targetType: string | null;
  targetId: number | null;
  resultUrl: string | null;
  errorMessage: string | null;
}

export interface PanelDetailResponse {
  panelId: number;
  panelOrder: number;
  status: PanelStatus;
  finalImageUrl: string | null;
  layoutData: string | null;
  prompt: string | null;
}

export interface CharacterMention {
  name: string;
  modelId: number;
  triggerWord: string;
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

// === API calls — ApiResponse는 호출지점에서 풀음 (auth와 동일 패턴) ===

export async function generatePanels(
  episodeId: number,
  body: PanelsGenerateRequest
): Promise<TaskResponse> {
  const res = await api.post<ApiResponseEnvelope<TaskResponse>>(
    `/api/episodes/${episodeId}/panels/generate`,
    body
  );
  return res.data.data;
}

export async function getTask(taskId: number): Promise<TaskResponse> {
  const res = await api.get<ApiResponseEnvelope<TaskResponse>>(
    `/api/ai/tasks/${taskId}`
  );
  return res.data.data;
}

export async function getEpisodePanels(
  episodeId: number
): Promise<PanelDetailResponse[]> {
  const res = await api.get<ApiResponseEnvelope<PanelDetailResponse[]>>(
    `/api/episodes/${episodeId}/panels`
  );
  return res.data.data;
}
