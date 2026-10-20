# 프로젝트 디자인 도구

사용자 요청으로 다음 9개 저장소의 소스를 프로젝트 안에 준비한다. 실제 다운로드 성공 여부와 원본 ZIP의 SHA-256은 `.design-tools/sources.lock.json`에 기록한다. 다운로드한 브랜치의 스냅샷이며 커밋 SHA 고정 설치는 아니다.

| 로컬 폴더 (.design-tools/sources 아래) | 원본 | 프로젝트에서 사용할 역할 |
| --- | --- | --- |
| react-bits | https://github.com/DavidHDev/react-bits | 배경, 텍스트, 카드, 인터랙션 예제 |
| magicui | https://github.com/magicuidesign/magicui | 소개 화면과 애니메이션 UI 컴포넌트 |
| tweakcn | https://github.com/jnsahaj/tweakcn | 테마 프리셋과 디자인 토큰 참고 |
| motion | https://github.com/motiondivision/motion | 질문 전환, 패널 이동 등 기본 애니메이션 |
| motion-primitives | https://github.com/ibelick/motion-primitives | 완성된 작은 애니메이션 컴포넌트 |
| animate-ui | https://github.com/imskyleen/animate-ui | shadcn 기반 UI의 애니메이션 대안 |
| gsap | https://github.com/greensock/GSAP | 타임라인과 복잡한 스크롤 연출 |
| anime | https://github.com/juliangarnier/anime | SVG·도형 등 개별 그래픽 연출 |
| penpot | https://github.com/penpot/penpot | 디자인 편집·프로토타입 도구 참고 |

## 사용 순서

1. 앱을 구성할 때 기존 의존성과 디자인 토큰부터 확인한다.
2. 필요한 효과를 로컬 원본에서 찾고, 해당 저장소 README·라이선스·컴포넌트 의존성을 확인한다.
3. 프로젝트의 React·Tailwind 버전에 맞춰 선택한 코드만 가져온다. 소스 전체를 앱 번들에 넣지 않는다.
4. 한국어, 키보드 접근성, 모션 감소, 오류·대기 상태에 맞춰 조정한다.
5. 실제 브라우저에서 확인한다. 음성 상태 표시를 시각 효과만으로 대체하지 않는다.

원본 폴더는 대용량 참고 자료이므로 Git 추적에서 제외하고 출처 목록은 유지한다. 원본 README와 라이선스는 각 폴더에 그대로 보존한다. 무료 공개 코드와 별도 유료 상품·서비스는 구분한다. Google Stitch는 사용하지 않는다.

현재 단계는 소스 확보와 작업 지침 연결이다. 앱 패키지 설치, Penpot 서버 실행, 외부 서비스 가입이나 유료 기능 구매는 포함하지 않는다.
