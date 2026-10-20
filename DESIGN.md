# Rehearsal 디자인 시스템

## 0. Research Log
- 후보: Linear, ElevenLabs, Notion. Minimalist + Linear의 밝은 표면 계층과 집중형 구조를 선택. 한국어는 시스템 산세리프로 변경한다.
- UI UX Pro Max: interview training accessible calm 검색. 네이티브 버튼·선택 상태·라벨을 적용한다.
- Lazyweb: voice interview recording dashboard 검색. Metaview 인터뷰 재생/전사 분리 구조를 텍스트 설명으로 확인. 스크린샷은 아직 직접 열람하지 않았으므로 시각 검증 근거로 취급하지 않는다.
- beui tabs 소스: 공유 레이아웃 선택 표시, spring stiffness 245/damping 36/mass 1.2를 참고.
- 실제 도구: tweakcn modern-minimal, React Bits CountUp, Magic UI circular progress, Animate UI Button, Motion Primitives transition-panel을 원본 소스에서 검토한다.
- 이미지 콘셉트 생성은 실행하지 않았다. 이번 구현은 준비된 컴포넌트 원본과 아래 토큰을 바탕으로 한 코드 기반 디자인이다.

## 1. Atmosphere & Identity
실전 전의 조용한 리허설 스튜디오. 브랜드 이름은 Rehearsal, 사용자 화면에서는 리허설로 표기. 밝은 작업 공간 안에 짙은 남색 음성 스튜디오를 배치한다. 질문·답변·피드백을 가장 먼저 읽을 수 있게 하고, 시각적 특징은 상태에 따라 반응하는 음성 파형 한 곳에 집중한다.

## 2. Color
CSS 토큰: background #f7f8fa, surface #ffffff, foreground #202735, muted #596477, border #dce2ea, primary #2457df, primary-hover #1c43ad, primary-soft #eaf0ff, studio #17233b, studio-text #f4f7ff, studio-muted #b8c6df, success #16704b, success-soft #e9f5ef, warning #815a12, warning-soft #fff4d9, danger #b63b42, danger-soft #ffedef. 모든 실제 UI 색상은 이 의미 토큰을 사용한다. tweakcn modern-minimal의 중립·푸른 구조를 적용하고 대비를 높였다.

## 3. Typography
한국어: Pretendard가 있으면 사용, 없으면 Apple SD Gothic Neo/Noto Sans KR/system-ui. 외부 폰트 요청 없이 읽을 수 있어야 한다. Display 44/1.25, h1 32/1.35, h2 24/1.4, h3 20/1.45, body 16/1.7, small 14/1.6, caption 12/1.5. 제목은 600, 본문 400, 버튼 600. 한국어 keep-all, 긴 자료 문자열 overflow-wrap:anywhere. 모바일 제목 32px.

## 4. Spacing & Layout
4px 기반: 4,8,12,16,20,24,32,40,48,64. 사이드바 232px, 본문 최대 1160px, gutter clamp(20px,4vw,48px). 960px 이하 사이드바는 상단 내비게이션으로 변경. 720px 이하 두 열은 한 열로. 콘텐츠는 문서 스크롤, 라이브 전사 영역은 최대 높이 내에서 독립 스크롤. 컨트롤 최소 높이 44px.

## 5. Components
- Button: primary/secondary/ghost/danger. 기본·hover·pressed·focus·disabled·loading. 네이티브 button, spinner와 설명 포함. Animate UI의 reduced-motion/press 메커니즘 적용.
- Panel: white/studio/soft. radius 16, padding 24/32, border 토큰. 상태를 텍스트로 항상 설명.
- ModeChoice: 면접·발표 진입 카드. 실제 버튼으로 연결, 모드마다 고유 설명과 예시 질문.
- Field: label/input/select/textarea/error. 업로드 대기·추출 중·완료·오류. 자료 원문을 편집 가능.
- Status: 연결·질문 중·답변 중·일시정지·오류. 색과 글자로 구분, aria-live polite.
- ProgressRing: 연습 완료량만 표시. 객관적 실력 점수로 표현하지 않는다. Magic UI SVG 구조를 단순화하고 reduced-motion 적용.
- CountUp: 기록의 실제 연습 횟수·시간만 표시. React Bits spring 기반 숫자 메커니즘.
- ViewTransition: 사용자가 바꾼 화면/결과 탭에 opacity 및 8px 이동, Motion Primitives의 keyed presence 패턴.

## 6. Motion & Interaction
Micro 120ms, standard 220ms, emphasis 450ms. spring 245/36/1.2. 버튼 press scale .98, 선택 표시 공유 layout. 파형은 음성 활성 상태에서만 변하고 정지 상태는 고정. prefers-reduced-motion이면 transform 반복을 제거하고 상태 텍스트를 유지. 동시에 여러 애니메이션 엔진으로 같은 요소를 제어하지 않는다.

## 7. Depth & Surface
밝은 캔버스와 백색 패널은 1px 경계, 부유 요소만 0 8px 32px rgba(23,35,59,.08). 기본 radius 8, panel 16, studio 24. 실시간 작업 영역은 studio 색으로 구분하고 상태 바·질문 영역·하단 컨트롤의 명확한 계층을 유지한다.

## 8. Accessibility Constraints & Accepted Debt
본문 대비 4.5:1 목표, 키보드 접근, focus-visible 3px primary, 모든 아이콘 버튼 이름, 상태 알림과 음성 자막. 강제 자동 음성 재생 대신 사용자가 음성을 시작한다. 로컬 기록 보관 여부는 명확히 설명하고 삭제 제공. 화면 검증과 성능 수치는 실제 측정 후 별도 QA 문서에 기록한다. 현재 승인받은 접근성 결함은 없다.
