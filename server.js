const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

// ==== إعدادات الأمان وبيانات الدخول ====
const VALID_ACCESS_CODE = "12345";
const VALID_PASSWORD = "exam2025";
const ADMIN_PASSWORD = "272703"; 

// ==== Middlewares ====
// ضروري جداً لقراءة البيانات المرسلة من fetch في index.html و script.js
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// إعداد الجلسات (Sessions) لتتبع الطالب أثناء الامتحان
app.use(session({
    secret: "secret-key-123",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 90 * 60 * 1000 } // تنتهي الجلسة بعد 90 دقيقة (مدة الامتحان)
}));

// تحديد مجلد الملفات الثابتة (الصور، التنسيق، الـ HTML)
app.use(express.static(path.join(__dirname, "public")));

// ================= مسارات الطالب (Student Routes) =================

// 1. تسجيل الدخول وبدء الامتحان
app.post("/start", (req, res) => {
    const { studentName, accessCode, password } = req.body;
    const userIP = req.ip;

    // التأكد من إدخال الإسم
    if (!studentName || studentName.trim() === "") {
        return res.json({ success: false, message: "يرجى إدخال اسمك الكامل" });
    }

    // التأكد من الكود وكلمة السر
    if (accessCode !== VALID_ACCESS_CODE || password !== VALID_PASSWORD) {
        return res.json({ success: false, message: "رمز الدخول أو كلمة السر غير صحيحة" });
    }

    // فحص إذا كان الطالب قد قدم الامتحان مسبقاً (بناءً على الإسم أو الـ IP)
 let submissions = [];
    if (fs.existsSync("submissions.json")) {
        const fileContent = fs.readFileSync("submissions.json", "utf8");
        // التأكد أن الملف ليس فارغاً قبل محاولة تحويله
        if (fileContent.trim() !== "") {
            try {
                submissions = JSON.parse(fileContent);
            } catch (err) {
                console.error("Error parsing JSON:", err);
                submissions = []; // في حال وجود خلل في التنسيق، ابدأ بمصفوفة فارغة
            }
        }
    }

    const alreadySubmitted = submissions.find(s => 
        s.studentName === studentName.trim() || s.ip === userIP
    );

    if (alreadySubmitted) {
        return res.json({ success: false, message: "لقد قمت بتقديم هذا الامتحان مسبقاً." });
    }

    // إنشاء جلسة ناجحة
    req.session.authenticated = true;
    req.session.studentName = studentName.trim();
    req.session.startTime = Date.now();
    req.session.ip = userIP;

    res.json({ success: true });
});

// 2. حماية صفحة الامتحان (منع الدخول المباشر عبر الرابط)
app.get("/exam.html", (req, res) => {
    if (!req.session.authenticated) {
        return res.redirect("/"); // إذا لم يسجل دخول، ارجعه للرئيسية
    }
    res.sendFile(path.join(__dirname, "public", "exam.html"));
});

// 3. استقبال وحفظ الإجابات
app.post("/submit", (req, res) => {
    if (!req.session.authenticated) {
        return res.status(401).json({ success: false, message: "انتهت الجلسة أو غير مسموح بالدخول" });
    }

    const submission = {
        studentName: req.session.studentName,
        ip: req.session.ip,
        date: new Date().toLocaleString("en-US", { timeZone: "Asia/Amman" }),
        answers: req.body.answers
    };

    let submissions = [];
    if (fs.existsSync("submissions.json")) {
        submissions = JSON.parse(fs.readFileSync("submissions.json"));
    }

    submissions.push(submission);
    fs.writeFileSync("submissions.json", JSON.stringify(submissions, null, 2));

    // إنهاء الجلسة بعد التسليم بنجاح لمنع إعادة الدخول
    req.session.destroy();

    res.json({ success: true });
});

// ================= مسارات المسؤول (Admin Routes) =================

app.get("/admin", (req, res) => {
    res.send(`
        <div style="text-align:center; margin-top:50px; font-family:Arial;">
            <h2>Admin Login</h2>
            <form method="POST" action="/admin-login">
                <input type="password" name="password" placeholder="Password" style="padding:10px;" required/>
                <button type="submit" style="padding:10px 20px; cursor:pointer;">Login</button>
            </form>
        </div>
    `);
});

// ================= مسارات المسؤول (Admin Routes) =================

// صفحة تسجيل دخول الأدمن
app.get("/admin", (req, res) => {
    res.send(`
        <div style="text-align:center; margin-top:50px; font-family:Arial;">
            <h2>Admin Login</h2>
            <form method="POST" action="/admin-login">
                <input type="password" name="password" placeholder="Password" style="padding:10px;" required/>
                <button type="submit" style="padding:10px 20px; cursor:pointer;">Login</button>
            </form>
        </div>
    `);
});

