# ActionRing — Scripting Feature Roadmap

macOS Shortcuts 앱 수준의 스크립팅 기능을 ActionRing에 단계적으로 구현하기 위한 로드맵.
각 Phase는 독립적인 대화 세션에서 진행하며, 완료 시 이 문서를 업데이트한다.

---

## Status Overview

| Phase | 내용 | 상태 |
|-------|------|------|
| Phase 1 | Magic Variables + Pipeline 인프라 | `TODO` |
| Phase 2 | Expression 시스템 + Type 체계 | `TODO` |
| Phase 3 | 데이터 변환 액션 | `TODO` |
| Phase 4 | I/O 액션 | `TODO` |
| Phase 5 | 사용자 입력 + 고급 제어 흐름 | `TODO` |

상태: `TODO` → `IN_PROGRESS` → `TESTING` → `DONE`

---

## Phase 1: Magic Variables + Pipeline 인프라

> 모든 액션이 출력값을 가지며, 이후 액션에서 암시적/명시적으로 참조 가능한 시스템

### 1-1. RunContext 확장
- **파일**: `src/main/ActionExecutor.ts` (RunContext, line ~29–35)
- `pipelineValue: any` 추가 — 직전 액션의 출력을 자동 전달
- `magicVars: Map<string, any>` 추가 — 각 액션의 출력을 nodeId로 저장
- 변수 저장 시 타입 유지 (현재 string only → `string | number | boolean | object | any[]`)

### 1-2. 액션별 출력값 정의
- **파일**: `shared/config.types.ts`
- 각 `ActionConfig`에 `_nodeId: string` 추가 (에디터에서 자동 생성)

| 액션 | 출력값 | pass-through? |
|------|--------|---------------|
| `launch` | 프로세스 경로/PID | No |
| `keyboard` | 키 조합 문자열 | No |
| `shell` | stdout | No |
| `system` | — | Yes |
| `link` | URL | No |
| `calculate` | 계산 결과 (number) | No |
| `set-var` | 설정된 값 | No |
| `list` | 생성/조회된 값 | No |
| `dict` | 생성/조회된 값 | No |
| `toast` | — | Yes |
| `wait` | — | Yes |
| `mouse-move` | — | Yes |
| `mouse-click` | — | Yes |
| `comment` | — | Yes |
| `if-else` | 실행된 분기의 마지막 출력 | No |
| `loop` | 각 반복 결과를 리스트로 수집 | No |
| `run-shortcut` | 자식 return 값 | No |
| `sequence` | — (비동기) | Yes |
| `escape` | — | Yes |
| `stop` | return 값 | N/A |

### 1-3. execute() 반환값 변경
- `execute()`: `Promise<void>` → `Promise<any>`
- 각 case에서 출력값 return
- pass-through 액션은 `ctx.pipelineValue` 그대로 return
- 호출부에서 반환값을 `ctx.pipelineValue`와 `ctx.magicVars`에 저장

### 1-4. 블록 반환값
- **If-Else**: 실행된 분기의 마지막 액션 출력
- **Loop**: 각 반복의 마지막 액션 출력을 배열로 수집
- **Choose from Menu** (Phase 5에서 UI 추가, 여기선 구조만)

### 1-5. Magic Variable 참조
- 기존 `$varName` 유지
- Magic Variable: `$__node_{nodeId}` → `ctx.magicVars`에서 조회
- `interpolate()` 확장: magicVars fallback

### 1-6. Editor UI
- **파일**: `src/renderer/shortcuts/src/ShortcutsApp.tsx`, `VariableInput.tsx`
- 각 노드 하단에 Magic Variable 칩 (별도 색상/아이콘)
- VariableInput 변수 목록에 Magic Variable 포함
- 사용자가 Magic Variable 이름 커스텀 가능

### 검증 항목
- [ ] shell stdout가 Magic Variable로 후속 액션에서 참조 가능
- [ ] pass-through: toast 다음 액션이 toast 이전 값을 받음
- [ ] if-else 블록 출력이 분기 결과로 반환
- [ ] loop 블록이 각 반복 결과를 리스트로 수집
- [ ] 에디터에서 Magic Variable 칩 표시, 드래그/선택 가능

---

## Phase 2: Expression 시스템 + Type 체계

> `$var` 단순 치환을 넘어 인라인 표현식 평가 + 기본 타입 시스템

### 2-1. Expression Evaluator
- **신규 파일**: `src/main/ExpressionEvaluator.ts`
- 안전한 파서 (eval 금지)
- 산술: `+`, `-`, `*`, `/`, `%`, `**`
- 비교: `==`, `!=`, `>`, `<`, `>=`, `<=`
- 논리: `&&`, `||`, `!`
- 문자열: `+` (연결), `.length`, `.includes()`
- 삼항: `condition ? a : b`
- 문법: `${expression}` (기존 `$varName`과 구분)

### 2-2. 타입 시스템
- 변수 저장 시 원본 타입 유지
- 기본 타입: `string`, `number`, `boolean`, `list`, `dict`
- 자동 변환: number↔string, list→string (JSON/join), any→boolean

### 2-3. 속성 접근
- `$__node_abc.length`, `$__node_abc.keys`
- 리스트: `.length`, `.first`, `.last`, `[index]`
- 딕셔너리: `.keys`, `.values`, `["key"]`
- 문자열: `.length`, `.trim`

### 검증 항목
- [ ] `${$a + $b}` 숫자 덧셈 평가
- [ ] `${$name.length > 5 ? "long" : "short"}` 동작
- [ ] list Magic Variable `.length` 속성 접근
- [ ] 타입 자동 변환: number → 문자열 컨텍스트

