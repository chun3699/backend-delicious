import express from "express";
import { conn } from "../dbconnect";
import { IngredientItem } from "../model/Ingredient_Item";

import util from "util";
import { RowDataPacket } from "mysql2";
import { ResultSetHeader } from "mysql2/promise";
import { Response } from "express"; // เผื่อไฟล์นี้ยังไม่ได้นำเข้า Response


import dotenv from "dotenv";

// โหลดค่าจากไฟล์ .env
dotenv.config();

export const queryAsync = util.promisify(conn.query).bind(conn);
export const router = express.Router();



// ==========================================
// Get Ingredient All (GET) แสดงวัตถุดิบทั้งหมด
// ==========================================
router.get('/', async (req, res) => {
  try {

    const [rows] = await conn.query("SELECT * FROM `ingredient` ");
    res.status(200).json(rows);
    
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// ==========================================
// Insert Ingredient (POST)
// ==========================================
router.post("/add", async (req, res) => {
  try {
    const { ing_name, ing_image, ing_detail, ing_type_id } = req.body;

    // ตรวจสอบว่าส่งข้อมูลสำคัญมาครบหรือไม่
    if (!ing_name || !ing_type_id) {
      return res.status(400).json({ error: "กรุณาส่งชื่อวัตถุดิบ (ing_name) และรหัสประเภท (type_id)" });
    }

    const sql = `
      INSERT INTO ingredient (ing_name, ing_image, ing_detail, ing_type_id) 
      VALUES (?, ?, ?, ?)
    `;
    
    const [result] = await conn.query<ResultSetHeader>(sql, [
      ing_name,
      ing_image || "https://cdn-icons-png.flaticon.com/512/149/149071.png",    // ถ้าไม่มีรูป ให้ใส่
      ing_detail || "-",   // ถ้าไม่มีรายละเอียด ให้ใส่ "-"
      ing_type_id
    ]);

    res.status(201).json({ 
      message: "เพิ่มข้อมูลวัตถุดิบสำเร็จ", 
      insertId: result.insertId 
    });

  } catch (error) {
    console.error("❌ Insert Ingredient Error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
  }
});

// ==========================================
// Edit Ingredient โดยใช้ ID (PUT Update)
// ==========================================
router.put("/update/:id", async (req, res) => {
  try {
    const ing_id = req.params.id;
    const updateData : IngredientItem = req.body;

    // 3.1 ตรวจสอบข้อมูลเดิม
    const selectSql = "SELECT * FROM `ingredient` WHERE ing_id = ?";
    const [rows] = await conn.execute<any[]>(selectSql, [ing_id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "ไม่พบข้อมูลวัตถุดิบที่ต้องการแก้ไข" });
    }

    const ingOri = rows[0];
    // console.log(ingOri);

    const updateIngredient : IngredientItem = { ...ingOri, ...updateData };
    // console.log(updateIngredient);

    // 3.3 บันทึกลง Database
    const updateSql = `
      UPDATE ingredient 
      SET ing_name = ?, ing_image = ?, ing_detail = ?, ing_type_id = ? 
      WHERE ing_id = ?
    `;
    const [result] = await conn.execute<ResultSetHeader>(updateSql, [
      updateIngredient.ing_name,
      updateIngredient.ing_image,
      updateIngredient.ing_detail,
      updateIngredient.ing_type_id,
      ing_id
    ]);

    res.status(200).json({ 
      message: "อัปเดตข้อมูลวัตถุดิบสำเร็จ",
      affectedRows: result.affectedRows 
    });

  } catch (error) {
    console.error("❌ Update Ingredient Error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการอัปเดตข้อมูล" });
  }
});

// ==========================================
// Delete Ingredient (DELETE)
// ==========================================
router.delete("/delete/:id", async (req, res) => {
  // ดึง Connection ออกมาจาก Pool เพื่อทำ Transaction
  const connection = await conn.getConnection();

  try {
    const ing_id = req.params.id;

    // 1. เริ่มต้น Transaction (ล็อคการทำงานเป็นชุดเดียวกัน)
    await connection.beginTransaction();

    // 2. ลบข้อมูลลูกในตาราง user_ingredient ก่อน
    const sqlDeleteUserIng = "DELETE FROM `user_ingredient` WHERE ing_id = ?";
    await connection.execute(sqlDeleteUserIng, [ing_id]);

    // 3. ลบข้อมูลลูกในตาราง food_component
    const sqlDeleteFoodComp = "DELETE FROM `food_component` WHERE ing_id = ?";
    await connection.execute(sqlDeleteFoodComp, [ing_id]);

    // 4. ลบข้อมูลในตารางหลัก (ingredient) เป็นลำดับสุดท้าย
    const sqlDeleteIngredient = "DELETE FROM `ingredient` WHERE ing_id = ?";
    const [result] = await connection.execute<ResultSetHeader>(sqlDeleteIngredient, [ing_id]);

    // ตรวจสอบว่ามีข้อมูลวัตถุดิบถูกลบจริงๆ หรือไม่
    if (result.affectedRows === 0) {
      await connection.rollback(); // ยกเลิกการลบทั้งหมด
      connection.release(); // คืน Connection กลับสู่ Pool
      return res.status(404).json({ error: "ไม่พบข้อมูลวัตถุดิบ หรือถูกลบไปแล้ว" });
    }

    // 5. ถ้ายืนยันว่าลบสำเร็จทุกขั้นตอน ให้ Commit (บันทึกการเปลี่ยนแปลงลงฐานข้อมูลจริง)
    await connection.commit();
    connection.release(); // คืน Connection กลับสู่ Pool

    res.status(200).json({ 
      message: "ลบข้อมูลวัตถุดิบและข้อมูลที่เกี่ยวข้องในเมนูอาหารและคลังสำเร็จเรียบร้อยแล้ว" 
    });
  } catch (error) {
    // ถ้ามี Error เกิดขึ้นระหว่างทาง (เช่น เน็ตหลุด, เซิร์ฟเวอร์ดับ) ให้ Rollback ข้อมูลกลับสภาพเดิม
    await connection.rollback();
    connection.release(); 

    console.error("❌ Delete Ingredient Error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการลบข้อมูลวัตถุดิบและข้อมูลที่เกี่ยวข้อง" });
  }
});

// ==========================================
// แสดงข้อมูลประเภทวัตถุดิบทั้งหมด (GET All Types)
// ==========================================
router.get("/types/all", async (req, res) => {
  try {
    // คำสั่ง SQL ดึงข้อมูลทั้งหมดจากตาราง ingredient_type
    // (เปลี่ยนชื่อตารางให้ตรงกับในฐานข้อมูลของคุณ ถ้าใช้ชื่ออื่น)
    const sql = "SELECT * FROM `typeIngredient`"; 
    
    // ใช้ conn.query เพื่อดึงข้อมูลออกมาเป็น Array
    const [rows] = await conn.query<any[]>(sql);

    // เช็คว่ามีข้อมูลในตารางหรือไม่
    if (rows.length === 0) {
      return res.status(404).json({ message: "ไม่พบข้อมูลประเภทวัตถุดิบ" });
    }

    // ส่งข้อมูลกลับไปให้ Frontend ในรูปแบบ JSON
    res.status(200).json(rows);

  } catch (error) {
    console.error("❌ Get Ingredient Types Error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลประเภทวัตถุดิบ" });
  }
});

