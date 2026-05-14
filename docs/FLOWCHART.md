# 流程圖設計文件 — Road Bulletin（即時路況留言板）

> 版本：v1.1　｜　更新日期：2026-05-14　｜　語言：繁體中文

---

## 1. 使用者流程圖（User Flow）

所有操作在單一頁面內完成，不涉及頁面切換。

```mermaid
flowchart LR
    Start([使用者開啟網頁]) --> Load["載入單一頁面 /\n左側導航畫面 + 右側留言板"]
    Load --> WSConnect["建立 WebSocket 連線\n開始接收即時留言"]

    WSConnect --> View["瀏覽即時留言板\n（右側）"]
    WSConnect --> DanmakuPlay["彈幕自動滾動\n（左側導航畫面）"]

    View --> ManualInput["副駕駛手動輸入留言"]
    ManualInput --> Validate{內容驗證\n長度 ≤ 100 字}
    Validate -->|失敗| ErrorMsg["顯示錯誤提示"]
    Validate -->|通過| EmitMsg["emit post_message\n→ 廣播給所有用戶"]
    EmitMsg --> UpdateAll["所有用戶留言板 + 彈幕同步更新"]

    DanmakuPlay --> QuickBtn["主駕駛點擊\n主選單按鈕 ◉"]
    QuickBtn --> MenuOpen["展開選項面板"]
    MenuOpen --> SpeedSelect["選擇速度燈號\n🔴 / 🟡 / 🟢"]
    MenuOpen --> AccidentBtn["點擊 🚗💥 前方車禍"]
    MenuOpen --> DebrisBtn["點擊 📦⚠️ 前方掉落物"]

    SpeedSelect --> CooldownCheck{冷卻時間\n檢查}
    AccidentBtn --> CooldownCheck
    DebrisBtn --> CooldownCheck

    CooldownCheck -->|冷卻中| BtnDisabled["按鈕禁用\n顯示倒數計時"]
    CooldownCheck -->|可發送| EmitMsg

    QuickBtn --> PinnedSlot["直接點擊釘選格\n📌 📌 📌"]
    PinnedSlot --> CooldownCheck

    MenuOpen --> LongPress["長按選項\n設定釘選"]
    LongPress --> SavePinned["儲存至 localStorage"]
    SavePinned --> PinnedSlot
```

---

## 2. 系統序列圖（Sequence Diagram）

### 2.1 主駕駛快速回報（主選單按鈕）

```mermaid
sequenceDiagram
    actor Driver as 🚗 主駕駛
    participant Browser as 瀏覽器（index.html）
    participant Flask as Flask-SocketIO（api.py）
    participant Model as Message Model
    participant DB as SQLite
    participant Others as 其他在線用戶

    Driver->>Browser: 點擊 ◉ 主選單按鈕
    Browser->>Browser: quickbtn.js 展開選項面板

    Driver->>Browser: 點擊選項（e.g. 🔴 車速 < 30）
    Browser->>Browser: speed.js 確認選擇
    Browser->>Browser: cooldown.js 檢查 localStorage 冷卻狀態

    alt 冷卻時間未到
        Browser-->>Driver: 按鈕禁用，顯示倒數秒數
    else 可以發送
        Browser->>Flask: emit('post_message', {content, category, speed_level})
        Flask->>Flask: XSS 過濾 & 長度驗證
        Flask->>Flask: 後端 IP 冷卻次數檢查
        alt 超過頻率限制
            Flask-->>Browser: error 事件（發送過於頻繁）
        else 通過驗證
            Flask->>Model: create_message(content, category, speed_level)
            Model->>DB: INSERT INTO messages
            DB-->>Model: 新增成功，回傳 id
            Model-->>Flask: message 物件
            Flask->>Browser: broadcast('new_message', message)
            Flask->>Others: broadcast('new_message', message)
            Browser->>Browser: 更新留言板 DOM
            Browser->>Browser: danmaku.js 觸發彈幕動畫
            Others->>Others: 更新留言板 DOM + 彈幕
        end
    end
```

### 2.2 副駕駛手動輸入留言

