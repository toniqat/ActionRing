# ActionRing 신규 액션 구현 계획

## 진행 개요

| Phase | 이름 | 액션 | 상태 | 비고 |
|:---:|---|---|:---:|---|
| 1 | 데이터 처리 기초 | `clipboard` · `text` · `transform` | ✅ 완료 | 타입, 실행, 아이콘, i18n, 에디터 UI 모두 완료 |
| 2 | 사용자 상호작용 | `ask-input` · `choose-from-list` · `show-alert` | ✅ 완료 | DialogManager + 인라인 HTML BrowserWindow |
| 3 | 외부 연동 | `http-request` · `file` | ✅ 완료 | Node.js fetch + fs + Electron dialog |
| 4 | 시간 & 에러 처리 | `date-time` · `try-catch` | ✅ 완료 | try-catch는 제어문 |
| 5 | Windows 전용 | `registry` · `environment` · `service` | ✅ 완료 | PowerShell 기반 |

**전체 진행률: 13 / 13 액션 완료**

### Phase 2 완료 요약
- **ask-input**: `text`/`number`/`password` 입력 타입. 인라인 HTML BrowserWindow 모달
- **choose-from-list**: 리터럴 항목 또는 리스트 변수 소스. 다중 선택 지원. 인라인 HTML BrowserWindow 모달
- **show-alert**: Electron 네이티브 `dialog.showMessageBox` 사용. 확인/취소 결과 반환
- 신규 파일: `src/main/DialogManager.ts`
- 수정 파일: `config.types.ts`, `ipc.types.ts`, `ActionExecutor.ts`, `index.ts`, `uiIcons.ts`, `locales.ts`, `ShortcutsApp.tsx`

### Phase 3 완료 요약
- **http-request**: 6개 HTTP 메서드 (`GET`/`POST`/`PUT`/`DELETE`/`PATCH`/`HEAD`). Node.js `fetch()` 사용. 헤더(JSON), 본문, 타임아웃 지원. 응답 body + 상태코드 변수 저장
- **file**: 9개 모드 (`read`/`write`/`exists`/`list`/`pick`/`info`/`delete`/`rename`/`copy`). Node.js `fs/promises` + Electron `dialog` 사용. 글로브 패턴 필터링, 파일 선택 다이얼로그 지원
- 수정 파일: `config.types.ts`, `ActionExecutor.ts`, `uiIcons.ts`, `locales.ts`, `ShortcutsApp.tsx`

### Phase 4 완료 요약
- **date-time**: 5개 모드 (`now`/`format`/`math`/`diff`/`parse`). JavaScript `Date` + `Intl` 사용. 커스텀 포맷 (`YYYY-MM-DD HH:mm:ss`) 지원. 날짜 연산(add/subtract), 두 날짜 차이 계산 가능
- **try-catch**: `if-else`, `loop`과 동급 제어문. `tryActions`/`catchActions` 중첩 액션 리스트. `errorVar`로 에러 메시지 접근. `LoopBreakSignal`/`SequenceStopSignal`은 전파 (의도적 중단은 catch하지 않음)
- 수정 파일: `config.types.ts`, `ActionExecutor.ts`, `uiIcons.ts`, `locales.ts`, `ShortcutsApp.tsx`

### Phase 5 완료 요약
- **registry**: 4개 모드 (`read`/`write`/`delete`/`exists`). PowerShell `Get-ItemProperty`/`Set-ItemProperty`/`Remove-ItemProperty` 사용. 5개 하이브 (`HKLM`/`HKCU`/`HKCR`/`HKU`/`HKCC`), 5개 데이터 타입 지원
- **environment**: 3개 모드 (`get`/`set`/`list`). `process.env` 사용. list 모드는 JSON 객체 반환
- **service**: 4개 모드 (`status`/`start`/`stop`/`restart`). PowerShell `Get-Service`/`Start-Service`/`Stop-Service`/`Restart-Service` 사용
- 수정 파일: `config.types.ts`, `ActionExecutor.ts`, `uiIcons.ts`, `locales.ts`, `ShortcutsApp.tsx`

