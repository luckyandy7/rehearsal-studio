import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import "./studio-theme.css";
export const metadata: Metadata = {
	title: "리허설 · AI 면접과 발표 연습",
	description:
		"내 자료로 준비하는 AI 면접과 발표. 질문부터 꼬리 질문, 발언 근거가 담긴 피드백까지 한 곳에서 연습하세요.",
	robots: { index: false, follow: false },
};
export default function RootLayout({
	children,
}: {
	readonly children: React.ReactNode;
}) {
	return (
		<html lang="ko">
			<body>
				{children}
				{process.env.NODE_ENV === "development" &&
					process.env.NEXT_PUBLIC_ENABLE_REACT_DEVTOOLS === "1" && (
						<>
							<Script
								src="https://unpkg.com/react-grab@0.2.0/dist/index.global.js"
								strategy="lazyOnload"
							/>
							<Script
								src="https://unpkg.com/react-scan@0.5.7/dist/auto.global.js"
								strategy="lazyOnload"
							/>
						</>
					)}
			</body>
		</html>
	);
}
