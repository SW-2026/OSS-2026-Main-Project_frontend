import api from "@/lib/api";
import type { AxiosProgressEvent } from "axios";

// backend ApiResponse<T> wrapper — auth 외 모든 API가 이 형식으로 응답
interface ApiResponseEnvelope<T> {
  data: T;
  message?: string;
}

export type LoraRequestStatus =
  | "PENDING"
  | "TRAINING"
  | "COMPLETED"
  | "FAILED"
  | "REJECTED";

// backend LoraRequestResponse와 1:1
export interface LoraRequestResponse {
  requestId: number;
  memberId: number;
  characterName: string;
  triggerWord: string;
  status: LoraRequestStatus;
  imageCount: number;
  imageDir: string | null;
  adminNotes: string | null;
  createdAt: string;
  completedAt: string | null;
  loraCatalogId: number | null;
  imageUrls: string[];
}

// [관리자] 상태/메모 변경 (Phase 1.5)
export interface LoraRequestUpdateBody {
  status: LoraRequestStatus;
  adminNotes?: string;
  loraCatalogId?: number | null;
}

export interface LoraRequestCreateBody {
  characterName: string;
  triggerWord: string;
}

// POST /api/lora-requests (multipart: metadata + images[]) — 201
export async function createLoraRequest(
  body: LoraRequestCreateBody,
  images: File[],
  onProgress?: (e: AxiosProgressEvent) => void
): Promise<LoraRequestResponse> {
  const fd = new FormData();
  fd.append(
    "metadata",
    new Blob([JSON.stringify(body)], { type: "application/json" })
  );
  for (const img of images) {
    fd.append("images", img);
  }
  const res = await api.post<ApiResponseEnvelope<LoraRequestResponse>>(
    "/api/lora-requests",
    fd,
    { onUploadProgress: onProgress }
  );
  return res.data.data;
}

// GET /api/lora-requests/me
export async function listMyLoraRequests(): Promise<LoraRequestResponse[]> {
  const res = await api.get<ApiResponseEnvelope<LoraRequestResponse[]>>(
    "/api/lora-requests/me"
  );
  return res.data.data;
}

// GET /api/lora-requests/{id}
export async function findLoraRequestById(
  requestId: number
): Promise<LoraRequestResponse> {
  const res = await api.get<ApiResponseEnvelope<LoraRequestResponse>>(
    `/api/lora-requests/${requestId}`
  );
  return res.data.data;
}

// GET /api/admin/lora-requests?status= (관리자)
export async function listAllLoraRequests(
  status?: LoraRequestStatus
): Promise<LoraRequestResponse[]> {
  const res = await api.get<ApiResponseEnvelope<LoraRequestResponse[]>>(
    "/api/admin/lora-requests",
    { params: status ? { status } : {} }
  );
  return res.data.data;
}

// GET /api/admin/check — 현재 사용자가 관리자인지
export async function checkAdmin(): Promise<boolean> {
  const res = await api.get<ApiResponseEnvelope<boolean>>("/api/admin/check");
  return res.data.data;
}

// PATCH /api/admin/lora-requests/{id} — 관리자 상태/메모 변경 (Phase 1.5)
export async function updateLoraRequest(
  requestId: number,
  body: LoraRequestUpdateBody
): Promise<LoraRequestResponse> {
  const res = await api.patch<ApiResponseEnvelope<LoraRequestResponse>>(
    `/api/admin/lora-requests/${requestId}`,
    body
  );
  return res.data.data;
}
