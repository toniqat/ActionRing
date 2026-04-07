# ActionRing — Canonical Terminology Reference

> **Purpose**: 프로젝트 내 모든 기능, 창, 컴포넌트의 정식 명칭을 정의한다.
> 프롬프트, 문서, 코드 리뷰 시 이 파일에 정의된 명칭을 사용할 것.
>
> **표기 규칙**: English Name (한국어명) — 영문을 기본으로 하고 괄호 안에 한국어를 병기한다.

---

## 1. Windows (창)

| Variable | Canonical Name | Manager | Description |
|---|---|---|---|
| `ringWindow` | **Ring Overlay (링 오버레이)** | `WindowManager` | 투명 오버레이. 커서 주변에 원형 메뉴 표시. `transparent:true`, `focusable:false`, `alwaysOnTop:'screen-saver'` |
| `settingsWindow` | **Settings Window (설정 창)** | `WindowManager` | 메인 설정/구성 창. 1040×600, `frame:false` |
| `appearanceWindow` | **Appearance Editor Window (외관 편집기 창)** | `WindowManager` | 슬롯 외관(색상/아이콘) 편집 전용 창. 720×400 |
| `shortcutsWindow` | **Shortcuts Editor Window (단축 편집기 창)** | `WindowManager` | 액션 시퀀스 편집 전용 창. 880×560 |
| `progressWindow` | **Progress Overlay (진행 오버레이)** | `WindowManager` | 시퀀스 실행 진행 표시. 320×80, 투명, alwaysOnTop |
| popup windows | **Popup Menu (팝업 메뉴)** | `PopupMenuManager` | 우클릭 컨텍스트 메뉴. 동적으로 생성/제거되는 BrowserWindow 풀 |

---

## 2. Settings Tabs (설정 탭)

### Active Tabs (활성 탭)

| Tab ID | Canonical Name | Component | Description |
|---|---|---|---|
| `configure` | **Configure Tab (구성 탭)** | `UnifiedTab` | Ring/Slot/App을 통합 편집하는 메인 탭 |
| `shortcuts` | **Shortcuts Tab (단축 탭)** | `ShortcutsTab` | Shortcuts Library 관리 (생성, 편집, 그룹화) |
| `general` | **General Tab (일반 탭)** | `GeneralTab` | Trigger 설정, 테마, 언어, 데이터 관리 |
| `about` | **About Tab (정보 탭)** | `AboutTab` | 버전 정보, 업데이트 확인 |

### Legacy Tabs (레거시 탭) — 비활성, 참고용

| Tab ID | Component | Note |
|---|---|---|
| `slots` | `SlotsTab` | Configure Tab으로 통합됨 |
| `radius` | `RadiusTab` | Configure Tab으로 통합됨 |
| `appearance` | `AppearanceTab` | Configure Tab으로 통합됨 |

---

## 3. Core Domain Concepts (핵심 도메인 개념)