// معالجة دخول الأدمن
app.post("/admin-login", (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.redirect("/dashboard");
    } else {
        res.send("Wrong Password! <a href='/admin'>Try again</a>");
    }
});

// لوحة عرض نتائج الطلاب
app.get("/dashboard", (req, res) => {
    if (!req.session.isAdmin) return res.redirect("/admin");

    let submissions = [];
    if (fs.existsSync("submissions.json")) {
        const fileContent = fs.readFileSync("submissions.json", "utf8");
        if (fileContent.trim()) { // التأكد أن الملف ليس فارغاً
            try {
                submissions = JSON.parse(fileContent);
            } catch (e) {
                console.error("Error parsing submissions.json:", e);
                submissions = [];
            }
        }
    }

    let html = `
        <style>
            table { width: 85%; margin: 20px auto; border-collapse: collapse; font-family: Arial; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #007bff; color: white; }
            tr:nth-child(even) { background-color: #f2f2f2; }
            .btn { text-decoration: none; background: #28a745; color: white; padding: 6px 12px; border-radius: 4px; font-size: 14px; }
            .btn:hover { background: #218838; }
        </style>
        <h1 style="text-align:center; font-family:Arial; color:#333;">Student Submissions Dashboard</h1>
        <table>
            <tr>
                <th>Student Name</th>
                <th>IP Address</th>
                <th>Date & Time</th>
                <th>Action</th>
            </tr>
    `;

    if (submissions.length === 0) {
        html += `<tr><td colspan="4" style="text-align:center;">No submissions found yet.</td></tr>`;
    } else {
        submissions.forEach((sub, index) => {
            html += `
                <tr>
                    <td>${sub.studentName}</td>
                    <td>${sub.ip}</td>
                    <td>${sub.date}</td>
                    <td><a href="/view/${index}" class="btn">View Details</a></td>
                </tr>
            `;
        });
    }

    html += `</table><div style="text-align:center; margin-top:20px;"><a href="/" style="font-family:Arial;">Logout/Home</a></div>`;
    res.send(html);
});

// عرض إجابات طالب محدد
app.get("/view/:id", (req, res) => {
    if (!req.session.isAdmin) return res.redirect("/admin");

    if (!fs.existsSync("submissions.json")) return res.send("No submissions file found.");

    const submissions = JSON.parse(fs.readFileSync("submissions.json", "utf8"));
    const sub = submissions[req.params.id];

    if (!sub) return res.send("Submission details not found.");

    let html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; line-height: 1.6; max-width: 900px; margin: 20px auto; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); background: #fff; border: 1px solid #eaeaea;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #007bff; padding-bottom: 15px; margin-bottom: 20px;">
                <h2 style="color: #007bff; margin: 0;">Details for: ${sub.studentName}</h2>
                <span style="background: #e7f3ff; color: #007bff; padding: 5px 15px; border-radius: 20px; font-size: 0.9em; font-weight: bold;">IP: ${sub.ip}</span>
            </div>
            
            <p style="color: #666; font-size: 0.95em;"><strong>Submission Date:</strong> ${sub.date}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            
            <h3 style="color: #333; margin-bottom: 20px;">Exam Answers:</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px;">
    `;
    
    for (let questionKey in sub.answers) {
        // تحويل q1 إلى Question 1
        let questionLabel = questionKey.replace('q', 'Question ');
        let answerValue = sub.answers[questionKey];

        html += `
            <div style="background: #fdfdfd; padding: 15px; border: 1px solid #eee; border-left: 5px solid #28a745; border-radius: 6px; transition: 0.3s;">
                <div style="font-weight: bold; color: #555; margin-bottom: 5px; font-size: 0.85em; text-transform: uppercase;">${questionLabel}</div>
                <div style="font-size: 1.2em; color: #28a745; font-weight: bold;">Answer: ${answerValue}</div>
            </div>
        `;
    }

    html += `
            </div>
            <div style="margin-top: 40px; text-align: center;">
                <a href="/dashboard" style="display: inline-block; padding: 12px 30px; background: #6c757d; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; transition: background 0.3s;">Back to Dashboard</a>
            </div>
        </div>
    `;
    res.send(html);
});

// ==== تشغيل السيرفر ====
app.listen(PORT, () => {
    console.log(`\x1b[32m%s\x1b[0m`, `✅ Exam server is active at http://localhost:${PORT}`);
    console.log(`\x1b[34m%s\x1b[0m`, `📊 Admin dashboard available at http://localhost:${PORT}/admin`);
});