"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.conn = void 0;
const promise_1 = require("mysql2/promise");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config(); // โหลดค่าจากไฟล์ .env
exports.conn = (0, promise_1.createPool)({
    connectionLimit: 10,
    host: '194.59.164.133',
    user: 'u528477660_food',
    // ✅ เปลี่ยนให้ตรงกับในไฟล์ .env
    password: 'k8jP*2S4=f/ePg#O',
    database: 'u528477660_food',
    // ช่วยป้องกันการหลุด (ETIMEDOUT)
    waitForConnections: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});
// DB_HOST=191.101.230.103
// DB_USER=u528477660_food
// DB_PASSWORD=k8jP*2S4=f/ePg#O
// DB_NAME=u528477660_food
//# sourceMappingURL=dbconnect.js.map