| Term | TypeScript Type | Description |
|---|---|---|
| **Slot (슬롯)** | `SlotConfig` | Ring 안의 액션 버튼. label, icon, actions, shortcutIds, subSlots 등을 포함 |
| **Sub-Slot (하위 슬롯)** | `SlotConfig.subSlots[]` | Folder Slot 안의 하위 슬롯. 서브링에 표시됨 |
| **Ring (링)** | — | 커서 주변에 표시되는 원형 메뉴 전체 |
| **Sub-Ring (서브링)** | — | Folder Slot 클릭 시 나타나는 하위 원형 메뉴 |
| **App Entry (앱 항목)** | `AppEntry` | App Carousel의 항목. Default System 또는 특정 exe에 매핑 |
| **App Profile (앱 프로필)** | `AppProfile` | App Entry 내 프로필. 자체 slots/appearance를 가짐 |
| **Default System (기본 시스템)** | `AppEntry (id='default')` | 항상 첫 번째에 고정되는 기본 앱 항목 |
| **Action (액션)** | `ActionConfig` | 실행 가능한 단일 작업. discriminated union |
| **Shortcut (단축)** | `ShortcutEntry` | 재사용 가능한 액션 시퀀스. Shortcuts Library에 저장 |
| **Shortcut Group (단축 그룹)** | `ShortcutGroup` | Shortcut을 분류하는 폴더 |
| **Shortcuts Library (단축 라이브러리)** | `AppConfig.shortcutsLibrary[]` | 전역 Shortcut 컬렉션 |
| **Trigger (트리거)** | `TriggerConfig` | Ring을 활성화하는 마우스 버튼 + 수정자키 조합 |
| **Button Preset (버튼 프리셋)** | `ButtonPreset` | 단일 Slot을 파일로 내보내기/가져오기하는 형식 |
| **App Config (앱 설정)** | `AppConfig` | 전체 앱 설정 루트 객체. ConfigStore가 관리 |
| **Appearance Config (외관 설정)** | `AppearanceConfig` | Ring의 시각적 설정 (반지름, 크기, 투명도, 애니메이션) |

---

## 4. Action Types (액션 타입)

### 4a. Action Types

| Type Literal | Interface | Category | Description |
|---|---|---|---|
| `launch` | `LaunchAction` | Basic | 프로그램/파일 실행 |
| `keyboard` | `KeyboardAction` | Basic | 키보드 입력 전송 |
| `shell` | `ShellAction` | Basic | 셸 명령 실행 |
| `system` | `SystemAction` | Basic | 시스템 액션 (볼륨, 스크린샷 등) |
| `folder` | `FolderAction` | Basic | 하위 슬롯을 가진 폴더 |
| `link` | `LinkAction` | Basic | URL 열기 |
| `if-else` | `IfElseAction` | Logic | 조건 분기 (if-else / switch) |
| `loop` | `LoopAction` | Logic | 반복 (repeat / for / foreach) |
| `sequence` | `SequenceAction` | Logic | 병렬 비동기 작업 그룹 |
| `wait` | `WaitAction` | Logic | 대기 (시간 / 변수 / 앱종료 / 키입력) |
| `set-var` | `SetVarAction` | Variable | 변수 설정 |
| `list` | `ListAction` | Variable | 리스트 변수 (정의 / CRUD) |
| `dict` | `DictAction` | Variable | 딕셔너리 변수 (정의 / CRUD) |
| `toast` | `ToastAction` | Utility | 알림 메시지 표시 |
| `run-shortcut` | `RunShortcutAction` | Utility | 다른 Shortcut 호출 (입출력 매핑 가능) |
| `escape` | `EscapeAction` | Utility | 가장 가까운 Loop 탈출 (break) |
| `stop` | `StopAction` | Utility | 전체 시퀀스 즉시 중단 |
| `calculate` | `CalculateAction` | Utility | 수학 연산 (add/sub/mul/div/mod/pow/sqrt) |
| `comment` | `CommentAction` | Utility | 문서용 주석 노드 (실행 없음) |
| `mouse-move` | `MouseMoveAction` | Mouse | 마우스 이동 (절대/상대) |
| `mouse-click` | `MouseClickAction` | Mouse | 마우스 클릭 |

### 4b. System Action IDs

| ID | Description |
|---|---|
| `volume-up` | 볼륨 증가 |
| `volume-down` | 볼륨 감소 |
| `play-pause` | 재생/일시정지 |
| `screenshot` | 스크린샷 |
| `lock-screen` | 화면 잠금 |
| `show-desktop` | 바탕화면 표시 |
| `mute` | 음소거 토글 |

---

## 5. UI Components (UI 컴포넌트)

### 5a. Settings Window — Configure Tab (구성 탭)

