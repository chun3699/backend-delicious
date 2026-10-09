"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtAuthen = exports.secret = void 0;
exports.generateToken = generateToken;
const express_jwt_1 = require("express-jwt");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// 1. ดึงรหัสลับจาก .env หรือใช้ค่าเริ่มต้น
exports.secret = process.env.JWT_SECRET || "this-is-top-secret";
// 2. ตั้งค่ายามส่วนกลาง (Global Middleware)
exports.jwtAuthen = (0, express_jwt_1.expressjwt)({
    secret: exports.secret,
    algorithms: ["HS256"],
    requestProperty: "user" // 💡 สำคัญ: บรรทัดนี้จะทำให้เราดึงข้อมูลผ่าน req.user ได้เหมือนเดิมครับ
}).unless({
    // 📌 ระบุเส้นทางที่ "คนนอก" เข้าได้โดยไม่ต้องมี Token
    path: [
        "/login", // ต้องปล่อยผ่านให้คนล็อกอิน
        "/add", // ต้องปล่อยให้คนสมัครสมาชิก
        "/google-login"
    ],
});
// 3. ฟังก์ชันสำหรับสร้าง Token
function generateToken(payload) {
    const token = jsonwebtoken_1.default.sign(payload, exports.secret, {
        expiresIn: "30d", // อายุ 30 วัน (ปรับได้ตามต้องการ)
        issuer: "MyProject" // ชื่อระบบที่ออกบัตร
    });
    return token;
}
//# sourceMappingURL=auth.js.map