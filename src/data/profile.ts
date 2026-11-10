// 공개용 자기소개와 연락처만 이 파일에 넣습니다.
export const profile = {
  name: '민준호',
  school: '안산대학교',
  major: '인공지능소프트웨어',
  intro: '백엔드와 앱을 만들고, 대학 공지 RAG를 연구합니다.',
  // 공개용 사진을 public/images/에 넣고 경로와 설명을 추가하세요.
  photo: { src: '/images/min-junho.jpg', alt: '안경과 짙은색 티셔츠를 착용한 민준호의 프로필 사진' } as { src: string; alt: string } | null,
  // 공개가 확인된 링크만 추가하세요. 예: { label: 'GitHub', url: 'https://github.com/...' }
  links: [{ label: 'GitHub', url: 'https://github.com/Juno31323' }] as { label: string; url: string }[],
};
