# 오픈소스 고지

실행 의존성은 package.json 및 pnpm-lock.yaml을 참조한다. React, Next.js, Motion, Radix UI, Phosphor Icons, OpenAI SDK, Zod, ky, mammoth, pdf-parse, fflate, Cheerio (MIT), ipaddr.js (MIT), Tailwind CSS를 사용한다.

src/components/ui.tsx는 다음 원본의 구현 방식을 참고해 프로젝트 토큰에 맞게 재작성했다. 원본 전체 컴포넌트를 그대로 포함하지 않는다.

- React Bits: CountUp의 Motion 숫자 보간. [원본](https://github.com/DavidHDev/react-bits), [라이선스](docs/licenses/react-bits.txt). MIT + Commons Clause 조건을 유지한다.
- Magic UI: SVG 원형 진행 표시. [원본](https://github.com/magicuidesign/magicui), [라이선스](docs/licenses/magicui.txt).
- Animate UI: 버튼 누름 피드백. [원본](https://github.com/animate-ui/animate-ui), [라이선스](docs/licenses/animate-ui.txt).
- Motion Primitives: 키 기반 화면 전환 프리미티브. [원본](https://github.com/ibelick/motion-primitives), [라이선스](docs/licenses/motion-primitives.txt).

실제 다운로드 리비전과 무결성은 .design-tools/sources.lock.json에 기록되어 있다. 9개 도구의 역할은 docs/DESIGN-TOOLS.md에 명시되어 있다. 사용하지 않는 애니메이션 엔진과 Penpot은 앱 런타임에 포함하지 않는다.