| Component | Location | Description |
|---|---|---|
| **UnifiedTab (통합 탭)** | `settings/components/unified/UnifiedTab.tsx` | Configure Tab의 루트 컴포넌트 |
| **RingPreview (링 미리보기)** | `settings/components/unified/RingPreview.tsx` | 인터랙티브 링 레이아웃 프리뷰 |
| **SlotEditPanel (슬롯 편집 패널)** | `settings/components/unified/SlotEditPanel.tsx` | 개별 Slot 속성 편집기 |
| **SlotAppearancePopup (슬롯 외관 팝업)** | SlotEditPanel 내부 정의 | Slot 색상/아이콘 인라인 선택 팝업 |
| **AppCarousel (앱 캐러셀)** | `settings/components/unified/AppCarousel.tsx` | 수평 App Entry/Profile 선택 UI |
| **FloatingRingLayoutPanel (플로팅 링 레이아웃)** | `settings/components/unified/FloatingRingLayoutPanel.tsx` | 링 구조 시각화 패널 |
| **LeftPanel (좌측 패널)** | `settings/components/unified/LeftPanel.tsx` | 좌측 사이드바 컨테이너 |
| **ShortcutSidebar (단축 사이드바)** | `settings/components/unified/ShortcutSidebar.tsx` | Shortcut 라이브러리 팔레트 |
| **ShortcutNodeCard (단축 노드 카드)** | `settings/components/unified/ShortcutNodeCard.tsx` | 개별 Shortcut 카드 UI |
| **ShortcutsModal (단축 모달)** | `settings/components/unified/ShortcutsModal.tsx` | 전체 화면 액션 시퀀스 편집기 |
| **AddAppOverlay (앱 추가 오버레이)** | `settings/components/unified/AddAppOverlay.tsx` | 새 App Entry 생성 오버레이 |
| **AppearanceEditor (외관 편집기 컴포넌트)** | `settings/components/unified/AppearanceEditor.tsx` | 외관 커스터마이저 (컴포넌트, 창과 구분) |

### 5b. Settings Window — Other Tabs

| Component | Location | Description |
|---|---|---|
| **GeneralTab (일반 탭)** | `settings/components/tabs/GeneralTab.tsx` | Trigger, 테마, 언어, 데이터 관리 |
| **ShortcutsTab (단축 탭)** | `settings/components/tabs/ShortcutsTab.tsx` | Shortcuts Library 목록 관리 |
| **AboutTab (정보 탭)** | `settings/components/tabs/AboutTab.tsx` | 버전 및 업데이트 |
| **WinControls (윈도우 컨트롤)** | `settings/components/WinControls.tsx` | 최소화/최대화/닫기 버튼 |

### 5c. Ring Overlay (링 오버레이)

| Component | Location | Description |
|---|---|---|
| **RingOverlay (링 오버레이)** | `ring/src/components/RingOverlay.tsx` | 최상위 오버레이 컨테이너 |
| **RingCanvas (링 캔버스)** | `ring/src/components/RingCanvas.tsx` | SVG 기반 링 렌더링 엔진 |
| **RingSegment (링 세그먼트)** | `ring/src/components/RingSegment.tsx` | 개별 Slot 세그먼트 |
| **SegmentIcon (세그먼트 아이콘)** | `ring/src/components/SegmentIcon.tsx` | 세그먼트 내 아이콘 렌더러 |

### 5d. Shortcuts Editor Window (단축 편집기 창)

| Component | Location | Description |
|---|---|---|
| **ShortcutsApp (단축 앱)** | `shortcuts/src/ShortcutsApp.tsx` | 창 루트 컨테이너 |
| **VariableInput (변수 입력)** | `shortcuts/src/components/VariableInput.tsx` | 변수/표현식 입력 컴포넌트 |
| **CustomSelect (커스텀 셀렉트)** | `shortcuts/src/components/CustomSelect.tsx` | 커스텀 드롭다운 셀렉터 |

### 5e. Appearance Editor Window (외관 편집기 창)

| Component | Location | Description |
|---|---|---|
| **AppearanceApp (외관 앱)** | `appearance/src/AppearanceApp.tsx` | 창 루트 컨테이너 |

