
-- 建立資料庫
CREATE DATABASE stock_tran;
GO

USE stock_tran;
GO

-- 建立使用者資訊表
CREATE TABLE userInfo (
    uid INT PRIMARY KEY,
    name NVARCHAR(50),
    account NVARCHAR(50),
    password NVARCHAR(50),
    funds INT
);

-- 建立股票資訊表
CREATE TABLE stockInfo (
    stockid VARCHAR(10) PRIMARY KEY,
    stockName NVARCHAR(100),
    totalShares BIGINT,
    availableShares BIGINT
);

-- 建立使用者持股表
CREATE TABLE userStock (
    stockid VARCHAR(10),
    uid INT,
    stockAmount INT,
    cost INT,
    PRIMARY KEY (stockid, uid),
    FOREIGN KEY (stockid) REFERENCES stockInfo(stockid),
    FOREIGN KEY (uid) REFERENCES userInfo(uid)
);

-- 建立委託單表
CREATE TABLE stockOrder (
    id INT IDENTITY(1,1) PRIMARY KEY,
    uid INT,
    stockid VARCHAR(10),
    type NVARCHAR(10),
    price INT,
    amount INT,
    status NVARCHAR(20),
    createdAt DATETIME,
    FOREIGN KEY (uid) REFERENCES userInfo(uid),
    FOREIGN KEY (stockid) REFERENCES stockInfo(stockid)
);

-- 建立成交紀錄表
CREATE TABLE stockRecord (
    id INT IDENTITY(1,1) PRIMARY KEY,
    uid INT,
    stockid VARCHAR(10),
    amount INT,
    price INT,
    type NVARCHAR(10),
    recordedAt DATETIME,
    totalCost INT,
    FOREIGN KEY (uid) REFERENCES userInfo(uid),
    FOREIGN KEY (stockid) REFERENCES stockInfo(stockid)
);

-- 建立價格紀錄表
CREATE TABLE stockPriceLog (
    id INT IDENTITY(1,1) PRIMARY KEY,
    stockid VARCHAR(10),
    price INT,
    recordedAt DATETIME,
    FOREIGN KEY (stockid) REFERENCES stockInfo(stockid)
);

-- 初始使用者資料
INSERT INTO userInfo (uid, name, account, password, funds)
VALUES
(1, N'Willy', 'testuser', '1234', 7500000),
(2, N'圭棠', 'testuser2', '5678', 2100000);

-- 初始股票資料
INSERT INTO stockInfo (stockid, stockName, totalShares, availableShares)
VALUES
('1101', N'台泥', 3600000000, 3600000000),
('1216', N'統一', 640000000, 640000000),
('1301', N'台塑', 760000000, 760000000),
('1303', N'南亞', 780000000, 780000000),
('1402', N'遠東新', 360000000, 360000000),
('2002', N'中鋼', 1580000000, 1580000000),
('2201', N'裕隆', 144000000, 144000000),
('2303', N'聯電', 1550000000, 1550000000),
('2317', N'鴻海', 1390000000, 1390000000),
('2330', N'台積電', 25930000000, 25930000000),
('2408', N'南亞科', 220000000, 220000000),
('2412', N'中華電', 133000000, 133000000),
('2603', N'長榮', 210000000, 210000000),
('2609', N'陽明', 140000000, 140000000),
('2615', N'萬海', 79000000, 79000000),
('2881', N'富邦金', 1030000000, 1030000000),
('2882', N'國泰金', 1340000000, 1340000000),
('3008', N'大立光', 67000000, 67000000),
('3045', N'台灣大', 280000000, 280000000),
('5871', N'中租-KY', 170000000, 170000000);

-- 初始價格紀錄
INSERT INTO stockPriceLog (stockid, price, recordedAt)
VALUES
('1101', 55, GETDATE()), ('1216', 85, GETDATE()), ('1301', 90, GETDATE()), ('1303', 95, GETDATE()),
('1402', 65, GETDATE()), ('2002', 32, GETDATE()), ('2201', 105, GETDATE()), ('2303', 60, GETDATE()),
('2317', 110, GETDATE()), ('2330', 600, GETDATE()), ('2408', 80, GETDATE()), ('2412', 110, GETDATE()),
('2603', 125, GETDATE()), ('2609', 110, GETDATE()), ('2615', 205, GETDATE()), ('2881', 75, GETDATE()),
('2882', 90, GETDATE()), ('3008', 275, GETDATE()), ('3045', 108, GETDATE()), ('5871', 120, GETDATE());

-- 初始持股
INSERT INTO userStock (stockid, uid, stockAmount, cost)
VALUES ('2330', 1, 5000, 620);
