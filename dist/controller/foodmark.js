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
exports.router.get('/', (req, res) => {
    res.send("Get in login.ts");
});
// ==========================================
// เพิ่มเมนูอาหารที่ชอบ (Add FoodMark)
// ==========================================
exports.router.post("/add", async (req, res) => {
    try {
        // รับค่า uid (รหัสคนกด) และ food_id (รหัสเมนูอาหาร) จากฝั่ง Frontend
        const { uid, food_id } = req.body;
        // ตรวจสอบว่าส่งข้อมูลมาครบไหม
        if (!uid || !food_id) {
            return res.status(400).json({ error: "กรุณาส่งรหัสผู้ใช้ (uid) และ รหัสเมนูอาหาร (food_id)" });
        }
        // (Option เสริม) ตรวจสอบก่อนว่าผู้ใช้เคยกดใจเมนูนี้ไปแล้วหรือยัง เพื่อป้องกันการบันทึกซ้ำ
        const checkSql = "SELECT * FROM `foodmark` WHERE u_id = ? AND food_id = ?";
        const [existing] = await dbconnect_1.conn.query(checkSql, [uid, food_id]);
        if (existing.length > 0) {
            return res.status(400).json({ error: "คุณได้บันทึกเมนูนี้เป็นรายการโปรดไปแล้ว" });
        }
        // คำสั่ง SQL บันทึกลงตาราง foodmark
        const insertSql = "INSERT INTO `foodmark` (u_id, food_id) VALUES (?, ?)";
        const [result] = await dbconnect_1.conn.execute(insertSql, [uid, food_id]);
        res.status(201).json({
            message: "บันทึกเมนูอาหารที่ชอบสำเร็จ!",
            insertId: result.insertId
        });
    }
    catch (error) {
        console.error("❌ Add FoodMark Error:", error);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
    }
});
// ==========================================
// ยกเลิกเมนูอาหารที่ชอบ (Remove FoodMark)
// ==========================================
// เปลี่ยนจาก router.delete เป็น router.post สำหรับ route "/remove"
exports.router.post("/remove", async (req, res) => {
    try {
        const { uid, food_id } = req.body; // รับผ่าน body ตามที่หน้าจอส่งมา
        if (!uid || !food_id) {
            return res.status(400).json({ error: "กรุณาส่งรหัสผู้ใช้ (uid) และ รหัสเมนูอาหาร (food_id)" });
        }
        const deleteSql = "DELETE FROM `foodmark` WHERE u_id = ? AND food_id = ?";
        const [result] = await dbconnect_1.conn.execute(deleteSql, [uid, food_id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "ไม่พบข้อมูล หรือเมนูนี้ถูกยกเลิกไปแล้ว" });
        }
        res.status(200).json({ message: "ยกเลิกเมนูอาหารที่ชอบสำเร็จ" });
    }
    catch (error) {
        console.error("❌ Remove FoodMark Error:", error);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการลบข้อมูล" });
    }
});
// ==========================================
// ดึงรายการเมนูโปรดทั้งหมดของ User คนนั้น (Get My FoodMarks)
// ==========================================
exports.router.get("/my-favorite/:uid", async (req, res) => {
    try {
        const uid = req.params.uid;
        // ใช้ JOIN เพื่อดึงรายละเอียดอาหาร (ชื่อ, รูปภาพ) ออกมาแสดงผลด้วยเลย
        const sql = `
      SELECT f.food_id, f.food_name, f.food_image, f.food_description
      FROM foodmark fm
      JOIN food f ON fm.food_id = f.food_id
      WHERE fm.u_id = ?
    `;
        const [rows] = await dbconnect_1.conn.query(sql, [uid]);
        res.status(200).json(rows);
    }
    catch (error) {
        console.error("❌ Get FoodMarks Error:", error);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลเมนูโปรด" });
    }
});
// ==========================================
// เช็คว่าเมนูนี้เป็นเมนูโปรดหรือไม่ (Check FoodMark)
// ==========================================
exports.router.get("/check/:uid/:food_id", async (req, res) => {
    try {
        const { uid, food_id } = req.params;
        const sql = "SELECT * FROM `foodmark` WHERE u_id = ? AND food_id = ?";
        const [rows] = await dbconnect_1.conn.query(sql, [uid, food_id]);
        // ส่งกลับว่ามีหรือไม่ (true/false)
        res.status(200).json({ isFavorite: rows.length > 0 });
    }
    catch (error) {
        console.error("❌ Check FoodMark Error:", error);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการตรวจสอบข้อมูล" });
    }
});
//# sourceMappingURL=foodmark.js.map