### Phase 1 완료 요약
- **clipboard**: `get`/`set` 모드. `electron.clipboard` 사용
- **text**: 9개 모드 (`replace`, `split`, `combine`, `case`, `match`, `substring`, `length`, `trim`, `pad`). 순수 JS 문자열 연산
- **transform**: 7개 모드 (`json-parse`, `json-stringify`, `url-encode`, `url-decode`, `base64-encode`, `base64-decode`, `hash`). `crypto.createHash` 사용
- 수정 파일: `config.types.ts`, `ActionExecutor.ts`, `uiIcons.ts`, `locales.ts`, `ShortcutsApp.tsx`

---

## 배경
ActionRing의 아이덴티티: "로지텍 액션링 + macOS Shortcuts를 Windows에서 제한 없이 사용"
현재 제어흐름/변수/셸/키보드마우스는 완비되어 있으나, **데이터 처리, 사용자 상호작용, 네트워크/파일 I/O** 영역이 미흡.

## 설계 원칙
- 기존 패턴 따름: discriminated union (`type` 필드) + `mode` 필드로 다중 모드
- 유사 기능은 하나의 액션으로 통합 (사용자 친화적)
- 모든 문자열 필드에 `$변수` 보간 지원
- 반환값은 `resultVar`에 저장 (기존 패턴과 동일)

---

## 신규 액션 13개 상세 스펙

### 1. `clipboard` — 클립보드
```typescript
export type ClipboardMode = 'get' | 'set'

export interface ClipboardAction {
  type: 'clipboard'
  mode: ClipboardMode
  resultVar?: string       // get: 클립보드 내용 저장
  value?: string           // set: 클립보드에 복사할 값 ($보간)
}
```
구현: `electron.clipboard.readText()` / `writeText()`

---

### 2. `text` — 텍스트 처리 (9개 모드 통합)
```typescript
export type TextMode = 'replace' | 'split' | 'combine' | 'case' | 'match' | 'substring' | 'length' | 'trim' | 'pad'

export interface TextAction {
  type: 'text'
  mode: TextMode
  input: string            // 원본 ($보간)
  resultVar: string

  // replace
  find?: string
  replaceWith?: string
  useRegex?: boolean

  // split / combine
  separator?: string
  listVar?: string         // combine: 합칠 리스트 변수명

  // case
  caseMode?: 'upper' | 'lower' | 'capitalize' | 'camel' | 'snake' | 'kebab'

  // match
  pattern?: string         // 정규식
  matchAll?: boolean

  // substring
  start?: number | string
  length?: number | string

  // pad
  padLength?: number | string
  padChar?: string
  padSide?: 'start' | 'end'
}
```
반환값 요약:
- `replace` → 치환된 문자열
- `split` → JSON 배열 문자열 `["a","b"]`
- `combine` → 합쳐진 문자열
- `case` → 변환된 문자열
- `match` → 매치 문자열 / JSON 배열
- `substring` → 부분 문자열
- `length` → 숫자 문자열 (예: `"12"`)
- `trim` → 공백 제거된 문자열
- `pad` → 패딩된 문자열

구현: 순수 JavaScript 문자열/정규식 연산

---

### 3. `transform` — 형식 변환 (JSON/URL/Base64/Hash 통합)
```typescript
export type TransformMode = 'json-parse' | 'json-stringify' | 'url-encode' | 'url-decode' | 'base64-encode' | 'base64-decode' | 'hash'

export interface TransformAction {
  type: 'transform'
  mode: TransformMode
  input: string
  resultVar: string
  algorithm?: 'md5' | 'sha1' | 'sha256' | 'sha512'  // hash 모드 전용
}
```
구현: `JSON.parse/stringify`, `encodeURIComponent`, `Buffer.from().toString('base64')`, `crypto.createHash()`

---

### 4. `http-request` — HTTP 요청
```typescript
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD'

export interface HttpRequestAction {
  type: 'http-request'
  url: string
  method: HttpMethod
  headers?: string         // JSON 문자열 ($보간)
  body?: string            // 요청 본문 ($보간)
  timeout?: number         // ms, 기본 30000
  resultVar?: string       // 응답 body
  statusVar?: string       // HTTP 상태 코드 문자열
}
```
구현: Node.js `fetch()`

