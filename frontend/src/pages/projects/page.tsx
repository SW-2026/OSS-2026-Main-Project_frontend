import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { listProjects, createProject } from "@/lib/projectApi";

interface Project {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  episodeCount: number;
  cutCount: number;
  lastEdited: string;
  status: "draft" | "published" | "completed";
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setIsLoading(true);
        setError("");

        const summaries = await listProjects();
        // backend ProjectSummary → frontend Project 매핑.
        // description/thumbnail_url/cutCount/status는 backend에 없음 → default
        // updatedAt 없음 → createdAt 사용 (1-C 후속에서 backend 보강 시 정확해짐)
        const list: Project[] = summaries.map((s) => ({
          id: String(s.projectId),
          title: s.title,
          description: null,
          thumbnail_url: null,
          episodeCount: s.episodeCount,
          cutCount: 0,
          lastEdited: s.createdAt,
          status: "draft",
        }));

        setProjects(list);
      } catch (err: any) {
        setError(err.message ?? "프로젝트를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchProjects();
    } else {
      setIsLoading(false);
      setError("로그인이 필요합니다.");
    }
  }, [user]);

  const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
    draft: { label: "작성 중", color: "text-amber-400", bg: "bg-amber-400/10" },
    published: { label: "연재 중", color: "text-emerald-400", bg: "bg-emerald-400/10" },
    completed: { label: "완결", color: "text-sky-400", bg: "bg-sky-400/10" },
  };

  const handleCreateProject = async () => {
    if (!user) {
      setError("로그인이 필요합니다.");
      return;
    }
    try {
      setError("");
      const created = await createProject({ title: "새 프로젝트" });
      const newProject: Project = {
        id: String(created.projectId),
        title: created.title,
        description: null,
        thumbnail_url: null,
        episodeCount: 0,
        cutCount: 0,
        lastEdited: created.createdAt,
        status: "draft",
      };

      setProjects((prev) => [newProject, ...prev]);
    } catch (err: any) {
      setError(err.message ?? "프로젝트 생성 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-[#ccc]" style={{ fontFamily: "'Inter', 'Noto Sans KR', sans-serif" }}>
      {/* 헤더 */}
      <header className="h-14 bg-[#111111] border-b border-[#2a2a2a] flex items-center px-4 shrink-0">
        <button
          onClick={() => navigate("/editor")}
          className="flex items-center gap-2 text-[#888] hover:text-white transition-colors cursor-pointer"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-arrow-left-line text-sm" />
          </div>
          <span className="text-xs font-medium whitespace-nowrap">에디터로 돌아가기</span>
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center">
            <i className="ri-quill-pen-line text-white text-sm" />
          </div>
          <span className="text-white font-bold text-sm tracking-wide whitespace-nowrap">
            WEBTOON<span className="text-orange-500">.AI</span>
          </span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* 상단 타이틀 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-white text-xl font-bold">내 프로젝트</h1>
            <p className="text-[#666] text-xs mt-1">{projects.length}개의 프로젝트</p>
          </div>
          <button
            onClick={handleCreateProject}
            className="flex items-center gap-1.5 px-4 h-8 rounded-xl bg-orange-500 text-xs text-white hover:bg-orange-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <div className="w-3.5 h-3.5 flex items-center justify-center">
              <i className="ri-add-line text-xs" />
            </div>
            새 프로젝트
          </button>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-6">
            <i className="ri-error-warning-line text-red-400 text-sm" />
            <span className="text-red-400 text-xs">{error}</span>
          </div>
        )}

        {/* 로딩 상태 */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
            <span className="text-[#666] text-sm">프로젝트 불러오는 중...</span>
          </div>
        )}

        {/* 프로젝트 그리드 */}
        {!isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => {
              const status = statusLabels[project.status] ?? { label: project.status, color: "text-[#888]", bg: "bg-[#222]" };
              return (
                <div
                  key={project.id}
                  onClick={() => navigate(`/?projectId=${project.id}`)}
                  className="group bg-[#111] border border-[#222] rounded-2xl overflow-hidden hover:border-[#333] transition-all cursor-pointer"
                >
                  {/* 썸네일 */}
                  <div className="relative w-full h-40 overflow-hidden">
                    {project.thumbnail_url ? (
                      <img
                        src={project.thumbnail_url}
                        alt={project.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center">
                        <div className="w-8 h-8 flex items-center justify-center">
                          <i className="ri-image-line text-[#444] text-xl" />
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute top-3 left-3">
                      <span className={`inline-block px-2 py-1 rounded-lg text-[10px] font-medium ${status.bg} ${status.color} whitespace-nowrap`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3">
                      <h3 className="text-white text-sm font-semibold truncate">{project.title}</h3>
                    </div>
                  </div>

                  {/* 정보 */}
                  <div className="p-4">
                    <p className="text-[#888] text-xs line-clamp-2 mb-3 leading-relaxed">{project.description || "설명 없음"}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <div className="w-3.5 h-3.5 flex items-center justify-center">
                            <i className="ri-film-line text-[#555] text-xs" />
                          </div>
                          <span className="text-[#666] text-xs whitespace-nowrap">{project.episodeCount ?? 0}화</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3.5 h-3.5 flex items-center justify-center">
                            <i className="ri-image-line text-[#555] text-xs" />
                          </div>
                          <span className="text-[#666] text-xs whitespace-nowrap">{project.cutCount ?? 0}컷</span>
                        </div>
                      </div>
                      <span className="text-[#444] text-[10px] whitespace-nowrap">{project.lastEdited ? new Date(project.lastEdited).toLocaleDateString("ko-KR") : "-"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 빈 상태 */}
        {!isLoading && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 bg-[#1a1a1a] rounded-2xl flex items-center justify-center mb-4">
              <div className="w-8 h-8 flex items-center justify-center">
                <i className="ri-folder-line text-[#444] text-xl" />
              </div>
            </div>
            <p className="text-[#888] text-sm">아직 프로젝트가 없습니다</p>
            <p className="text-[#555] text-xs mt-1">새 프로젝트를 만들어 웹툰 제작을 시작해보세요</p>
            <button
              onClick={handleCreateProject}
              className="mt-4 flex items-center gap-1.5 px-4 h-8 rounded-xl bg-orange-500 text-xs text-white hover:bg-orange-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              <div className="w-3.5 h-3.5 flex items-center justify-center">
                <i className="ri-add-line text-xs" />
              </div>
              새 프로젝트 만들기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}