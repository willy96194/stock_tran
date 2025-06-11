# 股票模擬交易系統

這是一套使用 Node.js + Express + SQL Server 實作的前後端分離股票交易模擬平台，支援基本下單、撮合、資金變動與持股查詢功能。

---

## 🚀 快速啟動

```bash
git clone https://github.com/willy96194/stock_tran.git
cd stock_tran
```

### 📦 安裝依賴套件

```bash
npm install
```

## 🏗 建立資料庫

請使用 Microsoft SQL Server，並依照以下步驟建立資料庫與資料表：

### ✅ 1. 建立資料庫與資料表

使用 SSMS 或 Azure Data Studio 開啟並執行 `init.sql` 檔案，該腳本將自動建立：

- 使用者資訊表 `userInfo`
- 股票資訊表 `stockInfo`
- 使用者持股表 `userStock`
- 委託單表 `stockOrder`
- 成交紀錄表 `stockRecord`
- 價格紀錄表 `stockPriceLog`

同時也會建立初始測試資料（使用者、股票、價格、持股）。

### ✅ 2. 確認資料庫連線設定

請在 `server.js` 中確認資料庫連線資訊設定正確：

```js
const config = {
  user: "你的帳號",
  password: "你的密碼",
  server: "localhost",
  database: "stock_tran",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};
```

### ▶️ 啟動後端伺服器

```bash
node server.js
```

---

## 📋 功能清單

- 🔍 股票查詢（代碼或名稱）
- 📥 模擬下單（買單、賣單）
- 🔁 自動撮合邏輯
- 💰 使用者資金扣款與持股更新
- 📈 歷史價格紀錄（stockPriceLog）
- 📊 即時查詢持股與委託單

---

## 📌 注意事項

- 使用者與股票資料需自行匯入資料庫
- 請先建立 `stock_tran` 資料庫並匯入資料表
- 系統使用本地端 SQL Server（可依需求改為遠端）

---

## 🛠 技術架構

- Node.js / Express
- Microsoft SQL Server（mssql 套件）
- 原生 HTML + JS 前端頁面

---

## 📫 聯絡作者

作者：Wei Willy  
GitHub：https://github.com/willy96194
