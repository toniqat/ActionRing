# ActionRing MCP Server Setup Guide

ActionRing MCP Server를 사용하면 Claude, ChatGPT 등 MCP를 지원하는 AI가 ActionRing의 모든 기능에 접근할 수 있습니다.
AI가 직접 Shortcut을 생성하고, 액션 시퀀스를 설계하고, 즉시 실행할 수 있습니다.

---

## 사전 요구사항

- **ActionRing** 앱이 실행 중이어야 합니다

---

## 1. AI 클라이언트 설정

### Claude Desktop

`claude_desktop_config.json` 파일을 편집합니다.

- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "actionring": {
      "command": "node",
      "args": ["<ActionRing 설치 경로>/mcp-server/dist/index.js"]
    }
  }
}
```

> `args`의 경로를 실제 ActionRing 설치 경로로 변경하세요.

설정 후 Claude Desktop을 재시작하면 연결됩니다.

### Claude Code (CLI)

프로젝트 내 `.claude/settings.local.json` 또는 전역 설정에 추가합니다:

```json
{
  "mcpServers": {
    "actionring": {
      "command": "node",
      "args": ["<ActionRing 설치 경로>/mcp-server/dist/index.js"]
    }
  }
}
```

### 기타 MCP 클라이언트

stdio transport를 지원하는 모든 MCP 클라이언트에서 사용할 수 있습니다.
실행 명령:

```
node <ActionRing 설치 경로>/mcp-server/dist/index.js
```

---

## 2. 연결 확인

1. **ActionRing 실행** — 앱이 시작되면 자동으로 MCP 연결이 준비됩니다
2. **AI 클라이언트 시작** — Claude Desktop이나 Claude Code를 실행합니다
3. **테스트** — AI에게 다음과 같이 요청해 봅니다:
   - *"ActionRing 상태를 확인해줘"* → `get_status` 호출
   - *"현재 등록된 Shortcut 목록을 보여줘"* → `list_shortcuts` 호출

---

## 3. 사용 가능한 MCP Tools

### 시스템

| Tool | 설명 |
|---|---|
| `get_status` | ActionRing 상태 조회 (활성화 여부, 트리거, 테마, 언어) |
| `toggle_enabled` | ActionRing 활성화/비활성화 토글 |

### 설정

| Tool | 설명 |
|---|---|
| `get_config` | 전체 설정 조회 |
| `save_config` | 전체 설정 저장 (주의: 전체 교체) |
| `reset_config` | 공장 초기화 |

### Shortcuts 라이브러리

| Tool | 설명 |
|---|---|
| `list_shortcuts` | 모든 Shortcut 목록 조회 |
| `get_shortcut` | ID로 특정 Shortcut 조회 |
| `create_shortcut` | 새 Shortcut 생성 (이름 + 액션 시퀀스) |
| `update_shortcut` | 기존 Shortcut 수정 (액션, 이름, 아이콘, 색상) |
| `delete_shortcut` | Shortcut 삭제 |
| `execute_shortcut` | ID로 Shortcut 즉시 실행 |

### Shortcut 그룹

| Tool | 설명 |
|---|---|
| `list_shortcut_groups` | 그룹 목록 조회 |
| `create_shortcut_group` | 새 그룹 생성 |
| `delete_shortcut_group` | 그룹 삭제 (소속 Shortcut은 그룹 해제됨) |

### 앱 관리

| Tool | 설명 |
|---|---|
| `list_apps` | 등록된 앱 목록 조회 |
| `add_app` | 새 앱 등록 (앱별 링 설정용) |
| `remove_app` | 앱 제거 (`default`는 삭제 불가) |

### 프로필 관리

| Tool | 설명 |
|---|---|
| `list_profiles` | 앱의 프로필 목록 조회 |
| `add_profile` | 새 프로필 추가 |
| `remove_profile` | 프로필 제거 (마지막 1개는 삭제 불가) |
| `rename_profile` | 프로필 이름 변경 |
| `set_active_profile` | 활성 프로필 설정 |

### 슬롯 (링 버튼)

| Tool | 설명 |
|---|---|
| `get_slots` | 특정 프로필의 링 버튼 슬롯 조회 |
| `update_slots` | 슬롯 전체 교체 (버튼 배치, Shortcut 할당, 외형 변경) |

### 액션 실행

| Tool | 설명 |
|---|---|
| `execute_actions` | 액션 배열을 직접 실행 (Shortcut 저장 없이 테스트) |
| `get_action_types` | 사용 가능한 모든 액션 타입과 필드 문서 조회 |

---

## 4. 사용 예시

### AI에게 Shortcut 만들기 요청

> "크롬을 열고 3초 후에 Ctrl+T로 새 탭을 여는 Shortcut을 만들어줘"

AI가 자동으로:
1. `get_action_types`로 액션 스키마 확인
2. `create_shortcut`으로 다음 시퀀스 생성:
   ```json
   [
     { "type": "launch", "target": "chrome.exe" },
     { "type": "wait", "ms": 3000 },
     { "type": "keyboard", "keys": "Ctrl+T" }
   ]
   ```

### AI에게 기존 Shortcut 수정 요청

> "Volume Up shortcut에 토스트 알림을 추가해줘"

AI가 자동으로:
1. `list_shortcuts`로 기존 목록 확인
2. `get_shortcut`으로 해당 Shortcut 조회
3. `update_shortcut`으로 액션에 `{ "type": "toast", "message": "Volume Up!" }` 추가

### AI에게 직접 실행 요청

> "지금 바로 스크린샷 찍어줘"

AI가 `execute_actions`로 즉시 실행:
```json
[{ "type": "system", "action": "screenshot" }]
```

---

## 5. 문제 해결

| 증상 | 해결 |
|---|---|
| "port file not found" 에러 | ActionRing이 실행 중인지 확인 |
| "Cannot connect to ActionRing" | ActionRing을 재시작한 후 다시 시도 |
| Claude에서 tool이 보이지 않음 | 설정 파일의 경로가 정확한지 확인 후 Claude Desktop 재시작 |
