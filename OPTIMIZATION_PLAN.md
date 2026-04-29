# ActionRing 코드 최적화 계획서

> 전체 프로젝트 코드 리뷰 결과 기반 (2026-04-08 분석)

---

## 완료된 작업 (보안 + 메모리 누수)

| # | 항목 | 파일 | 상태 |
|---|------|------|------|
| 1-1 | XSS — `dangerouslySetInnerHTML` sanitize 적용 | `SlotsTab.tsx`, `RadiusTab.tsx`, `App.tsx` | **완료** |
| 1-2 | Regex Injection — `new RegExp()` try-catch | `ActionExecutor.ts` | **완료** |
| 1-3 | Shell command timeout 추가 | `ActionExecutor.ts` (30+ exec 호출) | **완료** |
| 2-1 | HookManager 리스너 해제 | `HookManager.ts` stop() | **완료** |
| 2-2 | SVG 캐시 크기 제한 (max 200) | `HookManager.ts` svgIconCache | **완료** |
| 2-3 | PopupMenu hover timer cleanup | `PopupMenu.tsx` | **완료** |
| 2-4 | PopupMenuManager 윈도우 정리 | — | 이미 안전 (수정 불필요) |
| 2-5 | WindowManager 참조 정리 | — | 이미 안전 (수정 불필요) |

---

## 남은 작업

### Phase C: 성능 최적화 (Medium)

| # | 항목 | 파일 | 상태 |
|---|------|------|------|
| C-1 | RingCanvas useMemo 적용 (`subRadius`, `hasFolders`, `maxRadius`, `size`) | `RingCanvas.tsx` | **완료** |
| C-2 | UnifiedTab useCallback 확인 | `UnifiedTab.tsx` | **완료** (이미 적용됨) |
| C-3 | ShortcutsTab countRefs useMemo 메모이제이션 | `ShortcutsTab.tsx` | **완료** |
| C-4 | 중복 아이콘 해석 로직 공통 유틸로 추출 | `utils/iconUtils.tsx` | **완료** |
| C-5 | Sub-ring 각도 계산 공통 유틸로 추출 | `shared/ringGeometry.ts` | **완료** |

---

### Phase D: 코드 품질 (Medium-Low)

| # | 항목 | 파일 | 상태 |
|---|------|------|------|
| D-1 | popupMenu.ts `removeAllListeners` 추가 + theme 타입 강화 | `src/preload/popupMenu.ts` | **완료** |
| D-2 | MCP 서버 Zod 스키마 강화 (save_config, actions, slots) | `mcp-server/index.ts` | **완료** |
| D-3 | `McpServerStatus` 인터페이스, `IPC_APPEARANCE_CLOSE` 상수 추가 | `shared/ipc.types.ts` 외 | **완료** |
| D-4 | useRingAnimation 미사용 `fade` 제거 | `useRingAnimation.ts` | **완료** |
| D-4 | `DEFAULT_BUTTON_RADIUS`, `generateId()` | — | 실제 사용 중 (삭제 불필요) |
| D-5 | 대형 파일 분리 (ShortcutsApp.tsx, App.tsx) | — | **보류** (별도 세션 권장) |

---

### Phase E: 문서 업데이트

#### E-1. 누락된 README 생성
| 폴더 | 설명 | 상태 |
|---|---|---|
| `src/main/ipc/README.md` | IPC 핸들러 모듈 8개 파일 설명 | **완료** |
| `src/renderer/README.md` | 6개 렌더러 프로세스 아키텍처 개요 | **완료** |
| `resources/action/README.md` | 액션 타입 아이콘 SVG 에셋 목록 | **완료** |
| `resources/logo/README.md` | AI 클라이언트 및 앱 로고 에셋 목록 | **완료** |

#### E-2. 기존 README 업데이트
| 파일 | 수정 내용 | 상태 |
|---|---|---|
| `shared/README.md` | 누락된 7개 파일 추가: `colorUtils.ts`, `svgUtils.ts`, `SVGIcon.tsx`, `UIIcon.tsx`, `uiIcons.ts`, `mainI18n.ts`, `ringGeometry.ts` | **완료** |
| `resources/icons/README.md` | `resources/action/` 폴더 언급 추가 | **완료** |

---

## 권장 실행 순서

```
Phase C (성능 최적화)    → ✅ 완료
Phase D (코드 품질)      → ✅ 완료 (D-5 대형 파일 분리는 보류)
Phase E (문서 업데이트)  → ✅ 완료
```

## 검증 방법
- `npx tsc --noEmit` — TypeScript 컴파일 에러 없음 확인
- `npm run dev` — 앱 실행 후 기능 정상 동작 확인
- 링 오버레이 반복 표시/숨김 → 렌더링 성능 체감 확인
- MCP 서버 도구 호출 테스트 (잘못된 입력으로 에러 메시지 확인)
