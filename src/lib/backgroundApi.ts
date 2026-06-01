import api from "@/lib/api";

// backend ApiResponse<T> wrapper — auth 외 모든 API가 이 형식으로 응답
interface ApiResponseEnvelope<T> {
  data: T;
  message?: string;
}

// === Domain types — backend DTO와 1:1 ===

// GET /api/background-assets — 목록 응답
export interface BackgroundAssetSummary {
  assetId: number;
  assetName: string;
  assetUrl: string;
  createdAt: string;
}

export interface BackgroundUploadBody {
  assetName: string;
}

// === API calls — ApiResponse는 호출지점에서 풀음 (characterApi 패턴) ===

export async function listBackgrounds(): Promise<BackgroundAssetSummary[]> {
  const res = await api.get<ApiResponseEnvelope<BackgroundAssetSummary[]>>(
    "/api/background-assets"
  );
  return res.data.data;
}

// POST /api/background-assets/upload — multipart, assetId(Long) 반환
export async function uploadBackground(
  body: BackgroundUploadBody,
  image: File
): Promise<number> {
  const fd = new FormData();
  fd.append(
    "metadata",
    new Blob([JSON.stringify(body)], { type: "application/json" })
  );
  fd.append("image", image);
  const res = await api.post<ApiResponseEnvelope<number>>(
    "/api/background-assets/upload",
    fd
  );
  return res.data.data;
}

// DELETE /api/background-assets/{assetId}
export async function deleteBackground(assetId: number): Promise<void> {
  await api.delete(`/api/background-assets/${assetId}`);
}