# FLOWCHART — 即時路況留言板（Road Bulletin）

> 版本：v1.0　｜　建立日期：2026-05-17　｜　語言：繁體中文

---

## 1. 使用者流程圖（User Flow）

描述三種使用者角色（主駕駛、副駕駛、一般使用者）進入系統後的完整操作路徑。

```mermaid
flowchart LR
    Start([使用者開啟網頁]) --> Home[首頁 留言板 /]

    Home --> Who{我是誰？}

    %% 主駕駛路徑
    Who -->|主駕駛| Driver[前往主駕駛頁 /driver]
    Driver --> QuickBtn[點擊快速回報按鈕]
    QuickBtn --> Cooldown{60秒內是否已<br/>發送 3 則？}
    Cooldown -->|否| SendQuick[送出預設路況訊息]
    Cooldown -->|是| Block[顯示冷卻提示<br/>請稍後再試]
    Block --> Driver
    SendQuick --> Broadcast1[所有人即時收到留言]
    Broadcast1 --> Driver

    %% 副駕駛路徑
    Who -->|副駕駛| Passenger[前往副駕駛頁 /passenger]
    Passenger --> DanmakuView[觀看彈幕留言滾動]
    Passenger --> TypeMsg[手動輸入留言]
    TypeMsg --> LenCheck{留言是否超過 100 字？}
    LenCheck -->|是| LenWarn[顯示字數超限警告]
    LenWarn --> TypeMsg
    LenCheck -->|否| SendManual[送出留言]
    SendManual --> Broadcast2[所有人即時收到留言]
    Broadcast2 --> Passenger

    %% 一般使用者路徑
    Who -->|一般使用者| Home
    Home --> FilterCheck{要篩選留言類型？}
    FilterCheck -->|是| Filter[選擇過濾條件<br/>塞車/施工/突發/測速]
    Filter --> FilterResult[顯示篩選後留言]
    FilterCheck -->|否| ViewAll[瀏覽所有即時留言]

    Home --> HistoryLink[前往留言歷史頁 /history]
    HistoryLink --> HistoryView[查詢過去路況留言記錄]
    HistoryView --> TimeFilter[依時間範圍篩選]
    TimeFilter --> HistoryResult[顯示歷史留言列表]
```

---

## 2. 系統序列圖（System Sequence Diagram）

### 2.1 快速回報按鈕發送流程（主駕駛）

```mermaid
sequenceDiagram
    actor Driver as 主駕駛
    participant Browser as 瀏覽器
    participant JS as Socket.IO Client JS
    participant Flask as Flask-SocketIO Server
    participant Model as Message Model
    participant DB as SQLite

    Driver->>Browser: 點擊快速回報按鈕（例：🚗 前方塞車）
    Browser->>JS: 檢查冷卻時間（cooldown.js）
    alt 冷卻中（60秒內已發3則）
        JS->>Browser: 顯示「請稍後再試」提示
    else 可以發送
        JS->>Flask: emit('new_message', {content, role:'driver', type:'traffic'})
        Flask->>Model: 呼叫 Message.create(content, role, type)
        Model->>DB: INSERT INTO messages (content, role, type, created_at)
        DB-->>Model: 回傳新資料列 id
        Model-->>Flask: 回傳 Message 物件
        Flask->>JS: broadcast emit('receive_message', {id, content, role, type, created_at})
        JS->>Browser: 動態插入留言到留言板 DOM
        JS->>Browser: 觸發彈幕動畫（danmaku.js）
    end
```

---

### 2.2 副駕駛手動輸入留言流程

```mermaid
sequenceDiagram
    actor Passenger as 副駕駛
    participant Browser as 瀏覽器
    participant JS as Socket.IO Client JS
    participant Flask as Flask-SocketIO Server
    participant Model as Message Model
    participant DB as SQLite

    Passenger->>Browser: 在文字框輸入留言並點擊送出
    Browser->>JS: 取得輸入內容，驗證字數 ≤ 100
    alt 超過 100 字
        JS->>Browser: 顯示「留言超過字數限制」警告
    else 符合限制
        JS->>Flask: emit('new_message', {content, role:'passenger', type})
        Flask->>Model: 呼叫 Message.create(...)
        Model->>DB: INSERT INTO messages (...)
        DB-->>Model: 成功
        Model-->>Flask: Message 物件
        Flask->>JS: broadcast emit('receive_message', {...})
        JS->>Browser: 插入新留言到留言串
        JS->>Browser: 觸發彈幕文字滾動動畫
    end
```

