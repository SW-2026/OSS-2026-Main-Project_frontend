export interface Project {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  episodeCount: number;
  cutCount: number;
  lastEdited: string;
  status: "draft" | "published" | "completed";
}

export const mockProjects: Project[] = [
  {
    id: "proj-1",
    title: "학교 뒤편 고양이",
    description: "고등학생 지유가 학교 뒤편에서 고양이를 돌보며 벌어지는 따뜻한 일상 이야기",
    thumbnail: "https://readdy.ai/api/search-image?query=Korean%20webtoon%20style%20scene%20female%20student%20feeding%20stray%20cat%20behind%20school%20building%2C%20warm%20afternoon%20sunlight%2C%20cozy%20atmosphere%2C%20soft%20colors%2C%20manga%20panel%20illustration%2C%20gentle%20emotional%20scene&width=400&height=280&seq=proj1&orientation=landscape",
    episodeCount: 3,
    cutCount: 12,
    lastEdited: "2026-05-07",
    status: "draft",
  },
  {
    id: "proj-2",
    title: "별빛 아래 우리",
    description: "천문동아리 학생들의 우정과 성장을 그린 청춘 드라마",
    thumbnail: "https://readdy.ai/api/search-image?query=Korean%20webtoon%20style%20scene%20students%20stargazing%20on%20school%20rooftop%20at%20night%2C%20telescope%2C%20starry%20sky%2C%20romantic%20atmosphere%2C%20manga%20illustration%2C%20soft%20lighting%2C%20youth%20drama%20vibe&width=400&height=280&seq=proj2&orientation=landscape",
    episodeCount: 5,
    cutCount: 24,
    lastEdited: "2026-05-05",
    status: "draft",
  },
  {
    id: "proj-3",
    title: "카페 알바생의 비밀",
    description: "평범한 카페 알바생이 알게 된 동네의 숨겨진 이야기",
    thumbnail: "https://readdy.ai/api/search-image?query=Korean%20webtoon%20style%20scene%20cozy%20cafe%20interior%20with%20part%20time%20worker%20behind%20counter%2C%20warm%20lighting%2C%20coffee%20steam%2C%20customers%20sitting%2C%20manga%20illustration%20style%2C%20slice%20of%20life%20atmosphere&width=400&height=280&seq=proj3&orientation=landscape",
    episodeCount: 2,
    cutCount: 8,
    lastEdited: "2026-04-28",
    status: "completed",
  },
  {
    id: "proj-4",
    title: "시간여행자 수아",
    description: "과거로 돌아가 엄마의 첫사랑을 도와주는 판타지 로맨스",
    thumbnail: "https://readdy.ai/api/search-image?query=Korean%20webtoon%20style%20scene%20girl%20standing%20in%20time%20portal%20vortex%2C%20glowing%20clock%20gears%20floating%20around%2C%20dramatic%20lighting%2C%20fantasy%20atmosphere%2C%20manga%20illustration%2C%20emotional%20scene&width=400&height=280&seq=proj4&orientation=landscape",
    episodeCount: 4,
    cutCount: 18,
    lastEdited: "2026-05-01",
    status: "published",
  },
];