---

## Phase 3: 데이터 변환 액션

> 문자열 조작 + 리스트/딕셔너리 고급 연산 — Pipeline과 결합하여 데이터 플로우 완성

### 3-1. Text 액션 (신규 타입: `text`)
- 서브모드: `define`, `replace` (정규식), `match`, `split`, `combine`, `case`, `substring`, `trim`

### 3-2. List 고급 연산 (기존 `list` 확장)
- 추가 operation: `filter`, `map`, `sort`, `reverse`, `unique`, `count`, `contains`, `slice`, `flatten`

### 3-3. Dict 고급 연산 (기존 `dict` 확장)
- 추가 operation: `keys`, `values`, `merge`, `has`, `filter`

### 3-4. Convert 액션 (신규 타입: `convert`)
- string↔number, JSON parse/stringify, list↔text

### 3-5. Editor UI
- 각 신규 액션 에디터 컴포넌트
- 팔레트 카테고리 정리

### 검증 항목
- [ ] `text:replace` 정규식 → Magic Variable 참조
- [ ] `text:split` → `list:filter` → `text:combine` 파이프라인
- [ ] `list:map`에서 표현식 변환
- [ ] `dict:keys` → foreach 루프 입력

---

## Phase 4: I/O 액션

> 외부 시스템과 데이터 교환

### 4-1. HTTP 액션 (신규 타입: `http`)
- URL, Method (GET/POST/PUT/DELETE/PATCH), Headers, Body, Timeout
- 출력: response body (JSON 자동 파싱), status code, headers
- 보안: 사용자 확인 다이얼로그

### 4-2. File 액션 (신규 타입: `file`)
- 서브모드: `read`, `write`, `exists`, `info`, `pick`, `list-dir`
- 보안: 허용 경로 제한

### 4-3. Clipboard 액션 (신규 타입: `clipboard`)
- `get` / `set` — Electron clipboard 모듈 활용

### 4-4. Editor UI
- HTTP: URL, Method, Headers/Body 편집기
- File: 경로 + 파일 피커, 모드 선택
- Clipboard: get/set 토글

### 검증 항목
- [ ] HTTP GET → JSON → `dict:get` 필드 추출
- [ ] `file:read` → `text:split` → `list:count`
- [ ] `clipboard:get` → `text:replace` → `clipboard:set`
- [ ] HTTP 실패 시 에러 처리 (Phase 5 try-catch 연계)

---

## Phase 5: 사용자 입력 + 고급 제어 흐름

> 인터랙티브 액션, 에러 핸들링, 날짜/시간

### 5-1. Prompt 액션 (신규 타입: `prompt`)
- 서브모드: `input`, `choose-list`, `choose-menu`, `confirm`
- Electron dialog 또는 커스텀 오버레이

### 5-2. Choose from Menu (신규 타입: `menu`)
- 사용자 선택지 → 분기 실행
- 블록 반환값: 선택된 분기의 마지막 출력

### 5-3. Try-Catch (신규 타입: `try-catch`)
- `tryActions[]`, `catchActions[]`, `errorVar`
- 블록 반환값: 성공=try 출력, 실패=catch 출력

### 5-4. DateTime 액션 (신규 타입: `datetime`)
- 서브모드: `now`, `format`, `parse`, `adjust`, `diff`, `compare`

### 5-5. While 루프 (기존 `loop` 확장)
- `mode: 'while'` + condition
- 최대 반복 제한 10,000 유지

### 5-6. Editor UI
- prompt: 다이얼로그 미리보기, 선택지 편집기
- try-catch: try/catch 영역 시각 구분
- datetime: 포맷 미리보기
- while: criteria UI 재사용 (if-else와 동일)

### 검증 항목
- [ ] `prompt:input` → Magic Variable로 후속 사용
- [ ] `menu` 분기 실행 + 블록 출력값
- [ ] `try-catch`: shell 에러 → catch에서 toast
- [ ] `datetime:now` → `datetime:format` → `text:define`
- [ ] `while` 조건 반복 + escape 탈출

---

## Phase 간 의존성

```
Phase 1 (Magic Variables)     ← 모든 후속 Phase의 기반
  ↓
Phase 2 (Expression + Type)   ← 데이터 조작의 기반
  ↓
Phase 3 (데이터 변환)          ← Phase 1+2 활용
  ↓
Phase 4 (I/O)                 ← Phase 3과 결합하여 실용적 파이프라인
  ↓
Phase 5 (입력 + 제어)          ← 모든 이전 Phase 활용
```

---

## 주요 수정 파일

| 파일 | Phase | 변경 |
|------|-------|------|
| `shared/config.types.ts` | 1–5 | ActionType 확장, 신규 타입 정의 |
| `src/main/ActionExecutor.ts` | 1–5 | execute() 반환값, Magic Var, 신규 핸들러 |
| `src/main/ExpressionEvaluator.ts` | 2 | **신규** — 표현식 평가기 |
| `src/renderer/shortcuts/src/ShortcutsApp.tsx` | 1–5 | 노드 에디터, Magic Variable UI |
| `src/renderer/shortcuts/src/VariableInput.tsx` | 1–2 | Magic Variable 목록, 속성 접근 |
| `src/preload/shortcuts.ts` | 5 | prompt IPC |
| `src/main/ipc/shortcutsHandlers.ts` | 5 | prompt 다이얼로그 핸들러 |
