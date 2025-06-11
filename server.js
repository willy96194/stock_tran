const path = require("path");

const express = require("express");
const sql = require("mssql");
const cors = require("cors");

const app = express();
const port = 3000;

const dbConfig = {
    user: 'sa',
    password: 'P@ssw0rd',
    server: 'localhost',
    database: 'stock_tran',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

//查詢使用者持股
app.get("/api/users/:uid/holdings", async (req, res) => {
    try {
        await sql.connect(dbConfig);
        const request = new sql.Request();
        request.input("uid", sql.Int, req.params.uid);

        const result = await request.query(`
            SELECT us.stockid, si.stockName, us.stockAmount, us.cost,
            ISNULL(sp.price, 0) AS currentPrice
            FROM userStock us
            JOIN stockInfo si ON us.stockid = si.stockid
            LEFT JOIN (
                SELECT stockid, MAX(recordedAt) AS maxTime
                FROM stockPriceLog GROUP BY stockid
            ) AS latest ON us.stockid = latest.stockid
            LEFT JOIN stockPriceLog sp ON sp.stockid = latest.stockid AND sp.recordedAt = latest.maxTime
            WHERE us.uid = @uid;
        `);

        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "持股查詢失敗", error: err });
    }
});

//查詢使用者委託單
app.get("/api/users/:uid/orders", async (req, res) => {
    try {
        await sql.connect(dbConfig);
        const request = new sql.Request();
        request.input("uid", sql.Int, req.params.uid);

        const result = await request.query(`
            SELECT o.id, o.stockid, si.stockName, o.price, o.amount, o.status
            FROM stockOrder o
            JOIN stockInfo si ON o.stockid = si.stockid
            WHERE o.uid = @uid
            ORDER BY o.createdAt DESC;
        `);

        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "委託單查詢失敗", error: err });
    }
});


app.get("/api/users/:uid", async (req, res) => {
    try {
        await sql.connect(dbConfig);
        const request = new sql.Request();
        request.input("uid", sql.Int, req.params.uid);
        const result = await request.query(`
            SELECT uid, name, funds FROM userInfo WHERE uid = @uid;
        `);
        if (result.recordset.length === 0) {
            return res.status(404).json({ message: "找不到使用者" });
        }
        res.json(result.recordset[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "使用者查詢失敗" });
    }
});


app.get("/api/stocks/search", async (req, res) => {
    try {
        const query = req.query.query;

        await sql.connect(dbConfig);
        const request = new sql.Request();
        request.input("input", sql.NVarChar(50), query);


        const result = await request.query(`
            SELECT TOP 1 si.stockid, si.stockName, sp.price
            FROM stockInfo si
            LEFT JOIN stockPriceLog sp ON si.stockid = sp.stockid
            WHERE si.stockid = @input OR si.stockName LIKE '%' + @input + '%'
            ORDER BY sp.recordedAt DESC`
        );

        res.json(result.recordset[0] || {});
    } catch (err) {
        console.error(err);
        res.status(500).send("查詢錯誤");
    }
});

app.post("/api/orders", async (req, res) => {
    try {
        const { uid, stockid, type, price, amount } = req.body;

        if (!uid || !stockid || !type || !price || !amount) {
            return res.status(400).json({ message: "缺少必要欄位" });
        }

        await sql.connect(dbConfig);

        if (type === "sell") {
            const checkHolding = new sql.Request();
            checkHolding.input("uid", sql.Int, uid);
            checkHolding.input("stockid", sql.VarChar(10), stockid);
            const result = await checkHolding.query(`
                SELECT stockAmount FROM userStock
                WHERE uid = @uid AND stockid = @stockid;
            `);

            const owned = result.recordset[0]?.stockAmount || 0;

            if (owned < amount) {
                return res.status(400).json({
                    message: `持股不足：目前只有 ${owned} 股，無法賣出 ${amount} 股`
                });
            }
        }

        const request = new sql.Request();
        request.input("uid", sql.Int, uid);
        request.input("stockid", sql.VarChar(10), stockid);
        request.input("type", sql.VarChar(4), type);
        request.input("price", sql.Int, price);
        request.input("amount", sql.Int, amount);

        await request.query(`
            INSERT INTO stockOrder(uid, stockid, type, price, amount, status, createdAt)
            VALUES (@uid, @stockid, @type, @price, @amount,'open', GETDATE());
        `);

        if (type === "sell") {
            const updatePriceLog = new sql.Request();
            updatePriceLog.input("stockid", sql.VarChar(10), stockid);
            updatePriceLog.input("price", sql.Int, price);
            await updatePriceLog.query(`
        INSERT INTO stockPriceLog (stockid, price, recordedAt)
        VALUES (@stockid, @price, GETDATE());
    `);
        }

        while (await matchOrder(stockid)) {
            console.log("撮合成功一次");
        }

        res.json({ message: "掛單成功，自動撮合完成（如有）" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "掛單失敗", error: err });
    }
});


// app.post("/api/match", async (req, res) => {
//     try {
//         const { stockid } = req.body;
//         if (!stockid) return res.status(400).json({ message: "缺少股票代碼" });

