import api from "@/lib/api";

// backend ApiResponse<T> wrapper — auth 외 모든 API가 이 형식으로 응답
interface ApiResponseEnvelope<T> {
  data: T;
  message?: string;
}

// === Domain types — backend DTO와 1:1 ===

// GET /api/projects — 경량 응답 (episodeCount 포함)
export interface ProjectSummary {
  projectId: number;
  title: string;
  genre: string | null;
  episodeCount: number;
  createdAt: string;
}

// POST /api/projects — 생성 응답 (memberId 포함, episodeCount 없음)
export interface ProjectResponse {
  projectId: number;
  memberId: number;
  title: string;
  genre: string | null;
  createdAt: string;
}

export interface ProjectCreateBody {
  title: string;
  genre?: string;
}

// === API calls — ApiResponse는 호출지점에서 풀음 (auth/aiApi/characterApi와 동일 패턴) ===
export async function listProjects(): Promise<ProjectSummary[]> {
  const res = await api.get<ApiResponseEnvelope<ProjectSummary[]>>(
    "/api/projects"
  );
  return res.data.data;
}

export async function createProject(
  body: ProjectCreateBody
): Promise<ProjectResponse> {
  const res = await api.post<ApiResponseEnvelope<ProjectResponse>>(
    "/api/projects",
    body
  );
  return res.data.data;
}

export async function deleteProject(projectId: number): Promise<void> {
  await api.delete(`/api/projects/${projectId}`);
}