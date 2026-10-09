"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = exports.queryAsync = void 0;
const express_1 = __importDefault(require("express"));
const dbconnect_1 = require("../dbconnect");
const util_1 = __importDefault(require("util"));
exports.queryAsync = util_1.default.promisify(dbconnect_1.conn.query).bind(dbconnect_1.conn);
exports.router = express_1.default.Router();
async function ensureFoodStepTable() {
    await dbconnect_1.conn.query(`
    CREATE TABLE IF NOT EXISTS food_step (
      step_id INT AUTO_INCREMENT PRIMARY KEY,
      food_id INT NOT NULL,
      step_order INT NOT NULL,
      step_text TEXT,
      INDEX (food_id)
    )
  `);
}
function mapFoodRow(row) {
    return {
        ...row,
        id: row.food_id,
        food_id: row.food_id,
        name: row.food_name,
        food_name: row.food_name,
        category: row.food_type_name || "อื่นๆ",
        food_type_name: row.food_type_name || "อื่นๆ",
        imageUrl: row.food_image || "",
        food_image: row.food_image || "",
        content: row.food_description || "",
        food_description: row.food_description || "",
        ingredients_count: Number(row.ingredients_count || 0),
    };
}
async function getOrCreateFoodType(typeName, existingTypeId) {
    if (existingTypeId) {
        return Number(existingTypeId);
    }
    const name = (typeName || "อื่นๆ").trim();
    const [rows] = await dbconnect_1.conn.query("SELECT food_type_id FROM `typeFood` WHERE food_type_name = ? LIMIT 1", [name]);
    if (rows.length > 0) {
        return Number(rows[0].food_type_id);
    }
    const [result] = await dbconnect_1.conn.query("INSERT INTO `typeFood` (food_type_name) VALUES (?)", [name]);
    return result.insertId;
}
async function getOrCreateIngredient(name) {
    const ingName = name.trim();
    const [rows] = await dbconnect_1.conn.query("SELECT ing_id FROM `ingredient` WHERE LOWER(TRIM(ing_name)) = LOWER(?) LIMIT 1", [ingName]);
    if (rows.length > 0) {
        return Number(rows[0].ing_id);
    }
    let typeId = 1;
    const [types] = await dbconnect_1.conn.query("SELECT ing_type_id FROM `typeIngredient` ORDER BY ing_type_id ASC LIMIT 1");
    if (types.length > 0) {
        typeId = Number(types[0].ing_type_id);
    }
    const [result] = await dbconnect_1.conn.query(`INSERT INTO ingredient (ing_name, ing_image, ing_detail, ing_type_id)
     VALUES (?, ?, ?, ?)`, [
        ingName,
        "https://cdn-icons-png.flaticon.com/512/3143/3143645.png",
        "-",
        typeId,
    ]);
    return result.insertId;
}
// ปรับปรุงฟังก์ชันบันทึกวัตถุดิบ ให้รองรับทั้ง unit_id และ unitId จากฝั่งหน้าจอ
async function saveFoodIngredients(connection, foodId, ingredients) {
    await connection.query("DELETE FROM `food_component` WHERE food_id = ?", [foodId]);
    for (const item of ingredients || []) {
        const ingName = (item.name || item.ing_name || "").toString().trim();
        const amount = (item.amount ?? item.ing_amount ?? "-").toString().trim() || "-";
        // ดึงค่า unit_id หรือ unitId ที่ส่งมาจาก Frontend อย่างปลอดภัย
        const rawUnitId = item.unit_id ?? item.unitId;
        const unitId = rawUnitId ? Number(rawUnitId) : 1;
        let ingId = item.ing_id ? Number(item.ing_id) : null;
        if (!ingId && !ingName)
            continue;
        if (!ingId) {
            ingId = await getOrCreateIngredient(ingName);
        }
        await connection.query("INSERT INTO `food_component` (food_id, ing_id, amount, unit_id) VALUES (?, ?, ?, ?)", [foodId, ingId, amount, unitId]);
    }
}
async function saveFoodSteps(connection, foodId, steps) {
    await ensureFoodStepTable();
    await connection.query("DELETE FROM `food_step` WHERE food_id = ?", [foodId]);
    const list = (steps || [])
        .map((step) => (typeof step === "string" ? step : step?.step_text || step?.text || ""))
        .map((text) => text.toString().trim())
        .filter((text) => text.length > 0);
    for (let i = 0; i < list.length; i++) {
        await connection.query("INSERT INTO `food_step` (food_id, step_order, step_text) VALUES (?, ?, ?)", [foodId, i + 1, list[i]]);
    }
}
async function getFoodSteps(foodId) {
    try {
        await ensureFoodStepTable();
        const [rows] = await dbconnect_1.conn.query("SELECT step_text FROM `food_step` WHERE food_id = ? ORDER BY step_order ASC", [foodId]);
        return rows.map((row) => row.step_text);
    }
    catch {
        return [];
    }
}
// ==========================================
// 1. Get food แสดงอาหารทั้งหมด
// ==========================================
exports.router.get("/", async (req, res) => {
    try {
        const sql = `
      SELECT f.*, tf.food_type_name,
        (SELECT COUNT(*) FROM \`food_component\` fc WHERE fc.food_id = f.food_id) AS ingredients_count
      FROM \`food\` f
      LEFT JOIN \`typeFood\` tf ON f.food_type_id = tf.food_type_id
      ORDER BY f.food_id DESC
    `;
        const [rows] = await dbconnect_1.conn.query(sql);
        res.status(200).json(rows.map(mapFoodRow));
    }
    catch (error) {
        console.error("❌ Get Food Error:", error);
        res.status(500).json({ error: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
    }
});
// ดึงข้อมูลหน่วยนับทั้งหมด
exports.router.get("/unit", async (req, res) => {
    try {
        const [rows] = await dbconnect_1.conn.query("SELECT * FROM `unit`");
        res.status(200).json(rows);
    }
    catch (error) {
        console.error("❌ Get Units Error:", error);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลหน่วยนับ" });
    }
});
// ==========================================
// ประเภทอาหารทั้งหมด
// ==========================================
exports.router.get("/types/all", async (req, res) => {
    try {
        const [rows] = await dbconnect_1.conn.query("SELECT * FROM `typeFood`");
        res.status(200).json(rows);
    }
    catch (error) {
        console.error("❌ Get Food Types Error:", error);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงประเภทอาหาร" });
    }
});
// ==========================================
// เพิ่มเมนูอาหาร (Admin)
// ==========================================
exports.router.post("/add", async (req, res) => {
    const connection = await dbconnect_1.conn.getConnection();
    try {
        const { name, food_name, category, food_type_name, food_type_id, content, food_description, imageUrl, food_image, ingredients, steps, } = req.body;
        const foodName = (name || food_name || "").toString().trim();
        if (!foodName) {
            connection.release();
            return res.status(400).json({ error: "กรุณากรอกชื่อเมนูอาหาร" });
        }
        const typeId = await getOrCreateFoodType(category || food_type_name, food_type_id);
        const description = (content || food_description || "-").toString();
        const image = (imageUrl || food_image || "-").toString();
        await connection.beginTransaction();
        const [result] = await connection.query(`INSERT INTO \`food\` (food_name, food_description, food_image, food_type_id)
       VALUES (?, ?, ?, ?)`, [foodName, description, image, typeId]);
        const foodId = result.insertId;
        await saveFoodIngredients(connection, foodId, ingredients || []);
        await saveFoodSteps(connection, foodId, steps || []);
        await connection.commit();
        res.status(201).json({ message: "บันทึกเมนูอาหารสำเร็จ", food_id: foodId });
    }
    catch (error) {
        await connection.rollback();
        console.error("❌ Add Food Error:", error);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการบันทึกเมนูอาหาร" });
    }
    finally {
        connection.release();
    }
});
// ==========================================
// แก้ไขเมนูอาหาร (Admin)
// ==========================================
exports.router.put("/update/:id", async (req, res) => {
    const connection = await dbconnect_1.conn.getConnection();
    try {
        const foodId = Number(req.params.id);
        const { name, food_name, category, food_type_name, food_type_id, content, food_description, imageUrl, food_image, ingredients, steps, } = req.body;
        const [existing] = await connection.query("SELECT * FROM `food` WHERE food_id = ?", [foodId]);
        if (existing.length === 0) {
            connection.release();
            return res.status(404).json({ error: "ไม่พบเมนูอาหารที่ต้องการแก้ไข" });
        }
        const foodName = (name || food_name || existing[0].food_name).toString().trim();
        const description = (content ?? food_description ?? existing[0].food_description).toString();
        const image = (imageUrl ?? food_image ?? existing[0].food_image).toString();
        const typeId = await getOrCreateFoodType(category || food_type_name, food_type_id || existing[0].food_type_id);
        await connection.beginTransaction();
        await connection.query(`UPDATE \`food\`
       SET food_name = ?, food_description = ?, food_image = ?, food_type_id = ?
       WHERE food_id = ?`, [foodName, description, image, typeId, foodId]);
        if (Array.isArray(ingredients)) {
            await saveFoodIngredients(connection, foodId, ingredients);
        }
        if (Array.isArray(steps)) {
            await saveFoodSteps(connection, foodId, steps);
        }
        await connection.commit();
        res.status(200).json({ message: "อัปเดตเมนูอาหารสำเร็จ" });
    }
    catch (error) {
        await connection.rollback();
        console.error("❌ Update Food Error:", error);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการอัปเดตเมนูอาหาร" });
    }
    finally {
        connection.release();
    }
});
// ==========================================
// ลบเมนูอาหาร (Admin)
// ==========================================
exports.router.delete("/:id", async (req, res) => {
    const connection = await dbconnect_1.conn.getConnection();
    try {
        const foodId = req.params.id;
        await connection.beginTransaction();
        await ensureFoodStepTable();
        await connection.query("DELETE FROM `food_step` WHERE food_id = ?", [foodId]);
        await connection.query("DELETE FROM `food_component` WHERE food_id = ?", [foodId]);
        await connection.query("DELETE FROM `foodmark` WHERE food_id = ?", [foodId]);
        const [result] = await connection.query("DELETE FROM `food` WHERE food_id = ?", [foodId]);
        if (result.affectedRows === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ error: "ไม่พบเมนูอาหาร หรือถูกลบไปแล้ว" });
        }
        await connection.commit();
        res.status(200).json({ message: "ลบเมนูอาหารสำเร็จ" });
    }
    catch (error) {
        await connection.rollback();
        console.error("❌ Delete Food Error:", error);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการลบเมนูอาหาร" });
    }
    finally {
        connection.release();
    }
});
// ==========================================
// 2. รับ ID แล้วแสดงข้อมูลเมนูอาหาร (ส่ง unit_id กลับไปด้วย)
// ==========================================
exports.router.get("/:id", async (req, res) => {
    try {
        const food_id = req.params.id;
        const sqlFood = `
      SELECT f.*, tf.food_type_name 
      FROM \`food\` f
      LEFT JOIN \`typeFood\` tf ON f.food_type_id = tf.food_type_id
      WHERE f.food_id = ?
    `;
        const [foodRows] = await dbconnect_1.conn.query(sqlFood, [food_id]);
        if (foodRows.length === 0) {
            return res.status(404).json({ error: "ไม่พบข้อมูลเมนูอาหารนี้" });
        }
        const sqlComponents = `
      SELECT fc.*, i.ing_name, i.ing_image, i.ing_detail
      FROM \`food_component\` fc
      JOIN \`ingredient\` i ON fc.ing_id = i.ing_id
      WHERE fc.food_id = ?
    `;
        const [componentRows] = await dbconnect_1.conn.query(sqlComponents, [food_id]);
        const steps = await getFoodSteps(food_id);
        const ingredients = componentRows.map((row) => ({
            ...row,
            name: row.ing_name,
            amount: row.amount,
            unit_id: Number(row.unit_id || 1), // เพิ่มบรรทัดนี้
            unitId: Number(row.unit_id || 1),
        }));
        res.status(200).json({
            ...mapFoodRow(foodRows[0]),
            ingredients,
            steps,
        });
    }
    catch (error) {
        console.error("❌ Get Food Detail Error:", error);
        res.status(500).json({ error: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
    }
});
// ==========================================
// 3. สำหรับแนะนำอาหาร (รองรับ amount)
// ==========================================
exports.router.post("/recommend", async (req, res) => {
    try {
        const { userInventoryIds } = req.body;
        if (!Array.isArray(userInventoryIds)) {
            return res.status(400).json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" });
        }
        const userInventorySet = new Set(userInventoryIds.map(Number));
        const sqlRecipes = `
        SELECT f.food_id, f.food_name, f.food_image, fc.ing_id, fc.amount 
        FROM \`food\` f
        JOIN \`food_component\` fc ON f.food_id = fc.food_id
    `;
        const [recipeRows] = await dbconnect_1.conn.query(sqlRecipes);
        const recipesMap = new Map();
        recipeRows.forEach((row) => {
            if (!recipesMap.has(row.food_id)) {
                recipesMap.set(row.food_id, {
                    id: row.food_id,
                    name: row.food_name,
                    image: row.food_image,
                    requiredIngredients: [],
                });
            }
            recipesMap.get(row.food_id).requiredIngredients.push({
                ing_id: row.ing_id,
                amount: row.amount,
            });
        });
        const recommendationResults = [];
        recipesMap.forEach((recipe) => {
            let matchCount = 0;
            const totalNeeded = recipe.requiredIngredients.length;
            recipe.requiredIngredients.forEach((reqIng) => {
                if (userInventorySet.has(reqIng.ing_id)) {
                    matchCount++;
                }
            });
            if (matchCount > 0) {
                let matchPercentage = (matchCount / totalNeeded) * 100;
                recommendationResults.push({
                    recipeId: recipe.id,
                    recipeName: recipe.name,
                    food_image: recipe.image,
                    matchPercentage: Math.round(matchPercentage),
                    canCookNow: matchPercentage === 100,
                });
            }
        });
        recommendationResults.sort((a, b) => b.matchPercentage - a.matchPercentage);
        res.status(200).json({ status: "success", data: recommendationResults });
    }
    catch (error) {
        res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ" });
    }
});
//# sourceMappingURL=food.js.map