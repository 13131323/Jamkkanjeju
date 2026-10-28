# web

Next.js 웹 프론트엔드

[초기세팅 명세서](https://rural-cloche-ff3.notion.site/TamnaLog-web-initial-setting-37d1651a8416805baf6cf3cbd1b48b63?source=copy_link)

## 사전 요구사항

- Node.js 20+
- pnpm 10+

## 설치

```bash
# client/ 루트에서 실행
pnpm install
```

## 실행

```bash
# client/ 루트에서
pnpm dev:web

# 또는 web/ 디렉토리에서
pnpm dev
```

개발 서버: http://localhost:3000

## 명령어

| 명령어                 | 설명                       |
| ---------------------- | -------------------------- |
| `pnpm dev`             | 개발 서버 실행             |
| `pnpm build`           | 프로덕션 빌드              |
| `pnpm start`           | 프로덕션 서버 실행         |
| `pnpm lint`            | ESLint 검사                |
| `pnpm typecheck`       | TypeScript 타입 검사       |
| `pnpm storybook`       | Storybook 실행 (포트 6006) |
| `pnpm build-storybook` | Storybook 정적 빌드        |
