# 流程圖設計文件 — Road Bulletin（即時路況留言板）

> 版本：v1.0　｜　撰寫日期：2026-05-14　｜　語言：繁體中文

---

## 1. 使用者流程圖（User Flow）

描述三種角色（主駕駛、副駕駛、一般使用者）進入系統後的完整操作路徑。

```mermaid
flowchart LR
    Start([使用者開啟網頁]) --> Home[首頁 / 留言板\n顯示即時路況留言]

    Home --> RoleChoice{選擇使用模式}

    RoleChoice -->|我是主駕駛| Driver[主駕駛快速回報頁\n/driver]
    RoleChoice -->|我是副駕駛| Passenger[副駕駛互動頁\n/passenger]
    RoleChoice -->|查看歷史| History[留言歷史記錄頁\n/history]

    %% 主駕駛流程
    Driver --> QuickBtn[點擊快速回報按鈕]
    QuickBtn --> Cooldown{是否在冷卻時間內？}
    Cooldown -->|是| BtnDisabled[按鈕變灰，顯示倒數]
    Cooldown -->|否| PostAPI[POST /api/post]
    PostAPI --> SaveDB[(儲存至 SQLite)]
    SaveDB --> Broadcast[SocketIO 廣播給所有用戶]
    Broadcast --> UpdateAll[所有開啟的頁面即時更新留言]

    %% 副駕駛流程
    Passenger --> DanmakuView[觀看彈幕路況資訊流]
    Passenger --> ManualInput[手動輸入自訂留言]
    ManualInput --> Validate{內容驗證\n長度 ≤ 100 字\nXSS 過濾}
    Validate -->|驗證失敗| ErrorMsg[顯示錯誤提示]
    Validate -->|驗證通過| PostAPI

    %% 歷史記錄流程
    History --> FilterChoice{選擇篩選條件}
    FilterChoice -->|全部| ShowAll[顯示近 24 小時留言]
    FilterChoice -->|依類型| FilterResult[篩選：塞車/施工/突發/測速]
    ShowAll --> HistoryList[顯示留言歷史列表]
    FilterResult --> HistoryList

    %% 首頁留言板
    Home --> AutoRefresh[WebSocket 自動接收新留言]
    AutoRefresh --> Home
```

---

## 2. 系統序列圖（Sequence Diagram）

### 2.1 快速回報留言（主駕駛）

描述主駕駛點擊快速按鈕，留言即時廣播給所有在線用戶的完整流程。

```mermaid
sequenceDiagram
    actor Driver as 🚗 主駕駛
    participant Browser as 瀏覽器\n(driver.html)
    participant Flask as Flask Route\n(api.py)
    participant Model as Message Model
    participant DB as SQLite
    participant SocketIO as Flask-SocketIO
    participant Others as 其他在線用戶

    Driver->>Browser: 點擊快速回報按鈕（e.g. 🚗 前方塞車）
    Browser->>Browser: 檢查冷卻時間（localStorage）
    alt 冷卻時間未到
        Browser-->>Driver: 顯示倒數計時，按鈕禁用
    else 可以發送
        Browser->>Flask: POST /api/post\n{content, role, category}
        Flask->>Flask: XSS 過濾 & 長度驗證
        Flask->>Flask: 後端冷卻次數檢查（IP + 時間窗口）
        alt 超過發送限制
            Flask-->>Browser: 429 Too Many Requests
            Browser-->>Driver: 顯示「發送過於頻繁」提示
        else 通過驗證
            Flask->>Model: create_message(content, role, category)
            Model->>DB: INSERT INTO messages
            DB-->>Model: 新增成功，回傳 id
            Model-->>Flask: message 物件
            Flask->>SocketIO: emit('new_message', message)
            SocketIO-->>Browser: broadcast new_message
            SocketIO-->>Others: broadcast new_message
            Browser-->>Driver: 留言板即時更新
            Others-->>Others: 留言板即時更新
        end
    end
```

### 2.2 副駕駛手動輸入留言