### 5f. Progress Overlay (진행 오버레이)

| Component | Location | Description |
|---|---|---|
| **ProgressOverlay (진행 오버레이)** | `progress/src/ProgressOverlay.tsx` | 시퀀스 진행 표시 |
| **Spinner (스피너)** | `progress/src/components/Spinner.tsx` | 로딩 애니메이션 |

### 5g. Popup Menu (팝업 메뉴)

| Component | Location | Description |
|---|---|---|
| **PopupMenu (팝업 메뉴)** | `popup-menu/src/PopupMenu.tsx` | 컨텍스트 메뉴 렌더러 |

---

## 6. IPC Channels (IPC 채널)

방향 표기: `M→R` = Main→Renderer, `R→M` = Renderer→Main, `↔` = 양방향

### 6a. Ring (링)

| Channel | Constant | Direction | Description |
|---|---|---|---|
| `ring:show` | `IPC_RING_SHOW` | M→R | Ring 표시 (slots, appearance, cursor 포함) |
| `ring:hide` | `IPC_RING_HIDE` | M→R | Ring 숨김 (트리거 해제 시) |
| `ring:idle` | `IPC_RING_IDLE` | M→R | 대기 상태 전환 |
| `ring:execute` | `IPC_RING_EXECUTE` | R→M | Slot 액션 실행 요청 |
| `ring:dismiss` | `IPC_RING_DISMISS` | R→M | 액션 없이 Ring 닫기 |
| `ring:cursor-move` | `IPC_RING_CURSOR_MOVE` | R→M | 커서 위치 업데이트 |

### 6b. Config (설정)

| Channel | Constant | Direction | Description |
|---|---|---|---|
| `config:get` | `IPC_CONFIG_GET` | R→M | AppConfig 요청 |
| `config:save` | `IPC_CONFIG_SAVE` | R→M | AppConfig 저장 |
| `config:updated` | `IPC_CONFIG_UPDATED` | M→R | 변경된 AppConfig 푸시 |
| `config:reset` | `IPC_CONFIG_RESET` | R→M | 초기화 (팩토리 리셋) |
| `config:export-global` | `IPC_CONFIG_EXPORT_GLOBAL` | R→M | 전체 설정 내보내기 |
| `config:import-global` | `IPC_CONFIG_IMPORT_GLOBAL` | R→M | 전체 설정 가져오기 |

### 6c. Appearance Editor (외관 편집기)

| Channel | Constant | Direction | Description |
|---|---|---|---|
| `appearance:open` | `IPC_APPEARANCE_OPEN` | R→M | 외관 편집기 창 열기/포커스 |
| `appearance:get-data` | `IPC_APPEARANCE_GET_DATA` | R→M | 초기 Slot 데이터 요청 |
| `appearance:update` | `IPC_APPEARANCE_UPDATE` | R→M | Slot 변경 → Settings에 전달 |
| `appearance:updated` | `IPC_APPEARANCE_UPDATED` | M→R | Settings에 Slot 업데이트 전달 |
| `appearance:data-refresh` | `IPC_APPEARANCE_DATA_REFRESH` | M→R | 새 Slot 데이터 푸시 |
| `appearance:panel-sizes` | `IPC_APPEARANCE_PANEL_SIZES` | R→M | 패널 리사이저 크기 저장 |

### 6d. Shortcuts Editor (단축 편집기)

