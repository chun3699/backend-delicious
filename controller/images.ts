import express from "express";
import { conn } from "../dbconnect";
import util from "util";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import dotenv from "dotenv";

dotenv.config();

export const queryAsync = util.promisify(conn.query).bind(conn);
export const router = express.Router();

// ==========================================
// ตั้งค่าการเชื่อมต่อ Cloudinary
// ==========================================
// cloudinary.config({
//   // 🔒 แนะนำให้กลับไปใช้ process.env เพื่อซ่อนรหัสนะครับ
//    cloud_name: process.env.CLOUDINARY_CLOUD_NAME as string, 
//    api_key: process.env.CLOUDINARY_API_KEY as string, 
//    api_secret: process.env.CLOUDINARY_API_SECRET as string 
// });

cloudinary.config({
  // 🔒 แนะนำให้กลับไปใช้ process.env เพื่อซ่อนรหัสนะครับ
   cloud_name: "dnwitdqnu", 
   api_key: "198461149261175", 
   api_secret: "ZaoWFIXaBHiVZZq1PW7tbQGNwZM" 
});

// ==========================================
// ตั้งค่า Multer + ใส่การปรับแต่ง (Transformation) ตามโค้ดต้นแบบ
// ==========================================
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'ProjectFinal',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    
    // ✨ สิ่งที่เพิ่มเข้ามาจากโค้ดต้นแบบของคุณ!
    transformation: [
      { 
        crop: 'auto',     // ตัดขอบอัตโนมัติให้พอดี
        gravity: 'auto',  // ให้ AI เลือกจุดโฟกัสภาพตรงกลางอัตโนมัติ
        fetch_format: 'auto', // แปลงนามสกุลไฟล์ให้โหลดเร็วที่สุด (เช่น WebP)
        quality: 'auto'       // บีบอัดขนาดไฟล์โดยที่ภาพยังชัดอยู่
      }
    ]
  } as any 
});

const upload = multer({ storage: storage });

// ==========================================
// API อัปโหลดรูปภาพอย่างเดียว (POST /upload-image)
// ==========================================
router.post("/upload-image", (req, res) => {
  
  // 1. นำ upload มาเรียกใช้ข้างในนี้แทน
  const uploadMiddleware = upload.single('image');

  uploadMiddleware(req, res, async function (err) {
    // 2. ดักจับ Error จาก Multer หรือ Cloudinary โดยตรง
    if (err) {
      console.error("❌ เกิดข้อผิดพลาดจาก Multer หรือ Cloudinary:", err);
      return res.status(500).json({ 
        error: "อัปโหลดไม่สำเร็จ โปรดเช็คการตั้งค่า Cloudinary หรือไฟล์รูปภาพ",
        details: err.message || err // พ่นข้อความ Error ของจริงออกไปที่ Postman
      });
    }

    try {
      // 3. ถ้าผ่านการอัปโหลดมาได้ ค่อยทำงานต่อ (โค้ดเหมือนเดิม)
      if (!req.file) {
        return res.status(400).json({ error: "กรุณาแนบไฟล์รูปภาพมาด้วย" });
      }

      const originalUrl = req.file.path;
      const publicId = req.file.filename; 

      const optimizeUrl = cloudinary.url(publicId, {
          fetch_format: 'auto',
          quality: 'auto'
      });

      res.status(200).json({ 
        message: "อัปโหลดรูปภาพสำเร็จ",
        urls: {
          original: originalUrl,
          optimized: optimizeUrl
        }
      });

    } catch (error) {
      console.error("❌ Upload Image Logic Error:", error);
      res.status(500).json({ error: "เกิดข้อผิดพลาดในการประมวลผลรูปภาพ" });
    }
  });
});

function extractPublicId(imageUrl: string) {
  // 1. ตัดแยกด้วยเครื่องหมาย /
  const parts = imageUrl.split('/'); 
  
  // 2. เอา 2 ท่อนสุดท้ายมาต่อกัน (จะได้ "ProjectFinal/my_image.jpg")
  const folderAndFile = parts.slice(-2).join('/'); 
  
  // 3. ตัดนามสกุลไฟล์ (.jpg, .png) ทิ้งไป
  const publicId = folderAndFile.split('.')[0]; 
  
  return publicId; // ผลลัพธ์: "ProjectFinal/my_image"
}

// ==========================================
// API ลบรูปภาพออกจาก Cloudinary (DELETE /delete-image)
// ==========================================
router.delete("/delete-image", async (req, res) => {
  try {
    // 1. รับค่า public_id จาก Frontend (หรือดึงมาจาก URL)
    const { public_id } = req.body;

    if (!public_id) {
      return res.status(400).json({ error: "กรุณาส่ง public_id ของรูปภาพที่ต้องการลบ" });
    }

    const targetPublicId : any = extractPublicId(public_id);
    // 2. ใช้คำสั่ง destroy ของ cloudinary เพื่อลบรูป
    const result = await cloudinary.uploader.destroy(targetPublicId);

    // 3. เช็คผลลัพธ์ว่าลบสำเร็จหรือไม่
    if (result.result === 'ok') {
      return res.status(200).json({ 
        message: "ลบรูปภาพออกจาก Cloudinary สำเร็จเรียบร้อย",
        details: result 
      });
    } else {
      // กรณีหาไฟล์ไม่เจอ (อาจจะถูกลบไปแล้ว หรือ public_id ผิด)
      return res.status(404).json({ 
        error: "หาไฟล์ไม่เจอ หรือไฟล์ถูกลบไปแล้ว",
        details: result 
      });
    }

  } catch (error) {
    console.error("❌ Delete Image Error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการลบรูปภาพ" });
  }
});