//         await sql.connect(dbConfig);
//         const request = new sql.Request();
//         request.input("stockid", sql.VarChar(10), stockid);

//         const buyOrders = await request.query(`
//             SELECT TOP 1 * FROM stockOrder
//             WHERE stockid = @stockid AND type = 'buy' AND status = 'open'
//             ORDER BY price DESC, createdAt ASC
//         `);
//         const sellOrders = await request.query(`
//             SELECT TOP 1 * FROM stockOrder
//             WHERE stockid = @stockid AND type = 'sell' AND status = 'open'
//             ORDER BY price ASC, createdAt ASC
//         `);

//         const buy = buyOrders.recordset[0];
//         const sell = sellOrders.recordset[0];

//         if (!buy || !sell || buy.price < sell.price) {
//             return res.json({ message: "目前無可成交的訂單" });
//         }

//         const matchAmount = Math.min(buy.amount, sell.amount);
//         const finalPrice = sell.price;

//         const updateRequest = new sql.Request();
//         updateRequest.input("buyId", sql.Int, buy.id);
//         updateRequest.input("sellId", sql.Int, sell.id);
//         updateRequest.input("amount", sql.Int, matchAmount);

//         await updateRequest.query(`
//             UPDATE stockOrder SET amount = amount - @amount, status = CASE WHEN amount - @amount = 0 THEN 'matched' ELSE 'open' END
//             WHERE id IN (@buyId,@sellId);
//             `);

//         const recordBuy = new sql.Request();
//         recordBuy.input("uid", sql.Int, buy.uid);
//         recordBuy.input("stockid", sql.VarChar(10), stockid);
//         recordBuy.input("amount", sql.Int, matchAmount);
//         recordBuy.input("price", sql.Int, finalPrice);
//         recordBuy.input("type", sql.VarChar(4), 'buy');

//         await recordBuy.query(`
//             INSERT INTO stockRecord(uid,stockid,amount,price,type)
//             VALUES (@uid,@stockid,@amount,@price,@type);
//             `);

//         const recordSell = new sql.Request();
//         recordSell.input("uid", sql.Int, sell.uid);
//         recordSell.input("stockid", sql.VarChar(10), stockid);
//         recordSell.input("amount", sql.Int, matchAmount);
//         recordSell.input("price", sql.Int, finalPrice);
//         recordSell.input("type", sql.VarChar(4), 'sell');

//         await recordSell.query(`
//             INSERT INTO stockRecord (uid, stockid, amount, price, type)
//             VALUES (@uid, @stockid, @amount, @price, @type);
//             `);


