import api from "@/lib/api";

// backend ApiResponse<T> wrapper — auth 외 모든 API가 이 형식으로 응답
interface ApiResponseEnvelope<T> {
  data: T;
  message?: string;
}

// === Domain types — backend DTO와 1:1 ===

// GET /api/projects/{id}/episodes — 경량 응답 (panelCount 포함)
export interface EpisodeSummary {
  episodeId: number;
  epNumber: number;
  epTitle: string;
  panelCount: number;
  createdAt: string;
}

// POST /api/projects/{id}/episodes, PATCH /api/episodes/{id} — 단건 응답
export interface EpisodeResponse {
  episodeId: number;
  projectId: number;
  epNumber: number;
  epTitle: string;
  createdAt: string;
}

export interface EpisodeCreateBody {
  epNumber: number;
  epTitle: string;
}

export interface EpisodeUpdateBody {
  epNumber?: number;
  epTitle?: string;
}

// === API calls — ApiResponse는 호출지점에서 풀음 (auth/aiApi/characterApi/projectApi 패턴) ===
export async function listEpisodes(projectId: number): Promise<EpisodeSummary[]> {
  const res = await api.get<ApiResponseEnvelope<EpisodeSummary[]>>(
    `/api/projects/${projectId}/episodes`
  );
  return res.data.data;
}

export async function createEpisode(
  projectId: number,
  body: EpisodeCreateBody
): Promise<EpisodeResponse> {
  const res = await api.post<ApiResponseEnvelope<EpisodeResponse>>(
    `/api/projects/${projectId}/episodes`,
    body
  );
  return res.data.data;
}

export async function updateEpisode(
  episodeId: number,
  body: EpisodeUpdateBody
): Promise<EpisodeResponse> {
  const res = await api.patch<ApiResponseEnvelope<EpisodeResponse>>(
    `/api/episodes/${episodeId}`,
    body
  );
  return res.data.data;
}

export async function deleteEpisode(episodeId: number): Promise<void> {
  await api.delete(`/api/episodes/${episodeId}`);
}