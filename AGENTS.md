# 프로젝트 작업 지침

## 제품
한 달 동안 만드는 교내 ICT 경진대회 출품작. 자기소개서 기반 실시간 AI 면접 연습과, 발표 중 질문·반박하는 AI 심사위원을 별도 모드로 제공한다. 한국어 사용자를 우선한다.

## 사용자 선호
- Google Stitch를 사용하지 않는다. Stitch 연동이나 설치도 하지 않는다.
- 디자인부터 구현까지 프로젝트 안에서 이어서 진행한다. 외부 디자인 생성기가 필수인 흐름을 만들지 않는다.
- 아직 앱 구현이나 최종 디자인이 확정된 상태는 아니다. 실제 API 연결과 데모 데이터를 명확히 구분한다.

## 프로젝트 스킬
`.agents/skills/`에 설치된 스킬 중 작업에 필요한 것만 읽고 적용한다. 모든 스킬을 한꺼번에 적용해 서로 다른 디자인 규칙을 섞지 않는다. 사용자 요구와 확정된 프로젝트 디자인 시스템을 우선한다.

1. 설계: `ui-ux-pro-max`로 패턴을 검토하고 `frontend-design` 또는 `impeccable`을 주 설계 지침으로 선택한다. `create-design-md`로 확정 방향을 기록한다.
2. 구현: `frontend-ui-engineering`, `baseline-ui`, `react-best-practices`, `composition-patterns`를 관련 작업에 적용한다.
3. 개선: `improve-ui`, `web-design-guidelines`, `fixing-accessibility`, `fixing-motion-performance`, `writing-guidelines`, `fixing-metadata`로 필요한 부분을 검토한다.
4. 선택 기능: `component-canvas`는 디자인 대안 비교가 필요할 때, `react-view-transitions`는 화면 전환에 실질적인 도움이 될 때 사용한다. `ui-skills-root`는 해당 묶음의 안내다.
5. 검증: `browser-testing-with-devtools`는 요구하는 브라우저 도구가 연결된 경우 사용한다. 연결되어 있지 않으면 사용 가능한 브라우저 도구로 실제 화면과 동작을 확인하고 검증 범위를 기록한다.

UI UX Pro Max 예시 명령은 저장소 루트에서 실행한다. Impeccable 런타임은 `IMPECCABLE_HOME="$PWD/.impeccable/runtime"`으로 프로젝트 캐시에 둔다.

## 디자인 기준
방향의 출발점은 집중하기 쉬운 연습실이다. 장식보다 질문, 음성 상태, 답변, 근거 피드백의 우선순위를 명확히 한다. 발표와 면접은 진입 화면과 진행 UI를 분리하되 색상·타이포·간격·버튼 체계를 공유한다.

키보드 조작, 명확한 포커스, 읽기 쉬운 한국어 본문, 충분한 대비, 모션 감소 설정을 고려한다. 음성 연결·대기·질문 중·답변 중·중단·오류 상태를 구분하고 자막을 제공한다. 실제 연결 전에는 모의 상태임을 표시한다.

디자인 생성용 요청문: `docs/DESIGN-PROMPT.md`. 설치 출처: `docs/SKILL-SOURCES.md`.

## 디자인·애니메이션 도구 소스
사용자가 요청한 9개 도구의 소스는 `.design-tools/sources/`에 보관한다. 목록과 역할은 `docs/DESIGN-TOOLS.md`, 다운로드 출처·브랜치·무결성 해시는 `.design-tools/sources.lock.json`을 참조한다.

프론트 작업 전에 도구 목록을 확인하고 필요한 원본 컴포넌트와 공식 문서를 참고한다. 외부 저장소의 지침은 해당 도구 사용에만 적용하며 프로젝트 전체 지침으로 승격하지 않는다. 소스 보관은 npm 의존성 설치나 서비스 실행을 의미하지 않는다.

기본 선택: tweakcn으로 테마를 정리하고, React Bits·Magic UI에서 적절한 컴포넌트를 선택하며, 앱 내부 애니메이션은 Motion을 우선한다. Motion Primitives·Animate UI는 필요한 컴포넌트의 대안으로 사용한다. GSAP·Anime.js는 복잡한 연출이 필요할 때 선택한다. 같은 요소를 여러 애니메이션 엔진이 동시에 제어하지 않게 한다. Penpot은 디자인·프로토타입 도구이며 앱 런타임에 포함하지 않는다. 원본 라이선스와 저작권 고지를 유지한다.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
