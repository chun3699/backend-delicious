import express from "express";
import { conn } from "../dbconnect";
import { FoodItem } from "../model/food_Item";
import { ResultSetHeader } from "mysql2/promise";
import util from "util";

export const queryAsync = util.promisify(conn.query).bind(conn);
export const router = express.Router();

// ==========================================
// 1. Get food แสดงอาหารทั้งหมด
// ==========================================
router.get("/", async (req, res) => {
  try {
    const sql = "SELECT * FROM `food`";
    const [rows] = await conn.query<any[]>(sql);
    res.status(200).json(rows); // แก้ไขให้ส่ง rows ทั้งหมด
  } catch (error) {
    console.error("❌ Get Food Error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
});

// ==========================================
// 2. รับ ID แล้วแสดงข้อมูลเมนูอาหาร (รวม amount จาก food_component)
// ==========================================
router.get("/:id", async (req, res) => {
  try {
    const food_id = req.params.id;

    // ดึงข้อมูลอาหาร
    const sqlFood = `
      SELECT f.*, tf.food_type_name 
      FROM \`food\` f
      LEFT JOIN \`typeFood\` tf ON f.food_type_id = tf.food_type_id
      WHERE f.food_id = ?
    `;
    const [foodRows] = await conn.query<any[]>(sqlFood, [food_id]);

    if (foodRows.length === 0) {
      return res.status(404).json({ error: "ไม่พบข้อมูลเมนูอาหารนี้" });
    }

    // ดึงส่วนประกอบ (JOIN + ดึง amount)
    const sqlComponents = `
      SELECT fc.*, i.ing_name, i.ing_image, i.ing_detail
      FROM \`food_component\` fc
      JOIN \`ingredient\` i ON fc.ing_id = i.ing_id
      WHERE fc.food_id = ?
    `;
    const [componentRows] = await conn.query<any[]>(sqlComponents, [food_id]);

    res.status(200).json({
      ...foodRows[0],
      ingredients: componentRows, // componentRows นี้จะมีค่า 'amount' ติดมาด้วยจาก SQL
    });
  } catch (error) {
    console.error("❌ Get Food Detail Error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
});

// ==========================================
// 3. สำหรับแนะนำอาหาร (รองรับ amount)
// ==========================================
router.post("/recommend", async (req, res) => {
  try {
    const { userInventoryIds } = req.body;
    if (!Array.isArray(userInventoryIds)) {
      return res.status(400).json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" });
    }

    // ดึงสูตรอาหารและวัตถุดิบ
    const sqlRecipes = `
            SELECT f.food_id, f.food_name, f.food_image, fc.ing_id, fc.amount 
            FROM \`food\` f
            JOIN \`food_component\` fc ON f.food_id = fc.food_id
        `;
    const [recipeRows] = await conn.query<any[]>(sqlRecipes);

    const recipesMap = new Map<number, any>();
    recipeRows.forEach((row) => {
      if (!recipesMap.has(row.food_id)) {
        recipesMap.set(row.food_id, {
          id: row.food_id,
          name: row.food_name,
          image: row.food_image,
          requiredIngredients: [],
        });
      }
      // เก็บทั้ง ing_id และ amount
      recipesMap.get(row.food_id).requiredIngredients.push({
        ing_id: row.ing_id,
        amount: row.amount,
      });
    });

    const userInventorySet = new Set(userInventoryIds.map(Number));
    const recommendationResults: any[] = [];

    recipesMap.forEach((recipe) => {
      let matchCount = 0;
      const totalNeeded = recipe.requiredIngredients.length;

      // เช็คเพียงว่าวัตถุดิบที่ต้องการ มีอยู่ในคลัง (userInventorySet) หรือไม่
      recipe.requiredIngredients.forEach((reqIng: any) => {
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
          matchPercentage: Math.round(matchPercentage), // แสดงเป็นจำนวนเต็ม
          canCookNow: matchPercentage === 100, // จะเป็นจริงก็ต่อเมื่อมีครบทุกอย่าง
        });
      }
    });

    recommendationResults.sort((a, b) => b.matchPercentage - a.matchPercentage);
    res.status(200).json({ status: "success", data: recommendationResults });
  } catch (error) {
    res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ" });
  }
});

//ทำอาหาร
router.post("/cook", async (req, res) => {
  const connection = await conn.getConnection();
  try {
    const { uid, food_id } = req.body;
    await connection.beginTransaction();

    // 1. ดึงวัตถุดิบที่ต้องใช้ (จาก food_component)
    const [recipeIngredients]: any = await connection.query(
      "SELECT ing_id, amount FROM food_component WHERE food_id = ?",
      [food_id],
    );

    // 2. ตรวจสอบคลังและคำนวณการตัดสต็อก
    for (let item of recipeIngredients) {
      const [userIng]: any = await connection.query(
        "SELECT amount FROM user_ingredient WHERE u_id = ? AND ing_id = ?",
        [uid, item.ing_id],
      );

      if (userIng.length === 0 || userIng[0].amount < item.amount) {
        throw new Error("วัตถุดิบไม่เพียงพอ");
      }

      const newAmount = userIng[0].amount - item.amount;
      if (newAmount === 0) {
        await connection.query(
          "DELETE FROM user_ingredient WHERE u_id = ? AND ing_id = ?",
          [uid, item.ing_id],
        );
      } else {
        await connection.query(
          "UPDATE user_ingredient SET amount = ? WHERE u_id = ? AND ing_id = ?",
          [newAmount, uid, item.ing_id],
        );
      }
    }

    await connection.commit();
    res
      .status(200)
      .json({ message: "ปรุงอาหารสำเร็จ! วัตถุดิบถูกตัดเรียบร้อย" });
  } catch (err: any) {
    await connection.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    connection.release();
  }
});
