import { expressjwt, Request as JWTRequest } from "express-jwt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

// 1. ดึงรหัสลับจาก .env หรือใช้ค่าเริ่มต้น
export const secret = process.env.JWT_SECRET || "this-is-top-secret";

// 2. ตั้งค่ายามส่วนกลาง (Global Middleware)
export const jwtAuthen = expressjwt({
  secret: secret,
  algorithms: ["HS256"],
  requestProperty: "user" // 💡 สำคัญ: บรรทัดนี้จะทำให้เราดึงข้อมูลผ่าน req.user ได้เหมือนเดิมครับ
}).unless({
  // 📌 ระบุเส้นทางที่ "คนนอก" เข้าได้โดยไม่ต้องมี Token
  path: [
    "/login",           // ต้องปล่อยผ่านให้คนล็อกอิน
    "/add",        // ต้องปล่อยให้คนสมัครสมาชิก
    "/google-login"
  ],
});

// 3. ฟังก์ชันสำหรับสร้าง Token
export function generateToken(payload: any): string {
  const token: string = jwt.sign(payload, secret, {
    expiresIn: "30d",     // อายุ 30 วัน (ปรับได้ตามต้องการ)
    issuer: "MyProject"   // ชื่อระบบที่ออกบัตร
  });
  return token;
}