```mermaid
sequenceDiagram
    actor Passenger as 👤 副駕駛
    participant Browser as 瀏覽器\n(passenger.html)
    participant Flask as Flask Route\n(api.py)
    participant Model as Message Model
    participant DB as SQLite
    participant SocketIO as Flask-SocketIO

    Passenger->>Browser: 在輸入框填寫自訂路況內容
    Passenger->>Browser: 點擊「送出」按鈕
    Browser->>Browser: 前端驗證（長度 ≤ 100 字）
    alt 驗證失敗
        Browser-->>Passenger: 顯示錯誤訊息
    else 驗證通過
        Browser->>Flask: POST /api/post\n{content, role: "passenger", category}
        Flask->>Model: create_message(...)
        Model->>DB: INSERT INTO messages
        DB-->>Model: 成功
        Model-->>Flask: message 物件
        Flask->>SocketIO: emit('new_message', message)
        SocketIO-->>Browser: 新留言推送
        Browser-->>Passenger: 彈幕動畫顯示新留言
    end
```

### 2.3 查詢留言歷史（一般使用者）

```mermaid
sequenceDiagram
    actor User as 👤 一般使用者
    participant Browser as 瀏覽器\n(history.html)
    participant Flask as Flask Route\n(main.py)
    participant Model as Message Model
    participant DB as SQLite

    User->>Browser: 開啟留言歷史頁 /history
    Browser->>Flask: GET /history?category=all
    Flask->>Model: get_messages(hours=24, category=None)
    Model->>DB: SELECT * FROM messages\nWHERE created_at >= NOW() - 24h\nORDER BY created_at DESC
    DB-->>Model: 留言列表
    Model-->>Flask: messages[]
    Flask-->>Browser: render_template('history.html', messages=messages)
    Browser-->>User: 顯示歷史留言列表

    User->>Browser: 選擇篩選條件（e.g. 塞車）
    Browser->>Flask: GET /history?category=traffic
    Flask->>Model: get_messages(hours=24, category='traffic')
    Model->>DB: SELECT * FROM messages\nWHERE category = 'traffic'\nAND created_at >= NOW() - 24h
    DB-->>Model: 篩選結果
    Model-->>Flask: filtered_messages[]
    Flask-->>Browser: render_template('history.html', messages=filtered_messages)
    Browser-->>User: 顯示篩選後留言列表
```

### 2.4 WebSocket 連線建立（首頁 / 副駕駛頁）

```mermaid
sequenceDiagram
    participant Browser as 瀏覽器
    participant SocketIO as Flask-SocketIO

    Browser->>SocketIO: connect（開啟 WebSocket 連線）
    SocketIO-->>Browser: connected 確認

    Note over Browser,SocketIO: 等待新留言廣播...

    SocketIO-->>Browser: emit('new_message', data)
    Browser->>Browser: 動態新增留言至 DOM
    Browser->>Browser: 觸發彈幕動畫（danmaku.js）

    Browser->>SocketIO: disconnect（離開頁面）
    SocketIO-->>SocketIO: 移除連線
```

---

## 3. 功能清單對照表

| 功能 | 頁面 / 路徑 | HTTP 方法 | 說明 |
|------|------------|-----------|------|
| 瀏覽即時留言板 | `/` | GET | 首頁顯示最新路況留言，WebSocket 自動更新 |
| 主駕駛快速回報 | `/driver` | GET | 一鍵快速回報頁面，顯示預設按鈕 |
| 副駕駛互動頁 | `/passenger` | GET | 手動輸入留言 + 彈幕動畫頁面 |
| 留言歷史記錄 | `/history` | GET | 顯示近 24 小時留言，支援類型篩選 |
| 新增留言 API | `/api/post` | POST | 接收留言內容，儲存 DB 並廣播 |
| 取得留言列表 API | `/api/messages` | GET | 回傳 JSON 格式留言列表（含篩選參數） |

---

## 4. 頁面轉換關係

```mermaid
flowchart TD
    Index["🏠 首頁 /\n（即時留言板）"]
    Driver["🚗 主駕駛頁 /driver\n（快速回報）"]
    Passenger["👤 副駕駛頁 /passenger\n（彈幕 + 手動輸入）"]
    History["📋 歷史記錄頁 /history\n（查詢 + 篩選）"]

    Index <-->|導覽列切換| Driver
    Index <-->|導覽列切換| Passenger
    Index <-->|導覽列切換| History
    Driver <-->|導覽列切換| Passenger
    Driver <-->|導覽列切換| History
    Passenger <-->|導覽列切換| History
```

---

*本文件由 Antigravity AI Agent 協助產出，請團隊共同審閱並補充細節。*