| Channel | Constant | Direction | Description |
|---|---|---|---|
| `shortcuts:open` | `IPC_SHORTCUTS_OPEN` | R→M | 단축 편집기 창 열기 |
| `shortcuts:get-data` | `IPC_SHORTCUTS_GET_DATA` | R→M | 초기 Slot 데이터 요청 |
| `shortcuts:update` | `IPC_SHORTCUTS_UPDATE` | R→M | Slot 변경 → Settings에 전달 |
| `shortcuts:updated` | `IPC_SHORTCUTS_UPDATED` | M→R | Settings에 Slot 업데이트 전달 |
| `shortcuts:data-refresh` | `IPC_SHORTCUTS_DATA_REFRESH` | M→R | 새 Slot 데이터 푸시 |
| `shortcuts:close` | `IPC_SHORTCUTS_CLOSE` | R→M | 편집기 닫기 + 최종 Slot 저장 |
| `shortcuts:committed` | `IPC_SHORTCUTS_COMMITTED` | R→M | 변경 확정 |
| `shortcuts:play` | `IPC_SHORTCUTS_PLAY` | R→M | 액션 시퀀스 테스트 실행 |
| `shortcuts:theme-update` | `IPC_SHORTCUTS_THEME_UPDATE` | M→R | 테마 변경 알림 |

### 6e. App Profiles (앱 프로필)

| Channel | Constant | Direction | Description |
|---|---|---|---|
| `app:add` | `IPC_APP_ADD` | R→M | App Entry 추가 |
| `app:remove` | `IPC_APP_REMOVE` | R→M | App Entry 제거 |
| `app:profile:add` | `IPC_APP_PROFILE_ADD` | R→M | Profile 추가 |
| `app:profile:remove` | `IPC_APP_PROFILE_REMOVE` | R→M | Profile 제거 |
| `app:profile:rename` | `IPC_APP_PROFILE_RENAME` | R→M | Profile 이름 변경 |
| `app:profile:set-active` | `IPC_APP_PROFILE_SET_ACTIVE` | R→M | 활성 Profile 설정 |
| `app:profile:duplicate` | `IPC_APP_PROFILE_DUPLICATE` | R→M | Profile 복제 |
| `app:profile:export` | `IPC_APP_PROFILE_EXPORT` | R→M | Profile 내보내기 |
| `app:update-target` | `IPC_APP_UPDATE_TARGET` | R→M | App Entry 대상 exe 변경 |
| `app:get-icon` | `IPC_APP_GET_ICON` | R→M | exe 아이콘 추출 |
| `app:get-processes` | `IPC_APP_GET_PROCESSES` | R→M | 실행 중 프로세스 목록 |
| `app:import-profile` | `IPC_APP_IMPORT_PROFILE` | R→M | Profile 가져오기 |
| `app:export-all-profiles` | `IPC_APP_EXPORT_ALL_PROFILES` | R→M | 전체 Profile 내보내기 |
| `app:import-all-profiles` | `IPC_APP_IMPORT_ALL_PROFILES` | R→M | 전체 Profile 가져오기 |

### 6f. Icons (아이콘)

| Channel | Constant | Direction | Description |
|---|---|---|---|
| `icons:get-custom` | `IPC_ICONS_GET_CUSTOM` | R→M | 커스텀 아이콘 목록 |
| `icons:add-custom` | `IPC_ICONS_ADD_CUSTOM` | R→M | 커스텀 아이콘 추가 |
| `icons:remove-custom` | `IPC_ICONS_REMOVE_CUSTOM` | R→M | 커스텀 아이콘 제거 |
| `icons:get-recent` | `IPC_ICONS_GET_RECENT` | R→M | 최근 사용 아이콘 |
| `icons:add-recent` | `IPC_ICONS_ADD_RECENT` | R→M | 최근 사용에 추가 |
| `icons:get-resource` | `IPC_ICONS_GET_RESOURCE` | R→M | 번들 리소스 아이콘 목록 |
| `icons:read-svg` | `IPC_ICONS_READ_SVG` | R→M | SVG 파일 내용 읽기 |

### 6g. Popup Menu (팝업 메뉴)