---

### 5. `file` — 파일 I/O (9개 모드, 모드별 반환값 상이)
```typescript
export type FileMode = 'read' | 'write' | 'exists' | 'list' | 'pick' | 'info' | 'delete' | 'rename' | 'copy'

export interface FileAction {
  type: 'file'
  mode: FileMode
  path?: string
  resultVar?: string

  // read
  encoding?: string        // 기본 'utf8'

  // write
  content?: string
  writeMode?: 'overwrite' | 'append'

  // list
  pattern?: string         // glob

  // pick
  title?: string
  filters?: string         // JSON
  pickMode?: 'file' | 'directory'

  // rename / copy
  destination?: string

  // info
  infoField?: 'size' | 'modified' | 'created' | 'extension' | 'name' | 'directory'
}
```

| mode | 반환값 (resultVar) |
|---|---|
| `read` | 파일 내용 (문자열) |
| `write` | 없음 |
| `exists` | `"true"` / `"false"` |
| `list` | JSON 배열 `["file1.txt","file2.txt"]` |
| `pick` | 선택된 파일/폴더 경로 |
| `info` | infoField에 따라: 크기(bytes), 날짜(ISO), 확장자, 이름, 디렉토리 경로 |
| `delete` | 없음 |
| `rename` | 새 경로 |
| `copy` | 복사된 경로 |

구현: Node.js `fs` + Electron `dialog`

---

### 6. `date-time` — 날짜/시간 (5개 모드 통합)
```typescript
export type DateTimeMode = 'now' | 'format' | 'math' | 'diff' | 'parse'

export interface DateTimeAction {
  type: 'date-time'
  mode: DateTimeMode
  resultVar: string
  format?: string          // 'iso'(기본) | 'locale' | 'timestamp' | 커스텀
  input?: string
  amount?: number | string // math: 더하거나 뺄 양
  unit?: 'years' | 'months' | 'days' | 'hours' | 'minutes' | 'seconds' | 'milliseconds'
  date1?: string           // diff
  date2?: string           // diff
}
```

| mode | 반환값 (resultVar) |
|---|---|
| `now` | 현재 시간 (format에 따라) |
| `format` | 포맷 변환된 날짜 문자열 |
| `math` | 연산된 날짜 (ISO 문자열) |
| `diff` | 두 날짜 차이 (숫자 문자열) |
| `parse` | 파싱된 타임스탬프 문자열 |

구현: JavaScript `Date` + `Intl.DateTimeFormat`

---

### 7. `try-catch` — 에러 처리 (제어문)
```typescript
export interface TryCatchAction {
  type: 'try-catch'
  tryActions: ActionConfig[]
  catchActions: ActionConfig[]
  errorVar?: string        // 에러 메시지 접근 변수
}
```
기존 `if-else`, `loop`과 동급 제어문. `SequenceStopSignal`은 catch하지 않음 (의도적 중단).

---

### 8. `ask-input` — 사용자 텍스트 입력
```typescript
export type AskInputType = 'text' | 'number' | 'password'

export interface AskInputAction {
  type: 'ask-input'
  title?: string
  prompt?: string
  defaultValue?: string
  inputType?: AskInputType
  resultVar: string
}
```
구현: 커스텀 BrowserWindow 모달

---

### 9. `choose-from-list` — 리스트 선택
```typescript
export interface ChooseFromListAction {
  type: 'choose-from-list'
  title?: string
  items?: string[]         // 리터럴 항목
  listVar?: string         // 또는 리스트 변수
  multiple?: boolean
  resultVar: string        // 다중이면 JSON 배열
}
```

---

### 10. `show-alert` — 알림 다이얼로그
```typescript
export interface ShowAlertAction {
  type: 'show-alert'
  title?: string
  message?: string
  confirmText?: string     // 기본 "OK"
  cancelText?: string      // null이면 취소 버튼 없음
  resultVar?: string       // "confirmed" / "cancelled"
}
```