// ==========================================
// API แสดงวัตถุดิบตามประเภท (GET /type/:type_id)
// ==========================================
router.get("/type/:type_id", async (req, res) => {
  try {
    // 1. ดึงรหัสประเภทจาก URL (req.params)
    const typeId = req.params.type_id;

    // ตรวจสอบเบื้องต้นเผื่อไม่ได้ส่งค่ามา
    if (!typeId) {
      return res.status(400).json({ error: "กรุณาระบุรหัสประเภทวัตถุดิบ (type_id)" });
    }

    // 2. คำสั่ง SQL ค้นหาข้อมูล
    // 💡 ข้อควรระวัง: ถ้าคอลัมน์ใน Database ของคุณชื่อ ing_type_id ให้เปลี่ยนคำว่า type_id ใน WHERE เป็น ing_type_id ด้วยนะครับ
    const sql = `
      SELECT * FROM ingredient 
      WHERE ing_type_id = ?
    `;

    // 3. ดึงข้อมูลจาก Database
    const [rows]: any = await conn.query(sql, [typeId]);

    // 4. ส่งข้อมูลกลับไปให้ Frontend
    res.status(200).json({
      message: `ดึงข้อมูลหมวดหมู่รหัส ${typeId} สำเร็จ`,
      total_items: rows.length, // บอกจำนวนวัตถุดิบที่เจอในหมวดหมู่นี้
      data: rows                // ส่งรายการข้อมูลทั้งหมดไป
    });

  } catch (error) {
    console.error("❌ Get Ingredient by Type Error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลวัตถุดิบตามหมวดหมู่" });
  }
});

// ==========================================
// Get Ingredient ID (GET) แสดงเฉพาะวัตถุดิบ
// ==========================================
router.get('/:id',async (req,res)=>{
    try{
        const ingredient_id = req.params.id; 
        const sql = `
            SELECT 
                i.ing_id, 
                i.ing_name, 
                i.ing_thai_name,
                i.ing_detail, 
                i.ing_image, 
                i.ing_type_id,
                t.ing_type_name 
            FROM \`ingredient\` i
            LEFT JOIN \`typeIngredient\` t ON i.ing_type_id = t.ing_type_id
            WHERE i.ing_id = ?
        `;
        const [rows] = await conn.query(sql,[ingredient_id]);
        res.json(rows);
    }catch(err){
        console.error(err);
        res.status(500).send("Database error");
    }
});

// ==========================================
// API สำหรับค้นหาข้อมูลวัตถุดิบจากชื่อ (GET /search-ingredient)
// ปรับปรุงให้รองรับการค้นหาที่ยืดหยุ่นขึ้น
// ==========================================
router.get("/search/name", async (req, res) => {
  try {
    const query = (req.query.name as string || "").trim().toLowerCase();
    
    // ✅ เพิ่มตรงนี้: พิมพ์ค่าออกมาดูใน Terminal ของ Node.js แบบเห็นชัดๆ
    console.log("--- DEBUG START ---");
    console.log("Query ที่ได้รับ (Length):", query.length);
    console.log("Query ที่ได้รับ (Raw):", JSON.stringify(query));
    
    // ดึงค่าทั้งหมดออกมาดูว่าฐานข้อมูลมีอะไรบ้าง (เอา LIMIT ออกชั่วคราว)
    const [allRows]: any = await conn.query("SELECT ing_name FROM `ingredient`");
    console.log("ตัวอย่างชื่อในฐานข้อมูล:", allRows.slice(0, 5)); 
    console.log("--- DEBUG END ---");

    const sql = "SELECT * FROM `ingredient` WHERE LOWER(ing_name) LIKE ? LIMIT 1";
    const [rows]: any = await conn.query(sql, [`%${query}%`]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "ไม่พบวัตถุดิบนี้ในระบบฐานข้อมูล" });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: "เกิดข้อผิดพลาด" });
  }
});