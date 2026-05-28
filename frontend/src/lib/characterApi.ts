import api from "@/lib/api";

// backend ApiResponse<T> wrapper — auth 외 모든 API가 이 형식으로 응답
interface ApiResponseEnvelope<T> {
  data: T;
  message?: string;
}

// === Domain types — backend DTO와 1:1 ===

export type CharacterStatus = "PENDING" | "TRAINING" | "ACTIVE" | "FAILED";

// GET /api/projects/{id}/models — 경량 응답
export interface CharacterModelSummary {
  modelId: number;
  modelName: string;
  status: CharacterStatus;
  createdAt: string;
}

// GET /api/models/{modelId}, POST /api/projects/{id}/models — 전체 응답
export interface CharacterModelDetail {
  modelId: number;
  projectId: number;
  modelName: string;
  triggerWord: string | null;
  loraModelPath: string | null;
  appearancePrompt: string | null;
  outfitPrompt: string | null;
  status: CharacterStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterCreateBody {
  modelName: string;
  triggerWord?: string;
  loraModelPath?: string;
  appearancePrompt?: string;
  outfitPrompt?: string;
}

// === API calls — ApiResponse는 호출지점에서 풀음 (auth/aiApi와 동일 패턴) ===

export async function listCharacters(
  projectId: number
): Promise<CharacterModelSummary[]> {
  const res = await api.get<ApiResponseEnvelope<CharacterModelSummary[]>>(
    `/api/projects/${projectId}/models`
  );
  return res.data.data;
}

export async function getCharacter(
  modelId: number
): Promise<CharacterModelDetail> {
  const res = await api.get<ApiResponseEnvelope<CharacterModelDetail>>(
    `/api/models/${modelId}`
  );
  return res.data.data;
}

export async function createCharacter(
  projectId: number,
  body: CharacterCreateBody,
  images: File[]
): Promise<CharacterModelDetail> {
  const fd = new FormData();
  fd.append(
    "metadata",
    new Blob([JSON.stringify(body)], { type: "application/json" })
  );
  for (const img of images) {
    fd.append("images", img);
  }
  const res = await api.post<ApiResponseEnvelope<CharacterModelDetail>>(
    `/api/projects/${projectId}/models`,
    fd
  );
  return res.data.data;
}

// === LoRA catalog — 시연 PC LoRA 카탈로그 (소재 탭 + 캐릭터 등록 select용) ===

export interface LoraCatalogItem {
  id: number;
  fileName: string;
  displayName: string;
  thumbnailUrl: string | null;
  triggerWord: string | null;
  description: string | null;
}

export async function listLoras(): Promise<LoraCatalogItem[]> {
  const res = await api.get<ApiResponseEnvelope<LoraCatalogItem[]>>("/api/loras");
  return res.data.data;
}

// POST /api/projects/{id}/models/from-lora?loraFileName=... — LoRA 카탈로그 기반 자동 등록 (멱등)
export async function createCharacterFromLora(
  projectId: number,
  loraFileName: string
): Promise<CharacterModelDetail> {
  const res = await api.post<ApiResponseEnvelope<CharacterModelDetail>>(
    `/api/projects/${projectId}/models/from-lora`,
    null,
    { params: { loraFileName } }
  );
  return res.data.data;
}