| Channel | Constant | Direction | Description |
|---|---|---|---|
| `popup-menu:show` | `IPC_POPUP_MENU_SHOW` | R→M | 메뉴 표시 요청 |
| `popup-menu:init` | `IPC_POPUP_MENU_INIT` | M→R | 메뉴 데이터 초기화 |
| `popup-menu:item-click` | `IPC_POPUP_MENU_ITEM_CLICK` | R→M | 항목 클릭 |
| `popup-menu:show-submenu` | `IPC_POPUP_MENU_SHOW_SUBMENU` | R→M | 서브메뉴 열기 |
| `popup-menu:close-submenu` | `IPC_POPUP_MENU_CLOSE_SUBMENU` | R→M | 서브메뉴 닫기 |
| `popup-menu:resize` | `IPC_POPUP_MENU_RESIZE` | R→M | 메뉴 크기 조정 |
| `popup-menu:dismiss` | `IPC_POPUP_MENU_DISMISS` | R→M | 메뉴 닫기 |

### 6h. Trigger (트리거)

| Channel | Constant | Direction | Description |
|---|---|---|---|
| `trigger:start-mouse-capture` | `IPC_TRIGGER_START_MOUSE_CAPTURE` | R→M | 마우스 캡처 시작 |
| `trigger:cancel-mouse-capture` | `IPC_TRIGGER_CANCEL_MOUSE_CAPTURE` | R→M | 마우스 캡처 취소 |
| `trigger:mouse-captured` | `IPC_TRIGGER_MOUSE_CAPTURED` | M→R | 캡처된 버튼 결과 |

### 6i. Other (기타)

| Channel | Constant | Direction | Description |
|---|---|---|---|
| `progress:update` | `IPC_PROGRESS_UPDATE` | M→R | 시퀀스 진행 상태 |
| `window:minimize` | `IPC_WINDOW_MINIMIZE` | R→M | 창 최소화 |
| `window:maximize` | `IPC_WINDOW_MAXIMIZE` | R→M | 창 최대화 |
| `window:close` | `IPC_WINDOW_CLOSE` | R→M | 창 닫기 |
| `file:pick-exe` | `IPC_FILE_PICK_EXE` | R→M | exe 파일 선택 대화상자 |
| `file:pick-icon` | `IPC_FILE_PICK_ICON` | R→M | 아이콘 파일 선택 대화상자 |
| `shortcut:test` | `IPC_SHORTCUT_TEST` | R→M | Shortcut 문자열 유효성 검사 |
| `preset:export` | `IPC_PRESET_EXPORT` | R→M | Button Preset 내보내기 |
| `preset:import` | `IPC_PRESET_IMPORT` | R→M | Button Preset 가져오기 |
| `update:check` | `IPC_UPDATE_CHECK` | R→M | 업데이트 확인 |
| `shell:open-external` | `IPC_SHELL_OPEN_EXTERNAL` | R→M | 외부 URL 열기 |

---

## 7. Main Process Modules (메인 프로세스 모듈)

| Module | File | Description |
|---|---|---|
| **ActionExecutor (액션 실행기)** | `src/main/ActionExecutor.ts` | Action 실행 (launch/keyboard/shell/system/mouse) |
| **ConfigStore (설정 저장소)** | `src/main/ConfigStore.ts` | AppConfig JSON 영속화 및 마이그레이션 |
| **HookManager (훅 관리자)** | `src/main/HookManager.ts` | uiohook-napi 기반 글로벌 입력 감시 (마우스/키보드) |
| **IconStore (아이콘 저장소)** | `src/main/IconStore.ts` | 커스텀/리소스/최근사용 아이콘 관리 |
| **WindowTracker (윈도우 추적기)** | `src/main/WindowTracker.ts` | 활성 윈도우 감지 (App Profile 전환용, Windows only) |
| **TrayManager (트레이 관리자)** | `src/main/TrayManager.ts` | 시스템 트레이 아이콘 및 메뉴 |
| **WindowManager (윈도우 관리자)** | `src/main/WindowManager.ts` | 5개 BrowserWindow 생명주기 관리 |
| **LoginStartup (로그인 시작)** | `src/main/LoginStartup.ts` | OS 로그인 시 자동 시작 토글 |
| **SequenceManager (시퀀스 관리자)** | `src/main/SequenceManager.ts` | Shortcut 액션 시퀀스 실행 엔진 |
| **PopupMenuManager (팝업 메뉴 관리자)** | `src/main/PopupMenuManager.ts` | Popup Menu BrowserWindow 풀 관리 |