//         return res.json({ 
//             message: "成交成功",
//             buyId: buy.id,
//             sellId: sell.id,
//             amount: matchAmount,
//             price: finalPrice
//         });
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({
//             message: "交易失敗",
//             error: {
//                 name: err.name,
//                 message: err.message,
//                 stack: err.stack,
//                 code: err.code
//             }
//         });
//     }
// });

async function matchOrder(stockid) {
    const request = new sql.Request();
    request.input("stockid", sql.VarChar(10), stockid);

    const buyOrders = await request.query(`
        SELECT TOP 1 * FROM stockOrder
        WHERE stockid = @stockid AND type = 'buy' AND status = 'open'
        ORDER BY price DESC, createdAt ASC
    `);
    const sellOrders = await request.query(`
        SELECT TOP 1 * FROM stockOrder
        WHERE stockid = @stockid AND type = 'sell' AND status = 'open'
        ORDER BY price ASC, createdAt ASC
    `);

    const buy = buyOrders.recordset[0];
    const sell = sellOrders.recordset[0];

    if (!buy || !sell || buy.price < sell.price) {
        return false;
    }




    const matchAmount = Math.min(buy.amount, sell.amount);
    const finalPrice = sell.price;
    const totalCost = finalPrice * matchAmount;

    // 檢查買方是否有足夠資金支付此次交易
    const buyerFundCheck = new sql.Request();
    buyerFundCheck.input("uid", sql.Int, buy.uid);

    const fundResult = await buyerFundCheck.query(`
    SELECT funds FROM userInfo WHERE uid = @uid;
`);
    const buyerFunds = fundResult.recordset[0].funds;


    if (buyerFunds < totalCost) {
        console.log(`買方資金不足：需要 ${totalCost}，但只有 ${buyerFunds}`);
        return false; // ❌ 不進行這次撮合
    }

    const updateRequest = new sql.Request();
    updateRequest.input("buyId", sql.Int, buy.id);
    updateRequest.input("sellId", sql.Int, sell.id);
    updateRequest.input("amount", sql.Int, matchAmount);

    await updateRequest.query(`
        UPDATE stockOrder SET amount = amount - @amount,
        status = CASE WHEN amount - @amount = 0 THEN 'matched' ELSE 'open' END
        WHERE id IN (@buyId, @sellId);
    `);

    const recordBuy = new sql.Request();
    recordBuy.input("uid", sql.Int, buy.uid);
    recordBuy.input("stockid", sql.VarChar(10), stockid);
    recordBuy.input("amount", sql.Int, matchAmount);
    recordBuy.input("price", sql.Int, finalPrice);
    recordBuy.input("type", sql.VarChar(4), 'buy');

    await recordBuy.query(`
        INSERT INTO stockRecord(uid, stockid, amount, price, type)
        VALUES (@uid, @stockid, @amount, @price, @type);
    `);

    const recordSell = new sql.Request();
    recordSell.input("uid", sql.Int, sell.uid);
    recordSell.input("stockid", sql.VarChar(10), stockid);
    recordSell.input("amount", sql.Int, matchAmount);
    recordSell.input("price", sql.Int, finalPrice);
    recordSell.input("type", sql.VarChar(4), 'sell');

    await recordSell.query(`
        INSERT INTO stockRecord(uid, stockid, amount, price, type)
        VALUES (@uid, @stockid, @amount, @price, @type);
    `);


    // 查詢買方是否持有該股票
    const checkBuyerStock = new sql.Request();
    checkBuyerStock.input("uid", sql.Int, buy.uid);
    checkBuyerStock.input("stockid", sql.VarChar(10), stockid);
    const resultBuyer = await checkBuyerStock.query(`
    SELECT stockAmount, cost FROM userStock
    WHERE uid = @uid AND stockid = @stockid;
`);

    if (resultBuyer.recordset.length > 0) {
        // 已持有 → 計算平均成本
        const oldAmount = resultBuyer.recordset[0].stockAmount;
        const oldCost = resultBuyer.recordset[0].cost;
        const newAmount = oldAmount + matchAmount;
        const newTotalCost = (oldAmount * oldCost) + (matchAmount * finalPrice);
        const newAvgCost = Math.floor(newTotalCost / newAmount);

        const updateStock = new sql.Request();
        updateStock.input("uid", sql.Int, buy.uid);
        updateStock.input("stockid", sql.VarChar(10), stockid);
        updateStock.input("amount", sql.Int, matchAmount);
        updateStock.input("cost", sql.Int, newAvgCost);
        await updateStock.query(`
        UPDATE userStock
        SET stockAmount = stockAmount + @amount,
            cost = @cost
        WHERE uid = @uid AND stockid = @stockid;
    `);
    } else {
        // 首次買入 → 新增資料
        const insertStock = new sql.Request();
        insertStock.input("uid", sql.Int, buy.uid);
        insertStock.input("stockid", sql.VarChar(10), stockid);
        insertStock.input("amount", sql.Int, matchAmount);
        insertStock.input("cost", sql.Int, finalPrice);
        await insertStock.query(`
        INSERT INTO userStock (uid, stockid, stockAmount, cost)
        VALUES (@uid, @stockid, @amount, @cost);
    `);
    }


    // 更新賣方持股（扣股）
    const updateSellerStock = new sql.Request();
    updateSellerStock.input("uid", sql.Int, sell.uid);
    updateSellerStock.input("stockid", sql.VarChar(10), stockid);
    updateSellerStock.input("amount", sql.Int, matchAmount);
    await updateSellerStock.query(`
    UPDATE userStock
    SET stockAmount = stockAmount - @amount
    WHERE uid = @uid AND stockid = @stockid;
`);

    const checkAfterSell = new sql.Request();
    checkAfterSell.input("uid", sql.Int, sell.uid);
    checkAfterSell.input("stockid", sql.VarChar(10), stockid);

    const result = await checkAfterSell.query(`
    SELECT stockAmount FROM userStock
    WHERE uid = @uid AND stockid = @stockid;
`);

    if (result.recordset[0]?.stockAmount === 0) {
        const deleteZeroStock = new sql.Request();
        deleteZeroStock.input("uid", sql.Int, sell.uid);
        deleteZeroStock.input("stockid", sql.VarChar(10), stockid);
        await deleteZeroStock.query(`
        DELETE FROM userStock
        WHERE uid = @uid AND stockid = @stockid;
    `);
    }


    // 🔄 更新買方資金（扣錢）
    const updateBuyerFunds = new sql.Request();
    updateBuyerFunds.input("uid", sql.Int, buy.uid);
    updateBuyerFunds.input("cost", sql.Int, totalCost);
    await updateBuyerFunds.query(`
    UPDATE userInfo
    SET funds = funds - @cost
    WHERE uid = @uid;
`);

    // 🔄 更新賣方資金（加錢）
    const updateSellerFunds = new sql.Request();
    updateSellerFunds.input("uid", sql.Int, sell.uid);
    updateSellerFunds.input("gain", sql.Int, totalCost);
    await updateSellerFunds.query(`
    UPDATE userInfo
    SET funds = funds + @gain
    WHERE uid = @uid;
`);

//     const updatePriceLog = new sql.Request();
//     updatePriceLog.input("stockid", sql.VarChar(10), stockid);
//     updatePriceLog.input("price", sql.Int, finalPrice);

//     await updatePriceLog.query(`
//     INSERT INTO stockPriceLog (stockid, price, recordedAt)
//     VALUES (@stockid, @price, GETDATE());
// `);


    return true; // 有成交
}

app.listen(port, () => {
    console.log(`伺服器運行在 http://localhost:${port}`);
});