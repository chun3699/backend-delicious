import { createPool } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config(); // โหลดค่าจากไฟล์ .env

export const conn = createPool({
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