### IPC Handler Modules (`src/main/ipc/`)

| File | Description |
|---|---|
| `settingsHandlers.ts` | Config/App/Profile 관련 IPC 핸들러 |
| `appearanceHandlers.ts` | Appearance Editor 관련 IPC 핸들러 |
| `shortcutsHandlers.ts` | Shortcuts Editor 관련 IPC 핸들러 |
| `iconHandlers.ts` | Icon 관련 IPC 핸들러 |
| `updateHandlers.ts` | 업데이트 확인 IPC 핸들러 |

---

## 8. Supplementary Types (보조 타입)

| Type | File | Description |
|---|---|---|
| `CustomIconEntry` | `shared/ipc.types.ts` | 커스텀 아이콘 항목 (id, absPath, name) |
| `ResourceIconEntry` | `shared/ipc.types.ts` | 번들 리소스 아이콘 항목 |
| `PopupMenuItem` | `shared/ipc.types.ts` | 팝업 메뉴 항목 (label, icon, submenu) |
| `SequenceProgress` | `shared/ipc.types.ts` | 시퀀스 진행 상태 (step, total) |
| `ProgressState` | `shared/ipc.types.ts` | 전체 진행 상태 (sequences[]) |
| `RunningProcess` | `shared/ipc.types.ts` | 발견된 실행 중 프로세스 |
| `UpdateStatus` | `shared/ipc.types.ts` | 업데이트 상태 (idle/checking/available/error) |
| `RingShowPayload` | `shared/ipc.types.ts` | ring:show 페이로드 |
| `RingExecutePayload` | `shared/ipc.types.ts` | ring:execute 페이로드 |
| `RingCursorMovePayload` | `shared/ipc.types.ts` | ring:cursor-move 페이로드 |
| `ConfigSavePayload` | `shared/ipc.types.ts` | config:save 페이로드 |
| `AppearanceSlotData` | `shared/ipc.types.ts` | Appearance Editor 초기 데이터 |
| `ShortcutsSlotData` | `shared/ipc.types.ts` | Shortcuts Editor 초기 데이터 |
| `PlayNodeResult` | `shared/ipc.types.ts` | shortcuts:play 실행 결과 |
| `ThemePreference` | `shared/config.types.ts` | 테마 설정 (`'light' \| 'dark' \| 'system'`) |
| `Language` | `shared/config.types.ts` | UI 언어 (`'en' \| 'ko'`) |
| `ModifierKey` | `shared/config.types.ts` | 수정자키 (`'alt' \| 'ctrl' \| 'shift' \| 'meta'`) |
| `ConditionOperator` | `shared/config.types.ts` | 조건 연산자 (eq, neq, gt, lt 등) |
| `CalcOperation` | `shared/config.types.ts` | 수학 연산 (add, sub, mul 등) |
| `MouseButton` | `shared/config.types.ts` | 마우스 버튼 (left, right, middle 등) |

---

## Disambiguation (명칭 구분 주의)

| Ambiguous Term | Context A | Context B |
|---|---|---|
| **AppearanceEditor** | **컴포넌트**: `settings/components/unified/AppearanceEditor.tsx` — Configure Tab 내부 외관 편집 UI | **창**: Appearance Editor Window — 독립 BrowserWindow |
| **Shortcut** | **도메인 개념**: `ShortcutEntry` — Shortcuts Library의 재사용 액션 시퀀스 | **키보드**: 키보드 단축키는 반드시 **Trigger**로 표기 |
| **Profile** | **현재**: `AppProfile` — App Entry 내 프로필 | **레거시**: `Profile` — v6 이전 전체 프로필 (deprecated) |