---

### 2.3 一般使用者查詢留言歷史流程

```mermaid
sequenceDiagram
    actor User as 一般使用者
    participant Browser as 瀏覽器
    participant Flask as Flask Route
    participant Model as Message Model
    participant DB as SQLite

    User->>Browser: 點擊「留言歷史」連結
    Browser->>Flask: GET /history?type=traffic（可選過濾參數）
    Flask->>Model: 呼叫 Message.get_history(type, hours=24)
    Model->>DB: SELECT * FROM messages WHERE created_at >= NOW()-24h AND type=?
    DB-->>Model: 回傳留言列表
    Model-->>Flask: List[Message]
    Flask->>Browser: render_template('history.html', messages=messages)
    Browser->>User: 顯示留言歷史記錄頁面
```

---

### 2.4 首頁即時留言板載入流程

```mermaid
sequenceDiagram
    actor User as 使用者
    participant Browser as 瀏覽器
    participant Flask as Flask Route
    participant Model as Message Model
    participant DB as SQLite
    participant WS as Flask-SocketIO Server

    User->>Browser: 開啟首頁 /
    Browser->>Flask: GET /
    Flask->>Model: 呼叫 Message.get_recent(limit=50)
    Model->>DB: SELECT * FROM messages ORDER BY created_at DESC LIMIT 50
    DB-->>Model: 最新 50 則留言
    Model-->>Flask: List[Message]
    Flask->>Browser: render_template('index.html', messages=messages)
    Browser->>User: 顯示初始留言列表

    Note over Browser, WS: 頁面載入後建立 WebSocket 連線
    Browser->>WS: Socket.IO connect
    WS-->>Browser: 連線成功確認

    Note over User, Browser: 其他使用者發送新留言時
    WS->>Browser: emit('receive_message', {...})
    Browser->>User: 即時插入新留言，無需重整頁面
```

---

## 3. 功能清單對照表

| 功能名稱 | URL 路徑 | HTTP 方法 / WS 事件 | 對應角色 | 說明 |
|----------|----------|----------------------|----------|------|
| 首頁留言板 | `/` | `GET` | 全體使用者 | 顯示最新即時路況留言 |
| 主駕駛快速回報頁 | `/driver` | `GET` | 主駕駛 | 一鍵快速回報按鈕介面 |
| 副駕駛互動頁 | `/passenger` | `GET` | 副駕駛 | 手動輸入留言 + 彈幕顯示 |
| 留言歷史頁 | `/history` | `GET` | 一般使用者 | 查詢過去路況留言記錄 |
| 新增留言 API | `/api/post` | `POST` | 全體使用者 | REST API 方式新增留言 |
| 取得留言列表 API | `/api/messages` | `GET` | 全體使用者 | 取得最新留言列表（JSON） |
| 發送留言（即時） | — | `WS emit: new_message` | 全體使用者 | WebSocket 方式發送留言 |
| 接收留言（即時） | — | `WS emit: receive_message` | 全體使用者 | 伺服器廣播新留言給所有客戶端 |

---

## 4. 角色權限對照

| 功能 | 主駕駛 | 副駕駛 | 一般使用者 |
|------|:------:|:------:|:----------:|
| 瀏覽即時留言板 | ✅ | ✅ | ✅ |
| 一鍵快速回報 | ✅ | ❌ | ❌ |
| 手動輸入留言 | ❌ | ✅ | ❌ |
| 彈幕留言顯示 | ❌ | ✅ | ❌ |
| 查詢歷史留言 | ✅ | ✅ | ✅ |
| 留言類型過濾 | ✅ | ✅ | ✅ |

---

*本文件由 Antigravity AI Agent 根據 PRD.md 與 ARCHITECTURE.md 自動產出，請團隊共同審閱並補充細節。*
