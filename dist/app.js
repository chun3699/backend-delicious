"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("./controller/user");
const ingredient_1 = require("./controller/ingredient");
const food_1 = require("./controller/food");
const foodmark_1 = require("./controller/foodmark");
const images_1 = require("./controller/images");
const uability_1 = require("./controller/uability");
const auth_1 = require("./controller/middleware/auth");
exports.app = (0, express_1.default)();
const body_parser_1 = __importDefault(require("body-parser"));
const os = __importStar(require("os"));
const cors_1 = __importDefault(require("cors"));
exports.app.use(body_parser_1.default.text());
exports.app.use(body_parser_1.default.json());
exports.app.use((0, cors_1.default)({
    origin: "*", // หรือกำหนด domain frontend
    methods: ["GET", "POST", "PUT", "DELETE"],
}));
exports.app.use(express_1.default.json());
// ==========================================
// 🛡️ 1. นำยามมาเฝ้าประตู (เรียกใช้ Global Middleware)
// ==========================================
exports.app.use(auth_1.jwtAuthen);
// ==========================================
// 🚨 2. ดักจับ Error กรณียามจับได้ว่าคนนอกแอบเข้า (Unauthorized)
// ==========================================
exports.app.use((err, req, res, next) => {
    if (err.name === "UnauthorizedError") {
        // ส่ง Status 401 กลับไป พร้อมข้อความแจ้งเตือน
        return res.status(401).json({
            error: "Access Denied. ไม่มีสิทธิ์เข้าถึง กรุณาแนบ Token (Bearer) หรือล็อกอินใหม่"
        });
    }
    next(err);
});
//controller 
exports.app.use("/", user_1.router);
exports.app.use("/ingredient", ingredient_1.router);
exports.app.use("/food", food_1.router);
exports.app.use("/foodmark", foodmark_1.router);
exports.app.use("/images", images_1.router);
exports.app.use("/uability", uability_1.router);
// หา IP ของเครื่อง
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) {
                return iface.address;
            }
        }
    }
    return "localhost";
}
const localIP = getLocalIP();
const PORT = 3000;
//คำสั่งรันserver npx nodemon server.ts
const port = process.env.PORT || 3000; // Render จะส่ง PORT มาให้ หรือถ้าไม่มีให้ใช้ 3000
exports.app.listen(Number(port), '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});
//# sourceMappingURL=app.js.map