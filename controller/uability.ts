import express from "express";
import { conn } from "../dbconnect";
import { UserItem } from "../model/user_model";

import util from "util";
import { RowDataPacket } from "mysql2";
import { ResultSetHeader } from "mysql2/promise";


export const queryAsync = util.promisify(conn.query).bind(conn);
export const router = express.Router();


// ==========================================
// API เพิ่มวัตถุดิบเข้าคลังของผู้ใช้ (POST /add-inventory)
// รองรับการบันทึกจำนวน (amount)
// ==========================================
router.post("/add-inventory", async (req, res) => {
  try {
    // 1. รับค่า uid, ing_id และเพิ่ม amount เข้ามา
    const { uid, ing_id, amount } = req.body;

    // ตรวจสอบว่าส่งข้อมูลมาครบหรือไม่ (เพิ่มเช็ค amount)
    if (!uid || !ing_id || amount === undefined) {
      return res.status(400).json({ 
        error: "กรุณาส่งรหัสผู้ใช้ (uid), รหัสวัตถุดิบ (ing_id) และจำนวน (amount)" 
      });
    }

    // ✅ เพิ่มการตรวจสอบตรงนี้
    if (amount <= 0) {
      return res.status(400).json({ error: "จำนวนวัตถุดิบต้องมากกว่า 0 เท่านั้น" });
    }

    // 2. เช็คว่าผู้ใช้คนนี้เคยเพิ่มวัตถุดิบชิ้นนี้ในคลังไปแล้วหรือยัง?
    const checkSql = "SELECT * FROM `user_ingredient` WHERE u_id = ? AND ing_id = ?";
    const [existingRows]: any = await conn.query(checkSql, [uid, ing_id]);

    if (existingRows.length > 0) {
      return res.status(400).json({ 
        message: "วัตถุดิบนี้มีอยู่ในคลังของคุณแล้ว",
        action: "exists"
      });
    }

    // 3. ถ้ายังไม่มี ให้ทำการ Insert บรรทัดใหม่พร้อมระบุ amount
    const insertSql = `
      INSERT INTO \`user_ingredient\` (u_id, ing_id, amount) 
      VALUES (?, ?, ?)
    `;
    
    // บันทึกลงฐานข้อมูล โดยส่ง amount เพิ่มเข้าไปใน array
    const [result] = await conn.execute<ResultSetHeader>(insertSql, [uid, ing_id, amount]);

    res.status(201).json({ 
      message: "เพิ่มวัตถุดิบเข้าคลังสำเร็จ!",
      action: "inserted",
      insertId: result.insertId
    });

  } catch (error) {
    console.error("❌ Add Inventory Error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการบันทึกคลังวัตถุดิบ" });
  }
});

// ==========================================
// API แสดงวัตถุดิบในคลังของผู้ใช้ (GET /inventory/:uid)
// ==========================================
router.get("/inventory/:uid", async (req, res) => {
  try {
    const uid = req.params.uid;

    if (!uid) {
      return res.status(400).json({ error: "กรุณาระบุรหัสผู้ใช้ (uid)" });
    }

    // ⭐️ เพิ่ม ui.amount เข้าไปใน SELECT
    const sql = `
      SELECT 
        i.ing_id, 
        i.ing_name, 
        i.ing_image, 
        i.ing_detail, 
        i.ing_type_id,
        ui.amount 
      FROM user_ingredient ui
      JOIN ingredient i ON ui.ing_id = i.ing_id
      WHERE ui.u_id = ?
    `;

    const [rows]: any = await conn.query(sql, [uid]);

    res.status(200).json({
      message: "ดึงข้อมูลคลังวัตถุดิบสำเร็จ",
      total_items: rows.length,
      data: rows
    });

  } catch (error) {
    console.error("❌ Get Inventory Error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลคลังวัตถุดิบ" });
  }
});

// ==========================================
// API ลบวัตถุดิบออกจากคลังของผู้ใช้ (DELETE /remove-inventory)
// ==========================================
router.delete("/remove-inventory", async (req, res) => {
  try {
    const { uid, ing_id } = req.body;

    if (!uid || !ing_id) {
      return res.status(400).json({ error: "กรุณาส่งรหัสผู้ใช้ (uid) และ รหัสวัตถุดิบ (ing_id)" });
    }

    const sql = "DELETE FROM `user_ingredient` WHERE u_id = ? AND ing_id = ?";
    const [result] = await conn.execute<ResultSetHeader>(sql, [uid, ing_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "ไม่พบวัตถุดิบนี้ในคลังของคุณ" });
    }

    res.status(200).json({ message: "ลบวัตถุดิบออกจากคลังสำเร็จ" });

  } catch (error) {
    console.error("❌ Remove Inventory Error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการลบวัตถุดิบออกจากคลัง" });
  }
});

// แก้ไขจำนวนวัตถุดิบ
router.put("/update-inventory-amount", async (req, res) => {
  try {
    const { ing_id, amount } = req.body;

    // ✅ เพิ่มการตรวจสอบตรงนี้
    if (amount === undefined || amount <= 0) {
      return res.status(400).json({ error: "จำนวนที่แก้ไขต้องมากกว่า 0 เท่านั้น" });
    }

    const sql = "UPDATE `user_ingredient` SET amount = ? WHERE ing_id = ?";
    await conn.execute(sql, [amount, ing_id]);
    res.status(200).json({ message: "อัปเดตจำนวนสำเร็จ" });
  } catch (error) {
    res.status(500).json({ error: "อัปเดตล้มเหลว" });
  }
});