---

### 11. `registry` — Windows 레지스트리 (Windows 전용)
```typescript
export type RegistryMode = 'read' | 'write' | 'delete' | 'exists'

export interface RegistryAction {
  type: 'registry'
  mode: RegistryMode
  hive: 'HKLM' | 'HKCU' | 'HKCR' | 'HKU' | 'HKCC'
  keyPath: string
  valueName?: string
  data?: string
  dataType?: 'REG_SZ' | 'REG_DWORD' | 'REG_QWORD' | 'REG_EXPAND_SZ' | 'REG_MULTI_SZ'
  resultVar?: string
}
```
구현: PowerShell `Get-ItemProperty` / `Set-ItemProperty`

---

### 12. `environment` — 환경변수 (Windows 전용)
```typescript
export type EnvironmentMode = 'get' | 'set' | 'list'

export interface EnvironmentAction {
  type: 'environment'
  mode: EnvironmentMode
  name?: string
  value?: string
  resultVar?: string       // get→값, list→JSON 객체
}
```
구현: `process.env`

---

### 13. `service` — Windows 서비스 (Windows 전용)
```typescript
export type ServiceMode = 'status' | 'start' | 'stop' | 'restart'

export interface ServiceAction {
  type: 'service'
  mode: ServiceMode
  serviceName: string
  resultVar?: string       // status→"running"/"stopped"/"paused" 등
}
```
구현: PowerShell `Get-Service` / `Start-Service` / `Stop-Service`

---

## ActionType 변경 요약

```typescript
// 기존
export type ActionType = 'launch' | 'keyboard' | 'shell' | 'system' | 'folder' | 'link'
  | 'if-else' | 'loop' | 'sequence' | 'wait'
  | 'set-var' | 'list' | 'dict' | 'toast' | 'run-shortcut'
  | 'escape' | 'stop' | 'calculate' | 'comment'
  | 'mouse-move' | 'mouse-click'

// 추가 (+13)
  | 'clipboard' | 'text' | 'transform' | 'http-request'
  | 'file' | 'date-time' | 'try-catch'
  | 'ask-input' | 'choose-from-list' | 'show-alert'
  | 'registry' | 'environment' | 'service'
```

---

## 구현 순서 (Phase별)

### Phase 1: 데이터 처리 기초 ✅
- [x] `clipboard` (get/set)
- [x] `text` (9개 모드)
- [x] `transform` (7개 모드)

### Phase 2: 사용자 상호작용 ✅
- [x] `ask-input`
- [x] `choose-from-list`
- [x] `show-alert`

### Phase 3: 외부 연동 ✅
- [x] `http-request`
- [x] `file` (9개 모드)

### Phase 4: 시간 & 에러 처리 ✅
- [x] `date-time` (5개 모드)
- [x] `try-catch`

### Phase 5: Windows 전용 ✅
- [x] `registry` (4개 모드)
- [x] `environment` (3개 모드)
- [x] `service` (4개 모드)

---

## 각 Phase 수정 파일

| 파일 | 작업 |
|---|---|
| `shared/config.types.ts` | ActionType 확장, 인터페이스 추가, ActionConfig union 확장 |
| `src/main/ActionExecutor.ts` | execute 함수에 새 case 추가 |
| `src/renderer/shortcuts/` | 에디터 UI에 새 액션 노드 편집 폼 |
| `shared/ipc.types.ts` | 다이얼로그 IPC 채널 (Phase 2) |
| `src/main/WindowManager.ts` | 다이얼로그 윈도우 생성 (Phase 2) |
| `src/preload/` | 다이얼로그 IPC 브릿지 (Phase 2) |

## 검증 방법
- Shortcuts 에디터에서 각 새 액션 추가/모드전환/편집 가능한지
- 시퀀스 내 조합 실행 (예: HTTP → json-parse → if-else 분기)
- 변수 보간이 모든 필드에서 동작
- 에러 케이스 처리 (잘못된 URL, 없는 파일, 잘못된 정규식 등)
- Windows 전용 액션의 관리자 권한 에러 메시지
