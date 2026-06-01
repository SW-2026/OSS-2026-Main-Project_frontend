import { useState, useCallback, useRef, useEffect } from "react";
import api from "@/lib/api";
import { listPanels, generateSinglePanel } from "@/lib/panelApi";

export interface GeneratedPanel {
  panelId: number;
  panelOrder: number;
  imageUrl: string;
  prompt: string;
  status: string;
}

interface GenerationState {
  status: "idle" | "pending" | "processing" | "completed" | "error";
  progress: number;
  panels: GeneratedPanel[];
  error: string;
}

export function usePanelGeneration() {
  const [state, setState] = useState<GenerationState>({
    status: "idle",
    progress: 0,
    panels: [],
    error: "",
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const start = useCallback(
    async (episodeId: number, body: { scenarioText: string; characters: unknown[]; backgrounds?: unknown[] }) => {
      stopPolling();
      setState({ status: "pending", progress: 0, panels: [], error: "" });

      try {
        const res = await api.post(`/api/episodes/${episodeId}/panels/generate`, body);

        const data = res.data?.data ?? res.data;

        // 즉시 완료된 경우
        if (data?.status === "COMPLETED" && data.panels) {
          setState({
            status: "completed",
            progress: 100,
            panels: data.panels,
            error: "",
          });
          return;
        }

        // polling 시작
        const taskId = data?.taskId ?? data?.id;
        if (!taskId) {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: "생성 태스크 ID를 받지 못했습니다.",
          }));
          return;
        }

        setState((prev) => ({ ...prev, status: "processing", progress: 5 }));

        pollRef.current = setInterval(async () => {
          try {
            const pollRes = await api.get(`/api/ai/tasks/${taskId}`);
            const pollData = pollRes.data?.data ?? pollRes.data;

            if (pollData?.status === "COMPLETED") {
              stopPolling();
              try {
                const detailList = await listPanels(episodeId);
                const panels: GeneratedPanel[] = detailList.map((p) => ({
                  panelId: p.panelId,
                  panelOrder: p.panelOrder,
                  imageUrl: p.finalImageUrl ?? "",
                  prompt: p.prompt ?? "",
                  status: p.status,
                }));
                setState({ status: "completed", progress: 100, panels, error: "" });
              } catch (listErr) {
                // eslint-disable-next-line no-console
                console.error("[usePanelGeneration] COMPLETED 후 listPanels 실패:", listErr);
                setState({ status: "completed", progress: 100, panels: [], error: "" });
              }
              return;
            }

            if (pollData?.status === "FAILED") {
              stopPolling();
              setState((prev) => ({
                ...prev,
                status: "error",
                error: pollData?.errorMessage ?? pollData?.error ?? "패널 생성에 실패했습니다.",
              }));
              return;
            }

            // 진행 중 — progress 업데이트
            const pct = pollData?.progressPercent ?? pollData?.progress ?? 0;
            setState((prev) => ({
              ...prev,
              progress: Math.max(prev.progress, Math.min(pct, 99)),
            }));
          } catch (pollErr) {
            // polling 중 에러는 무시하고 계속 시도
            // eslint-disable-next-line no-console
            console.error("[usePanelGeneration] polling error:", pollErr);
          }
        }, 2000);
      } catch (err: any) {
        stopPolling();
        setState((prev) => ({
          ...prev,
          status: "error",
          error: err?.message ?? "요청에 실패했습니다.",
        }));
      }
    },
    [stopPolling]
  );

  // 1컷 생성 — start(다컷)와 독립. COMPLETED 시 targetId(=새 panelId)로 onComplete 콜백 호출
  const startSingle = useCallback(
    async (
      episodeId: number,
      body: { scenarioText: string; characterIds: number[]; backgroundAssetId: number | null },
      onComplete: (newPanelId: number) => void | Promise<void>
    ) => {
      stopPolling();
      setState({ status: "pending", progress: 0, panels: [], error: "" });

      try {
        const { taskId } = await generateSinglePanel(episodeId, body);

        if (!taskId) {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: "생성 태스크 ID를 받지 못했습니다.",
          }));
          return;
        }

        setState((prev) => ({ ...prev, status: "processing", progress: 5 }));

        pollRef.current = setInterval(async () => {
          try {
            const pollRes = await api.get(`/api/ai/tasks/${taskId}`);
            const pollData = pollRes.data?.data ?? pollRes.data;

            if (pollData?.status === "COMPLETED") {
              stopPolling();
              setState({ status: "completed", progress: 100, panels: [], error: "" });
              const newPanelId = pollData?.targetId;
              if (newPanelId) await onComplete(Number(newPanelId));
              return;
            }

            if (pollData?.status === "FAILED") {
              stopPolling();
              setState((prev) => ({
                ...prev,
                status: "error",
                error: pollData?.errorMessage ?? "1컷 생성에 실패했습니다.",
              }));
              return;
            }

            const pct = pollData?.progressPercent ?? 0;
            setState((prev) => ({
              ...prev,
              progress: Math.max(prev.progress, Math.min(pct, 99)),
            }));
          } catch (pollErr) {
            // eslint-disable-next-line no-console
            console.error("[usePanelGeneration] startSingle polling error:", pollErr);
          }
        }, 2000);
      } catch (err: any) {
        stopPolling();
        setState((prev) => ({
          ...prev,
          status: "error",
          error: err?.message ?? "요청에 실패했습니다.",
        }));
      }
    },
    [stopPolling]
  );

  // mount 시 또는 episode 전환 시 외부에서 panels seed 가능 (새로고침 후 복원용)
  const seed = useCallback(async (episodeId: number) => {
    try {
      const detailList = await listPanels(episodeId);
      const panels: GeneratedPanel[] = detailList.map((p) => ({
        panelId: p.panelId,
        panelOrder: p.panelOrder,
        imageUrl: p.finalImageUrl ?? "",
        prompt: p.prompt ?? "",
        status: p.status,
      }));
      setState((prev) => ({ ...prev, panels }));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[usePanelGeneration] seed 실패:", err);
    }
  }, []);

  return {
    status: state.status,
    progress: state.progress,
    panels: state.panels,
    error: state.error,
    start,
    startSingle,
    seed,
  };
}