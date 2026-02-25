const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000; // متوافق مع Render

// ==== إعدادات الأمان وبيانات الدخول ====
const VALID_ACCESS_CODE = "12345";
const VALID_PASSWORD = "exam2025";
const ADMIN_PASSWORD = "272703"; 

// ==== Middlewares ====
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: "secret-key-123",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 90 * 60 * 1000 } 
}));

app.use(express.static(path.join(__dirname, "public")));

// ================= مسارات الطالب (Student Routes) =================

app.post("/start", (req, res) => {
    const { studentName, accessCode, password } = req.body;

    if (!studentName || studentName.trim() === "") {
        return res.json({ success: false, message: "يرجى إدخال اسمك الكامل" });
    }

    if (accessCode !== VALID_ACCESS_CODE || password !== VALID_PASSWORD) {
        return res.json({ success: false, message: "رمز الدخول أو كلمة السر غير صحيحة" });
    }

    // ملاحظة: تم إيقاف فحص التقديم المسبق لضمان دخول الجميع بدون مشاكل تقنية
    
    req.session.authenticated = true;
    req.session.studentName = studentName.trim();
    req.session.startTime = Date.now();
    req.session.ip = req.ip;

    res.json({ success: true });
});

app.get("/exam.html", (req, res) => {
    if (!req.session.authenticated) {
        return res.redirect("/"); 
    }
    res.sendFile(path.join(__dirname, "public", "exam.html"));
});

app.post("/submit", (req, res) => {
    if (!req.session.authenticated) {
        return res.status(401).json({ success: false, message: "انتهت الجلسة" });
    }

    const submission = {
        studentName: req.session.studentName,
        ip: req.session.ip,
        date: new Date().toLocaleString("en-US", { timeZone: "Asia/Amman" }),
        answers: req.body.answers
    };

    let submissions = [];
    if (fs.existsSync("submissions.json")) {
        const content = fs.readFileSync("submissions.json", "utf8");
        submissions = content ? JSON.parse(content) : [];
    }

    submissions.push(submission);
    fs.writeFileSync("submissions.json", JSON.stringify(submissions, null, 2));

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

app.post("/admin-login", (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.redirect("/dashboard");
    } else {
        res.send("Wrong Password! <a href='/admin'>Try again</a>");
    }
});

app.get("/dashboard", (req, res) => {
    if (!req.session.isAdmin) return res.redirect("/admin");

    let submissions = [];
    if (fs.existsSync("submissions.json")) {
        const content = fs.readFileSync("submissions.json", "utf8");
        submissions = content ? JSON.parse(content) : [];
    }

    let html = `
        <style>
            table { width: 85%; margin: 20px auto; border-collapse: collapse; font-family: Arial; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #007bff; color: white; }
            .btn { text-decoration: none; background: #28a745; color: white; padding: 6px 12px; border-radius: 4px; }
            .btn-del { background: #dc3545; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
        </style>
        <h1 style="text-align:center; font-family:Arial;">Student Submissions</h1>
        
        <div style="text-align:center; margin-bottom: 20px;">
            <form method="POST" action="/clear-all" onsubmit="return confirm('هل أنت متأكد من مسح جميع النتائج؟')">
                <button type="submit" class="btn-del">تصفير كافة الإجابات (Delete All)</button>
            </form>
        </div>

        <table>
            <tr>
                <th>Student Name</th>
                <th>Date & Time</th>
                <th>Action</th>
            </tr>
    `;

    submissions.forEach((sub, index) => {
        html += `
            <tr>
                <td>${sub.studentName}</td>
                <td>${sub.date}</td>
                <td><a href="/view/${index}" class="btn">View Details</a></td>
            </tr>
        `;
    });

    html += `</table><div style="text-align:center; margin-top:20px;"><a href="/">Home</a></div>`;
    res.send(html);
});

// مسار مسح البيانات
app.post("/clear-all", (req, res) => {
    if (!req.session.isAdmin) return res.status(403).send("Unauthorized");
    fs.writeFileSync("submissions.json", JSON.stringify([], null, 2));
    res.redirect("/dashboard");
});

app.get("/view/:id", (req, res) => {
    if (!req.session.isAdmin) return res.redirect("/admin");
    const submissions = JSON.parse(fs.readFileSync("submissions.json", "utf8"));
    const sub = submissions[req.params.id];

    let html = `<div style="font-family:Arial; padding:20px; max-width:600px; margin:auto; border:1px solid #ddd;">
        <h2>Student: ${sub.studentName}</h2>
        <p>Date: ${sub.date}</p><hr/>`;
    
    for (let q in sub.answers) {
        html += `<p><b>${q.replace('q','Question ')}:</b> ${sub.answers[q]}</p>`;
    }
    
    html += `<br><a href="/dashboard">Back</a></div>`;
    res.send(html);
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
