import { useState, useRef, useCallback, useEffect } from "react";
import axios from "axios";
import {
  generatePanels,
  getTask,
  getEpisodePanels,
  type PanelsGenerateRequest,
  type PanelDetailResponse,
  type TaskStatus,
} from "@/lib/aiApi";

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_DURATION_MS = 5 * 60 * 1000;

export type GenerationStatus =
  | "idle"
  | "pending"
  | "processing"
  | "completed"
  | "failed";

interface UsePanelGenerationResult {
  status: GenerationStatus;
  progress: number;
  panels: PanelDetailResponse[];
  error: string | null;
  taskId: number | null;
  start: (episodeId: number, body: PanelsGenerateRequest) => Promise<void>;
  reset: () => void;
}

export function usePanelGeneration(): UsePanelGenerationResult {
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [panels, setPanels] = useState<PanelDetailResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<number | null>(null);

  const stopRef = useRef(false);

  useEffect(() => {
    return () => {
      stopRef.current = true;
    };
  }, []);

  const reset = useCallback(() => {
    stopRef.current = true;
    setStatus("idle");
    setProgress(0);
    setPanels([]);
    setError(null);
    setTaskId(null);
  }, []);

  const start = useCallback(
    async (episodeId: number, body: PanelsGenerateRequest) => {
      if (status === "pending" || status === "processing") return;
      stopRef.current = false;
      setStatus("pending");
      setProgress(0);
      setPanels([]);
      setError(null);
      setTaskId(null);

      try {
        const task = await generatePanels(episodeId, body);
        setTaskId(task.taskId);
        setStatus(mapStatus(task.status));
        setProgress(task.progressPercent ?? 0);

        const startedAt = Date.now();
        while (!stopRef.current) {
          if (Date.now() - startedAt > POLL_MAX_DURATION_MS) {
            setStatus("failed");
            setError(`폴링 시간 초과 (${POLL_MAX_DURATION_MS / 60000}분)`);
            return;
          }
          await sleep(POLL_INTERVAL_MS);
          if (stopRef.current) return;

          const t = await getTask(task.taskId);
          setStatus(mapStatus(t.status));
          setProgress(t.progressPercent ?? 0);

          if (t.status === "COMPLETED") {
            try {
              const list = await getEpisodePanels(episodeId);
              if (stopRef.current) return;
              setPanels(list);
            } catch {
              setError("패널 목록 조회 실패");
            }
            return;
          }
          if (t.status === "FAILED") {
            setError(t.errorMessage ?? "생성 실패");
            return;
          }
        }
      } catch (err) {
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.message ?? err.message);
        } else {
          setError(err instanceof Error ? err.message : "알 수 없는 오류");
        }
        setStatus("failed");
      }
    },
    [status]
  );

  return { status, progress, panels, error, taskId, start, reset };
}

function mapStatus(s: TaskStatus): GenerationStatus {
  switch (s) {
    case "PENDING":
      return "pending";
    case "PROCESSING":
      return "processing";
    case "COMPLETED":
      return "completed";
    case "FAILED":
      return "failed";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