```mermaid
sequenceDiagram
    actor Passenger as 👤 副駕駛
    participant Browser as 瀏覽器（index.html）
    participant Flask as Flask-SocketIO（api.py）
    participant Model as Message Model
    participant DB as SQLite

    Passenger->>Browser: 在右側留言板輸入框填寫內容
    Passenger->>Browser: 點擊「送出」或按 Enter
    Browser->>Browser: 前端驗證（長度 ≤ 100 字、非空白）

    alt 驗證失敗
        Browser-->>Passenger: 輸入框紅框 + 錯誤提示文字
    else 驗證通過
        Browser->>Flask: emit('post_message', {content, category: 'other'})
        Flask->>Model: create_message(content, 'other', null)
        Model->>DB: INSERT INTO messages
        DB-->>Model: 成功
        Model-->>Flask: message 物件
        Flask->>Browser: broadcast('new_message', message)
        Browser->>Browser: 留言板新增訊息（動畫滑入）
        Browser->>Browser: danmaku.js 觸發彈幕
        Browser-->>Passenger: 輸入框清空，可繼續輸入
    end
```

### 2.3 釘選按鈕設定流程

```mermaid
sequenceDiagram
    actor Driver as 🚗 主駕駛
    participant Browser as 瀏覽器（index.html）
    participant LS as localStorage

    Driver->>Browser: 展開主選單
    Driver->>Browser: 長按某個選項（e.g. 🔴 紅燈）

    Browser->>Browser: pinned.js 顯示「釘選至第幾格？」提示
    Driver->>Browser: 選擇釘選格位（1 / 2 / 3）

    Browser->>LS: 寫入 pinnedBtn[slot] = {icon, content, category}
    LS-->>Browser: 儲存成功
    Browser->>Browser: 更新釘選格按鈕顯示
    Browser-->>Driver: 釘選格顯示對應圖示

    Note over Driver,Browser: 之後可直接點擊釘選格快速發送，無需展開主選單
```

### 2.4 WebSocket 連線建立

```mermaid
sequenceDiagram
    participant Browser as 瀏覽器
    participant SocketIO as Flask-SocketIO

    Browser->>SocketIO: connect（頁面載入時自動建立）
    SocketIO-->>Browser: connected 確認
    Browser->>SocketIO: emit('request_history')
    SocketIO-->>Browser: 回傳最近 N 則留言（初始化留言板）

    loop 有新留言時
        SocketIO-->>Browser: emit('new_message', data)
        Browser->>Browser: 更新留言板 DOM
        Browser->>Browser: danmaku.js 產生新彈幕
    end

    Browser->>SocketIO: disconnect（離開頁面時）
```

---

## 3. 功能清單對照表

| 功能 | 路徑 | HTTP 方法 / 事件 | 說明 |
|------|------|-----------------|------|
| 載入主頁面 | `/` | GET | 唯一頁面，含導航 + 留言板 + 快速按鈕 |
| 新增留言 | `/api/post` | POST | REST 備用端點（主要走 SocketIO） |
| 取得留言列表 | `/api/messages` | GET | 回傳 JSON，支援 `?category=` 篩選 |
| 取得釘選設定 | `/api/pinned` | GET | 回傳使用者釘選按鈕設定 |
| 更新釘選設定 | `/api/pinned` | POST | 更新釘選按鈕配置 |
| 發送留言 | `post_message` | SocketIO emit | 用戶發送留言觸發廣播 |
| 接收留言 | `new_message` | SocketIO broadcast | 伺服器推播新留言給所有用戶 |
| 請求歷史 | `request_history` | SocketIO emit | 頁面載入時取得初始留言 |

---

## 4. 單頁元件狀態流

```mermaid
flowchart TD
    PageLoad["頁面載入"] --> InitSocket["socket.js\n建立 WebSocket"]
    PageLoad --> InitDanmaku["danmaku.js\n初始化彈幕層"]
    PageLoad --> InitQuickBtn["quickbtn.js\n綁定快速按鈕事件"]
    PageLoad --> InitPinned["pinned.js\n從 localStorage 讀取釘選"]

    InitSocket --> ReceiveMsg["接收 new_message"]
    ReceiveMsg --> UpdateBoard["更新留言板"]
    ReceiveMsg --> FireDanmaku["發射彈幕動畫"]

    InitQuickBtn --> MenuToggle["主選單展開 / 收合"]
    MenuToggle --> SelectOption["選擇路況選項"]
    SelectOption --> SendMsg["發送留言（emit）"]

    InitPinned --> ShowPinned["顯示釘選格按鈕"]
    ShowPinned --> PinnedClick["點擊釘選格"]
    PinnedClick --> SendMsg
```

---

*本文件由 Antigravity AI Agent 協助產出，請團隊共同審閱並補充細節。*
