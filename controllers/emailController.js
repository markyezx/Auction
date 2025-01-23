const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config();

// สร้าง transporter สำหรับการเชื่อมต่อ SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ฟังก์ชันสำหรับส่งอีเมลยืนยัน
async function sendVerificationEmail(email, username, token) {
  try {
    // สร้างข้อความ HTML สำหรับอีเมลยืนยัน
    const htmlMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; padding: 20px; background-color: #fefefe;">
        <div style="text-align: center; background-color: #f15b2a; padding: 15px; border-radius: 10px 10px 0 0; color: white;">
          <h2>ยืนยันอีเมลของคุณเพื่อเริ่มใช้งาน <span style="color: #fff700;">AuctionUfa99</span></h2>
        </div>
        <div style="padding: 20px; color: #333;">
          <p>เรียน <strong>${username}</strong>,</p>
          <p>ขอแสดงความยินดี! การสมัครสมาชิกของคุณกับ <strong>AuctionUfa99</strong> เสร็จสมบูรณ์แล้ว เหลืออีกเพียงขั้นตอนเดียวเท่านั้นเพื่อเริ่มใช้งาน กรุณายืนยันอีเมลของคุณ</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="http://localhost:5000/auth/verify?token=${token}" style="background-color: #f15b2a; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-size: 16px;">ยืนยันอีเมล</a>
          </div>
          <p>หลังจากยืนยันอีเมล คุณสามารถเริ่มต้นใช้งานได้ทันที</p>
          <p>หากคุณไม่ได้สมัครสมาชิกนี้ กรุณาเพิกเฉยต่ออีเมลนี้ หรือแจ้งทีมสนับสนุนของเราได้ที่ <a href="mailto:support@AuctionUfa99.com" style="color: #f15b2a;">support@AuctionUfa99.com</a> หรือโทร [เบอร์โทร]</p>
        </div>
        <div style="text-align: center; background-color: #f9f9f9; padding: 10px; border-radius: 0 0 10px 10px; color: #999;">
          <p>ขอบคุณที่เลือกใช้บริการของเรา</p>
        </div>
      </div>
    `;

    // ส่งอีเมล
    const info = await transporter.sendMail({
      from: `"AuctionUfa99" <${process.env.SMTP_FROM}>`, // ชื่อและอีเมลผู้ส่ง
      to: email, // ผู้รับ
      subject: "ยืนยันอีเมล - AuctionUfa99", // หัวข้อ
      html: htmlMessage, // ข้อความ HTML
    });

    console.log(`Verification email sent: ${info.messageId}`);
    return { success: true, message: "Verification email sent successfully" };
  } catch (error) {
    console.error("Error sending verification email:", error.message);
    return { success: false, message: error.message };
  }
}

// ทดสอบการเชื่อมต่อ SMTP
const verifySMTP = () => {
  transporter.verify((error, success) => {
    if (error) {
      console.error("SMTP verification failed:", error.message);
    } else {
      console.log("SMTP server is ready to send emails");
    }
  });
};

// เรียกใช้ฟังก์ชันทดสอบ SMTP
verifySMTP();

module.exports = {
  sendVerificationEmail,
  verifySMTP,
};
