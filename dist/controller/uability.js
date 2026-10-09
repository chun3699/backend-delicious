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
// ==========================================
// API เพิ่มวัตถุดิบเข้าคลังของผู้ใช้ (POST /add-inventory)
// ปรับ: เปลี่ยนจากการรับ amount เป็นการเพิ่มค่า 1 เข้าไปโดยอัตโนมัติ
// ==========================================
exports.router.post("/add-inventory", async (req, res) => {
    try {
        // 1. รับค่าแค่ uid และ ing_id (ไม่ต้องรับ amount แล้ว)
        const { uid, ing_id } = req.body;
        if (!uid || !ing_id) {
            return res.status(400).json({
                error: "กรุณาส่งรหัสผู้ใช้ (uid) และ รหัสวัตถุดิบ (ing_id)"
            });
        }
        // 2. เช็คว่าผู้ใช้คนนี้มีวัตถุดิบนี้แล้วหรือยัง?
        const checkSql = "SELECT * FROM `user_ingredient` WHERE u_id = ? AND ing_id = ?";
        const [existingRows] = await dbconnect_1.conn.query(checkSql, [uid, ing_id]);
        if (existingRows.length > 0) {
            return res.status(400).json({
                message: "วัตถุดิบนี้มีอยู่ในคลังของคุณแล้ว",
                action: "exists"
            });
        }
        // 3. Insert ลงไปโดย fix ค่า amount เป็น 1 เสมอ
        const insertSql = `
      INSERT INTO \`user_ingredient\` (u_id, ing_id, amount) 
      VALUES (?, ?, 1)
    `;
        const [result] = await dbconnect_1.conn.execute(insertSql, [uid, ing_id]);
        res.status(201).json({
            message: "เพิ่มวัตถุดิบเข้าคลังสำเร็จ!",
            action: "inserted",
            insertId: result.insertId
        });
    }
    catch (error) {
        console.error("❌ Add Inventory Error:", error);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการบันทึกคลังวัตถุดิบ" });
    }
});
// ==========================================
// API แสดงวัตถุดิบในคลังของผู้ใช้ (GET /inventory/:uid)
// ==========================================
exports.router.get("/inventory/:uid", async (req, res) => {
    try {
        const uid = req.params.uid;
        const sql = `
      SELECT 
        i.ing_id, 
        i.ing_name, 
        i.ing_thai_name,
        i.ing_image, 
        i.ing_detail, 
        i.ing_type_id,
        t.ing_type_name AS type_name,  -- ✅ เพิ่มบรรทัดนี้ เพื่อดึงชื่อหมวดหมู่
        ui.amount 
      FROM user_ingredient ui
      JOIN ingredient i ON ui.ing_id = i.ing_id
      LEFT JOIN typeIngredient t ON i.ing_type_id = t.ing_type_id -- ✅ JOIN ตารางหมวดหมู่
      WHERE ui.u_id = ?
    `;
        const [rows] = await dbconnect_1.conn.query(sql, [uid]);
        res.status(200).json({
            message: "ดึงข้อมูลคลังวัตถุดิบสำเร็จ",
            data: rows
        });
    }
    catch (error) {
        res.status(500).json({ error: "เกิดข้อผิดพลาด" });
    }
});
// ==========================================
// API สลับสถานะวัตถุดิบ (แทนที่ Update Amount)
// ==========================================
exports.router.put("/toggle-inventory", async (req, res) => {
    try {
        const { uid, ing_id, status } = req.body; // status = 0 หรือ 1
        const sql = "UPDATE `user_ingredient` SET amount = ? WHERE u_id = ? AND ing_id = ?";
        await dbconnect_1.conn.execute(sql, [status, uid, ing_id]);
        res.status(200).json({ message: "อัปเดตสถานะสำเร็จ" });
    }
    catch (error) {
        res.status(500).json({ error: "อัปเดตล้มเหลว" });
    }
});
// ==========================================
// API ลบวัตถุดิบออกจากคลังของผู้ใช้ (DELETE /remove-inventory)
// ==========================================
exports.router.delete("/remove-inventory", async (req, res) => {
    try {
        const { uid, ing_id } = req.body;
        if (!uid || !ing_id) {
            return res.status(400).json({
                error: "กรุณาส่งรหัสผู้ใช้ (uid) และ รหัสวัตถุดิบ (ing_id)"
            });
        }
        const sql = "DELETE FROM `user_ingredient` WHERE u_id = ? AND ing_id = ?";
        const [result] = await dbconnect_1.conn.execute(sql, [uid, ing_id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "ไม่พบวัตถุดิบนี้ในคลังของคุณ" });
        }
        res.status(200).json({ message: "ลบวัตถุดิบเรียบร้อยแล้ว" });
    }
    catch (error) {
        console.error("❌ Delete Inventory Error:", error);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการลบวัตถุดิบ" });
    }
});
//# sourceMappingURL=uability.js.map