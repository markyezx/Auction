const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config();

// สร้าง transporter สำหรับการเชื่อมต่อ SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === "true", // ใช้ true สำหรับ port 465 (SSL), false สำหรับ port 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ฟังก์ชันสำหรับส่งอีเมลยืนยัน
async function sendVerificationEmail(email, username, token) {
  try {
    const verificationLink = `http://localhost:3000/auth/verify?token=${token}`;

    const htmlMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; padding: 20px; background-color: #fefefe;">
        <div style="text-align: center; background-color:rgb(241, 91, 42); padding: 15px; border-radius: 10px 10px 0 0; color: white;">
          <h2>ยืนยันอีเมลของคุณเพื่อเริ่มใช้งาน <span style="color: #fff700;">AuctionUfa99</span></h2>
        </div>
        <div style="padding: 20px; color: #333;">
          <p>เรียน <strong>${username}</strong>,</p>
          <p>ขอแสดงความยินดี! การสมัครสมาชิกของคุณกับ <strong>AuctionUfa99</strong> เสร็จสมบูรณ์แล้ว เหลืออีกเพียงขั้นตอนเดียวเท่านั้นเพื่อเริ่มใช้งาน กรุณายืนยันอีเมลของคุณ</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="background-color:rgb(241, 91, 42); color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-size: 16px;">ยืนยันอีเมล</a>
          </div>
          <p>หลังจากยืนยันอีเมล คุณสามารถเริ่มต้นใช้งานได้ทันที</p>
          <p>หากคุณไม่ได้สมัครสมาชิกนี้ กรุณาเพิกเฉยต่ออีเมลนี้ หรือแจ้งทีมสนับสนุนของเราได้ที่ <a href="mailto:support@AuctionUfa99.com" style="color: #f15b2a;">support@AuctionUfa99.com</a></p>
        </div>
        <div style="text-align: center; background-color: #f9f9f9; padding: 10px; border-radius: 0 0 10px 10px; color: #999;">
          <p>ขอบคุณที่เลือกใช้บริการของเรา</p>
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: `"AuctionUfa99" <${process.env.SMTP_FROM}>`,
      to: email,
      subject: "ยืนยันอีเมล - AuctionUfa99",
      html: htmlMessage,
    });

    console.log(`Verification email sent: ${info.messageId}`);
    return { success: true, message: "Verification email sent successfully" };
  } catch (error) {
    console.error("Error sending verification email:", error.message);
    return { success: false, message: error.message };
  }
}

// ฟังก์ชันสำหรับส่งอีเมลรีเซ็ตรหัสผ่าน
async function sendPasswordResetEmail(email, resetLink) {
  try {
    const htmlMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; padding: 20px; background-color: #fefefe;">
        <div style="text-align: center; background-color:rgb(243, 168, 47); padding: 15px; border-radius: 10px 10px 0 0; color: white;">
          <h2>รีเซ็ตรหัสผ่านของคุณ</h2>
        </div>
        <div style="padding: 20px; color: #333;">
          <p>เรียน <strong>ผู้ใช้งาน</strong>,</p>
          <p>เราได้รับคำขอให้รีเซ็ตรหัสผ่านของคุณ หากคุณไม่ได้เป็นผู้ส่งคำขอนี้ กรุณาเพิกเฉยต่ออีเมลนี้</p>
          <p>หากคุณต้องการเปลี่ยนรหัสผ่าน กรุณาคลิกปุ่มด้านล่าง:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color:rgb(243, 168, 47); color: white; text-decoration: none; padding: 12px 20px; border-radius: 5px; font-size: 16px;">รีเซ็ตรหัสผ่าน</a>
          </div>
          <p>หากปุ่มด้านบนไม่ทำงาน คุณสามารถใช้ลิงก์ด้านล่างนี้:</p>
          <p style="word-break: break-word;"><a href="${resetLink}" style="color:rgb(241, 164, 77);">${resetLink}</a></p>
          <p>ลิงก์นี้จะหมดอายุใน 30 นาทีเพื่อความปลอดภัย</p>
        </div>
        <div style="text-align: center; background-color: #f9f9f9; padding: 10px; border-radius: 0 0 10px 10px; color: #999;">
          <p>ขอบคุณที่ใช้บริการของเรา</p>
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: `"AuctionUfa99" <${process.env.SMTP_FROM}>`,
      to: email,
      subject: "รีเซ็ตรหัสผ่าน - AuctionUfa99",
      html: htmlMessage,
    });

    console.log(`Password reset email sent: ${info.messageId}`);
    return { success: true, message: "Password reset email sent successfully" };
  } catch (error) {
    console.error("Error sending password reset email:", error.message);
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
  sendPasswordResetEmail,
  verifySMTP,
};
