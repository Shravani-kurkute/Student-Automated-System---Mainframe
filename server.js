// server.js - Complete Updated Version
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const ibmdb = require("ibm_db");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

const app = express();
app.use(cors());

// increase payload for base64 images
app.use(bodyParser.json({ limit: "30mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "30mb" }));

// frontend folder
app.use(express.static(path.join(__dirname, "frontend")));

// DB2 connection
const connStr =
  "DATABASE=MYDB;HOSTNAME=localhost;UID=db2admin;PWD=Shraw@0816;PORT=50000;PROTOCOL=TCPIP";

let db;
ibmdb
  .open(connStr)
  .then((conn) => {
    db = conn;
    console.log("✅ Connected to DB2 database");
  })
  .catch((err) => console.error("❌ DB2 Connection Error:", err));

// ------------------------------------------------------
// CLEAN FUNCTION (REMOVES EMOJI + NON-ASCII)
// ------------------------------------------------------
const clean = (str) =>
  (str || "").replace(/[^\x00-\x7F]/g, ""); // remove emoji + non-ASCII chars

// ------------------------------------------------------
// LOGIN
// ------------------------------------------------------
app.post("/login", (req, res) => {
  const { email, password, role } = req.body;
  const table =
    role === "teacher" ? "teacher" : role === "admin" ? "admin" : "student";

  ibmdb.open(connStr, (err, conn) => {
    if (err) return res.status(500).send("DB2 connection failed");

    const query = `SELECT * FROM ${table} WHERE EMAIL='${email}' AND PASSWORD='${password}'`;

    conn.query(query, (err, data) => {
      conn.close();

      if (err) return res.status(500).send("Query failed");
      if (data.length === 0) return res.status(401).send("Invalid credentials");

      res.json({ message: "Login successful", user: data[0] });
    });
  });
});

// ------------------------------------------------------
// STUDENT DETAILS
// ------------------------------------------------------
app.get("/students/:id", async (req, res) => {
  try {
    const id = clean(req.params.id.trim());
    const result = await db.query(
      `SELECT * FROM student WHERE TRIM(STUDENT_ID)='${id}'`
    );

    if (result.length === 0) return res.status(404).send("Student not found");

    res.json(result[0]);
  } catch (err) {
    res.status(500).send("Database error");
  }
});

// ------------------------------------------------------
// FRONTEND ROUTES
// ------------------------------------------------------
const studentPages = [
  "student_dashboard.html",
  "student_courses.html",
  "student_marks.html",
  "student_performance.html",
  "student_attendance.html",
  "student_notices.html",
  "student_settings.html",
  "student_profile.html",
  "student_timetable.html",
];

studentPages.forEach((file) => {
  const route = file.replace("student_", "").replace(".html", "");
  app.get(`/student/${route}`, (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "student", file));
  });
});

// ------------------------------------------------------
// COURSES LIST
// ------------------------------------------------------
app.get("/courses/:dept", async (req, res) => {
  try {
    const dept = clean(req.params.dept);
    const result = await db.query(
      `SELECT * FROM course WHERE TRIM(DEPARTMENT)='${dept}'`
    );
    res.json(result);
  } catch (err) {
    res.status(500).send("DB error");
  }
});

// ------------------------------------------------------
// MARKS LIST (FOR STUDENTS)
// ------------------------------------------------------
app.get("/marks/:studentId", async (req, res) => {
  try {
    const sid = clean(req.params.studentId);
    const sres = await db.query(
      `SELECT DEPARTMENT FROM student WHERE TRIM(STUDENT_ID)='${sid}'`
    );
    if (sres.length === 0) return res.status(404).send("Student not found");

    const dept = clean(sres[0].DEPARTMENT);

    const query = `
      SELECT c.COURSE_ID, c.COURSE_NAME, c.CREDITS, c.DEPARTMENT,
             COALESCE(m.MARKS, 0) AS MARKS
      FROM course c
      LEFT JOIN marks m ON c.COURSE_ID = m.COURSE_ID AND m.STUDENT_ID='${sid}'
      WHERE TRIM(c.DEPARTMENT)='${dept}'
    `;

    const result = await db.query(query);
    res.json(result);
  } catch (err) {
    res.status(500).send("DB error");
  }
});

// =============================================================
// 📅 STUDENT TIMETABLE ROUTE
// Add this to your server.js file
// =============================================================

app.get("/timetable/:studentId", async (req, res) => {
  try {
    const sid = req.params.studentId.trim();
    console.log("📅 Fetching timetable for student:", sid);

    // Get student's department
    const sres = await db.query(
      `SELECT DEPARTMENT FROM student WHERE TRIM(STUDENT_ID)='${sid}'`
    );
    
    if (sres.length === 0) {
      console.log("❌ Student not found:", sid);
      return res.status(404).send("Student not found");
    }

    const dept = sres[0].DEPARTMENT.trim();
    console.log("✅ Student department:", dept);

    // Get timetable for this department
    const query = `
      SELECT 
        t.DAY, 
        t.TIME_SLOT, 
        c.COURSE_NAME, 
        t.ROOM, 
        t.FACULTY_NAME
      FROM timetable t
      JOIN course c ON TRIM(t.COURSE_ID) = TRIM(c.COURSE_ID)
      WHERE TRIM(t.DEPARTMENT)='${dept}'
      ORDER BY 
        CASE t.DAY
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
          WHEN 'Sunday' THEN 7
        END,
        t.TIME_SLOT
    `;

    const result = await db.query(query);
    console.log("✅ Found", result.length, "timetable entries");
    
    res.json(result);

  } catch (err) {
    console.error("❌ Timetable error:", err);
    console.error("Error details:", err.message);
    res.status(500).send("DB error: " + err.message);
  }
});

// =============================================================
// VERIFY YOUR TIMETABLE TABLE STRUCTURE
// =============================================================

/*
Your table structure should look like this:

CREATE TABLE timetable (
  TIMETABLE_ID INTEGER PRIMARY KEY,
  DEPARTMENT VARCHAR(50),
  COURSE_ID VARCHAR(20),
  DAY VARCHAR(20),
  TIME_SLOT VARCHAR(20),
  ROOM VARCHAR(20),
  FACULTY_NAME VARCHAR(50)
);

Sample data (as you have):
INSERT INTO timetable VALUES
(1, 'Computer Science', 'CS101', 'Monday', '09:00-10:00', 'R101', 'Dr. Sharma'),
(2, 'Computer Science', 'CS102', 'Monday', '10:00-11:00', 'R101', 'Prof. Mehta'),
(3, 'Computer Science', 'CS103', 'Monday', '11:00-12:00', 'R102', 'Dr. Rao');
*/

// =============================================================
// TESTING QUERIES
// =============================================================

/*
-- Test 1: Check timetable data
SELECT * FROM timetable;

-- Test 2: Check if COURSE_ID exists in course table
SELECT t.*, c.COURSE_NAME 
FROM timetable t
LEFT JOIN course c ON TRIM(t.COURSE_ID) = TRIM(c.COURSE_ID);

-- Test 3: Get timetable for specific department
SELECT 
  t.DAY, 
  t.TIME_SLOT, 
  c.COURSE_NAME, 
  t.ROOM, 
  t.FACULTY_NAME
FROM timetable t
JOIN course c ON TRIM(t.COURSE_ID) = TRIM(c.COURSE_ID)
WHERE TRIM(t.DEPARTMENT)='Computer Science';

-- Test 4: Check for data issues
SELECT 
  TIMETABLE_ID,
  DEPARTMENT,
  COURSE_ID,
  LENGTH(DEPARTMENT) as DEPT_LENGTH,
  LENGTH(COURSE_ID) as COURSE_LENGTH
FROM timetable;
*/

// ------------------------------------------------------
// COURSES PDF
// ------------------------------------------------------
app.get("/download/courses/:studentId", async (req, res) => {
  try {
    const sid = clean(req.params.studentId);

    const sres = await db.query(
      `SELECT * FROM student WHERE TRIM(STUDENT_ID)='${sid}'`
    );
    if (sres.length === 0) return res.status(404).send("Student not found");

    const student = sres[0];
    const dept = clean(student.DEPARTMENT);

    const courses = await db.query(
      `SELECT * FROM course WHERE TRIM(DEPARTMENT)='${dept}' ORDER BY COURSE_ID`
    );

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const newPage = () => pdf.addPage([600, 900]);
    let page = newPage();
    let y = 840;

    // Header
    page.drawText("Student Course Report", {
      x: 180,
      y,
      size: 18,
      font: bold,
    });
    y -= 30;

    page.drawText(`Student ID: ${sid}`, { x: 40, y, size: 12, font });
    page.drawText(`Name: ${clean(student.NAME)}`, { x: 250, y, size: 12, font });
    y -= 18;

    page.drawText(`Department: ${dept}`, { x: 40, y, size: 12, font });
    y -= 25;

    // Table Header
    page.drawText("Course ID", { x: 40, y, font: bold, size: 11 });
    page.drawText("Course Name", { x: 130, y, font: bold, size: 11 });
    page.drawText("Credits", { x: 450, y, font: bold, size: 11 });

    y -= 25;

    // Table Rows
    let totalCredits = 0;

    for (const c of courses) {
      if (y < 100) {
        page = newPage();
        y = 840;

        page.drawText("Course ID", { x: 40, y, font: bold, size: 11 });
        page.drawText("Course Name", { x: 130, y, font: bold, size: 11 });
        page.drawText("Credits", { x: 450, y, font: bold, size: 11 });
        y -= 25;
      }

      page.drawText(clean(c.COURSE_ID), { x: 40, y, size: 10, font });
      page.drawText(clean(c.COURSE_NAME), { x: 130, y, size: 10, font });
      page.drawText(String(c.CREDITS), { x: 450, y, size: 10, font });

      totalCredits += Number(c.CREDITS);
      y -= 22;
    }

    // Summary Section
    if (y < 140) {
      page = newPage();
      y = 840;
    }

    y -= 20;
    page.drawText(`Total Courses: ${courses.length}`, {
      x: 40,
      y,
      size: 12,
      font: bold,
    });
    y -= 20;

    page.drawText(`Total Credits: ${totalCredits}`, {
      x: 40,
      y,
      size: 12,
      font: bold,
    });

    const bytes = await pdf.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=courses_${sid}.pdf`
    );
    res.send(Buffer.from(bytes));
  } catch (err) {
    console.error("Error generating courses PDF:", err);
    res.status(500).send("Error generating courses PDF");
  }
});

// ------------------------------------------------------
// ATTENDANCE PDF
// ------------------------------------------------------
app.post("/download/attendance", async (req, res) => {
  try {
    const {
      studentId,
      studentName,
      department,
      attendanceData,
      overallPercent,
      remarks,
      chartImage,
    } = req.body;

    if (!studentId || !Array.isArray(attendanceData))
      return res.status(400).send("Invalid payload");

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const newPage = () => pdf.addPage([600, 900]);

    let page = newPage();
    let y = 840;

    // Header
    page.drawText("Student Attendance Report", {
      x: 160,
      y,
      size: 18,
      font: bold,
    });
    y -= 30;

    page.drawText(`Student ID: ${clean(studentId)}`, {
      x: 40,
      y,
      size: 12,
      font,
    });
    page.drawText(`Name: ${clean(studentName)}`, {
      x: 250,
      y,
      size: 12,
      font,
    });
    y -= 18;

    page.drawText(`Department: ${clean(department)}`, {
      x: 40,
      y,
      size: 12,
      font,
    });
    page.drawText(`Overall: ${clean(overallPercent)}`, {
      x: 250,
      y,
      size: 12,
      font,
    });
    y -= 25;

    // Chart Image
    if (chartImage) {
      const base64 = chartImage.split(",")[1];
      let img;

      try {
        img = await pdf.embedPng(Buffer.from(base64, "base64"));
      } catch {
        img = await pdf.embedJpg(Buffer.from(base64, "base64"));
      }

      const scaled = img.scale(0.60);

      page.drawImage(img, {
        x: 60,
        y: y - scaled.height,
        width: scaled.width,
        height: scaled.height,
      });

      y = y - scaled.height - 30;
    }

    // Table Header
    page.drawText("Code", { x: 40, y, size: 11, font: bold });
    page.drawText("Subject", { x: 120, y, size: 11, font: bold });
    page.drawText("Total", { x: 380, y, size: 11, font: bold });
    page.drawText("Attended", { x: 450, y, size: 11, font: bold });
    page.drawText("Percent", { x: 520, y, size: 11, font: bold });

    y -= 25;

    // Table Rows
    for (const a of attendanceData) {
      if (y < 100) {
        page = newPage();
        y = 840;

        page.drawText("Code", { x: 40, y, size: 11, font: bold });
        page.drawText("Subject", { x: 120, y, size: 11, font: bold });
        page.drawText("Total", { x: 380, y, size: 11, font: bold });
        page.drawText("Attended", { x: 450, y, size: 11, font: bold });
        page.drawText("Percent", { x: 520, y, size: 11, font: bold });

        y -= 25;
      }

      const percent =
        a.total > 0
          ? ((a.attended / a.total) * 100).toFixed(1) + "%"
          : "0%";

      page.drawText(clean(a.code), { x: 40, y, size: 10, font });
      page.drawText(clean(a.name), { x: 120, y, size: 10, font });
      page.drawText(String(a.total), { x: 380, y, size: 10, font });
      page.drawText(String(a.attended), { x: 450, y, size: 10, font });
      page.drawText(percent, { x: 520, y, size: 10, font });

      y -= 22;
    }

    // Summary
    if (y < 140) {
      page = newPage();
      y = 840;
    }

    y -= 20;

    page.drawText(`Total Subjects: ${attendanceData.length}`, {
      x: 40,
      y,
      size: 12,
      font: bold,
    });
    y -= 20;

    page.drawText(`Overall Attendance: ${clean(overallPercent)}`, {
      x: 40,
      y,
      size: 12,
      font: bold,
    });
    y -= 20;

    page.drawText(`Remarks: ${clean(remarks)}`, {
      x: 40,
      y,
      size: 12,
      font: bold,
    });

    const bytes = await pdf.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=attendance_${studentId}.pdf`
    );
    res.send(Buffer.from(bytes));
  } catch (err) {
    console.error("Error generating attendance PDF:", err);
    res.status(500).send("Error generating attendance PDF");
  }
});

// ------------------------------------------------------
// MARKS PDF
// ------------------------------------------------------
app.post("/download/marks", async (req, res) => {
  try {
    const {
      studentId,
      studentName,
      department,
      marks,
      avg,
      grade,
      result,
      chartImage,
    } = req.body;

    if (!studentId || !Array.isArray(marks))
      return res.status(400).send("Invalid payload");

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const newPage = () => pdf.addPage([600, 900]);

    let page = newPage();
    let y = 840;

    // Header
    page.drawText("Student Marks Report", {
      x: 180,
      y,
      size: 18,
      font: bold,
    });
    y -= 30;

    page.drawText(`Student ID: ${clean(studentId)}`, {
      x: 40,
      y,
      size: 12,
      font,
    });
    page.drawText(`Name: ${clean(studentName)}`, {
      x: 250,
      y,
      size: 12,
      font,
    });
    y -= 18;

    page.drawText(`Department: ${clean(department)}`, {
      x: 40,
      y,
      size: 12,
      font,
    });
    page.drawText(`Average: ${clean(avg)}`, {
      x: 250,
      y,
      size: 12,
      font,
    });
    y -= 22;

    // Chart Image
    if (chartImage) {
      const base64 = chartImage.split(",")[1];
      let img;

      try {
        img = await pdf.embedPng(Buffer.from(base64, "base64"));
      } catch {
        img = await pdf.embedJpg(Buffer.from(base64, "base64"));
      }

      const dims = img.scale(0.65);
      page.drawImage(img, {
        x: 60,
        y: y - dims.height,
        width: dims.width,
        height: dims.height,
      });

      y = y - dims.height - 30;
    }

    // Table header
    const headerY = y;
    page.drawText("Course ID", { x: 40, y: headerY, size: 11, font: bold });
    page.drawText("Course Name", { x: 130, y: headerY, size: 11, font: bold });
    page.drawText("Credits", { x: 420, y: headerY, size: 11, font: bold });
    page.drawText("Marks", { x: 500, y: headerY, size: 11, font: bold });

    y -= 25;

    // Table Rows
    marks.forEach((m) => {
      if (y < 100) {
        page = newPage();
        y = 840;

        page.drawText("Course ID", { x: 40, y, size: 11, font: bold });
        page.drawText("Course Name", {
          x: 130,
          y,
          size: 11,
          font: bold,
        });
        page.drawText("Credits", { x: 420, y, size: 11, font: bold });
        page.drawText("Marks", { x: 500, y, size: 11, font: bold });

        y -= 25;
      }

      page.drawText(clean(m.COURSE_ID), { x: 40, y, font, size: 10 });
      page.drawText(clean(m.COURSE_NAME), { x: 130, y, font, size: 10 });
      page.drawText(String(m.CREDITS), { x: 420, y, font, size: 10 });
      page.drawText(String(m.MARKS), { x: 500, y, font, size: 10 });

      y -= 22;
    });

    // Summary
    if (y < 140) {
      page = newPage();
      y = 840;
    }

    y -= 10;
    page.drawText(`Total Subjects: ${marks.length}`, {
      x: 40,
      y,
      font: bold,
      size: 12,
    });
    y -= 18;
    page.drawText(`Average Marks: ${clean(avg)}`, {
      x: 40,
      y,
      font: bold,
      size: 12,
    });
    y -= 18;
    page.drawText(`Final Grade: ${clean(grade)}`, {
      x: 40,
      y,
      font: bold,
      size: 12,
    });
    y -= 18;
    page.drawText(`Result: ${clean(result)}`, {
      x: 40,
      y,
      font: bold,
      size: 12,
    });

    // Output
    const bytes = await pdf.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=marks_${studentId}.pdf`
    );

    res.send(Buffer.from(bytes));
  } catch (err) {
    console.error("Error generating marks PDF:", err);
    res.status(500).send("Error generating marks PDF");
  }
});

// ------------------------------------------------------
// PERFORMANCE PDF
// ------------------------------------------------------
app.post("/download/performance", async (req, res) => {
  try {
    const { studentId, studentName, dept, chart1, chart2, chart3 } = req.body;

    // Validate payload
    if (!studentId || !studentName || !dept) {
      return res.status(400).send("Invalid payload - missing student details");
    }

    // Validate images
    const charts = [chart1, chart2, chart3];
    for (let i = 0; i < charts.length; i++) {
      if (!charts[i] || !charts[i].startsWith("data:image/")) {
        return res.status(400).send("Invalid or missing chart images");
      }
    }

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const newPage = () => pdf.addPage([600, 900]);

    let page = newPage();
    let y = 840;

    // ---------- HEADER ----------
    page.drawText("Student Performance Report", {
      x: 155,
      y,
      size: 20,
      font: bold,
    });

    y -= 40;

    page.drawText(`Student ID: ${clean(studentId)}`, { x: 40, y, size: 12, font });
    page.drawText(`Name: ${clean(studentName)}`, { x: 300, y, size: 12, font });

    y -= 20;
    page.drawText(`Department: ${clean(dept)}`, { x: 40, y, size: 12, font });

    y -= 40;

    // ---------- FUNCTION TO ADD CHART ----------
    async function addChart(imageBase64, titleText) {
      let image;

      const base64 = imageBase64.split(",")[1];
      const buffer = Buffer.from(base64, "base64");

      try {
        if (imageBase64.startsWith("data:image/png")) {
          image = await pdf.embedPng(buffer);
        } else {
          image = await pdf.embedJpg(buffer);
        }
      } catch (err) {
        console.log("⚠️ Chart embedding failed. Reason:", err);
        return; // Skip image instead of corrupting PDF
      }

      const dims = image.scale(0.55);

      // Start new page if space is less
      if (y - dims.height < 80) {
        page = newPage();
        y = 840;
      }

      page.drawText(titleText, { x: 40, y, size: 14, font: bold });
      y -= 20;

      page.drawImage(image, {
        x: 40,
        y: y - dims.height,
        width: dims.width,
        height: dims.height,
      });

      y -= dims.height + 35;
    }

    // ---------- INSERT 3 CHARTS ----------
    await addChart(chart1, "Marks by Subject");
    await addChart(chart2, "Average Marks Trend");
    await addChart(chart3, "Grade Distribution");

    // ---------- SAVE & SEND PDF ----------
    const pdfBytes = await pdf.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=performance_${studentId}.pdf`
    );

    res.send(Buffer.from(pdfBytes));

  } catch (err) {
    console.error("❌ Error generating performance PDF:", err);
    res.status(500).send("Error generating performance PDF");
  }
});

// =============================================================
// 🎯 TEACHER ROUTES (CLEAN & WORKING VERSION)
// =============================================================

// 1️⃣ Get teacher details
app.get("/teacher/:teacherId", async (req, res) => {
  try {
    const tid = clean(req.params.teacherId);

    const rows = await db.query(`
      SELECT * FROM teacher 
      WHERE TRIM(TEACHER_ID)='${tid}'
    `);

    if (rows.length === 0)
      return res.status(404).json({ error: "Teacher not found" });

    res.json(rows[0]);
  } catch (err) {
    console.error("Teacher fetch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 2️⃣ Get students in teacher's department
app.get("/teacher/students/:teacherId", async (req, res) => {
  try {
    const tid = clean(req.params.teacherId);

    const trows = await db.query(`
      SELECT DEPARTMENT FROM teacher 
      WHERE TRIM(TEACHER_ID)='${tid}'
    `);

    if (!trows.length)
      return res.status(404).json({ error: "Teacher not found" });

    const dept = trows[0].DEPARTMENT.trim();

    const students = await db.query(`
      SELECT STUDENT_ID, NAME
      FROM student
      WHERE TRIM(DEPARTMENT)='${dept}'
      ORDER BY NAME
    `);

    res.json(students);
  } catch (err) {
    console.error("Students load error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 3️⃣ Get courses in teacher's department
app.get("/teacher/courses/:teacherId", async (req, res) => {
  try {
    const tid = clean(req.params.teacherId);

    const trows = await db.query(`
      SELECT DEPARTMENT FROM teacher 
      WHERE TRIM(TEACHER_ID)='${tid}'
    `);

    if (!trows.length)
      return res.status(404).json({ error: "Teacher not found" });

    const dept = trows[0].DEPARTMENT.trim();

    const courses = await db.query(`
      SELECT COURSE_ID, COURSE_NAME, CREDITS
      FROM course
      WHERE TRIM(DEPARTMENT)='${dept}'
      ORDER BY COURSE_NAME
    `);

    res.json(courses);
  } catch (err) {
    console.error("Courses load error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 4️⃣ Get all marks for teacher's department (for display table)
app.get("/teacher/marks/:teacherId", async (req, res) => {
  try {
    const tid = clean(req.params.teacherId);

    const trows = await db.query(`
      SELECT DEPARTMENT FROM teacher 
      WHERE TRIM(TEACHER_ID)='${tid}'
    `);

    if (!trows.length)
      return res.status(404).json({ error: "Teacher not found" });

    const dept = trows[0].DEPARTMENT.trim();

    const marks = await db.query(`
      SELECT 
        s.STUDENT_ID,
        s.NAME AS STUDENT_NAME,
        c.COURSE_ID,
        c.COURSE_NAME,
        COALESCE(m.MARKS, 0) AS MARKS
      FROM student s
      CROSS JOIN course c
      LEFT JOIN marks m 
        ON m.STUDENT_ID = s.STUDENT_ID 
        AND m.COURSE_ID = c.COURSE_ID
      WHERE TRIM(s.DEPARTMENT)='${dept}'
        AND TRIM(c.DEPARTMENT)='${dept}'
      ORDER BY s.NAME, c.COURSE_NAME
    `);

    res.json(marks);
  } catch (err) {
    console.error("Teacher marks load error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 5️⃣ Insert or Update marks (UPSERT)
app.post("/teacher/marks", async (req, res) => {
  try {
    const { student_id, course_id, marks } = req.body;

    if (!student_id || !course_id || marks === undefined)
      return res.status(400).json({ error: "Missing required fields" });

    // Validate marks range
    if (marks < 0 || marks > 100)
      return res.status(400).json({ error: "Marks must be between 0 and 100" });

    // Check if record exists
    const existing = await db.query(`
      SELECT 1 FROM marks
      WHERE TRIM(STUDENT_ID)='${student_id.trim()}'
      AND TRIM(COURSE_ID)='${course_id.trim()}'
    `);

    if (existing.length) {
      // UPDATE existing record
      await db.query(`
        UPDATE marks 
        SET MARKS=${Number(marks)}
        WHERE TRIM(STUDENT_ID)='${student_id.trim()}'
        AND TRIM(COURSE_ID)='${course_id.trim()}'
      `);
    } else {
      // INSERT new record
      await db.query(`
        INSERT INTO marks (STUDENT_ID, COURSE_ID, MARKS)
        VALUES ('${student_id.trim()}', '${course_id.trim()}', ${Number(marks)})
      `);
    }

    res.json({ message: "Marks saved successfully" });
  } catch (err) {
    console.error("Marks update error:", err);
    res.status(500).json({ error: "Failed to save marks" });
  }
});

// =============================================================
// 📋 ATTENDANCE ROUTES FOR TEACHERS (WITH DEBUG LOGGING)
// =============================================================

// 6️⃣ Get all attendance records for teacher's department
app.get("/teacher/attendance/:teacherId", async (req, res) => {
  try {
    const tid = clean(req.params.teacherId);
    console.log("📋 Fetching attendance for teacher:", tid);

    // Get teacher's department
    const trows = await db.query(`
      SELECT DEPARTMENT FROM teacher 
      WHERE TRIM(TEACHER_ID)='${tid}'
    `);

    if (!trows.length) {
      console.log("❌ Teacher not found:", tid);
      return res.status(404).json({ error: "Teacher not found" });
    }

    const dept = trows[0].DEPARTMENT.trim();
    console.log("✅ Teacher department:", dept);

    // Try to get attendance records
    console.log("📋 Fetching attendance records for department:", dept);
    
    const attendance = await db.query(`
      SELECT 
        a.STUDENT_ID,
        s.NAME AS STUDENT_NAME,
        a.COURSE_ID,
        c.COURSE_NAME,
        a.DATE,
        a.STATUS
      FROM attendance a
      JOIN student s ON TRIM(a.STUDENT_ID) = TRIM(s.STUDENT_ID)
      JOIN course c ON TRIM(a.COURSE_ID) = TRIM(c.COURSE_ID)
      WHERE TRIM(s.DEPARTMENT)='${dept}'
        AND TRIM(c.DEPARTMENT)='${dept}'
      ORDER BY a.DATE DESC, s.NAME
    `);

    console.log("✅ Found", attendance.length, "attendance records");
    res.json(attendance);

  } catch (err) {
    console.error("❌ Teacher attendance load error:", err);
    console.error("Error details:", err.message);
    res.status(500).json({ 
      error: "Server error", 
      details: err.message 
    });
  }
});

// 7️⃣ Insert or Update attendance (UPSERT with better logging)
app.post("/teacher/attendance", async (req, res) => {
  try {
    const { student_id, course_id, date, status } = req.body;
    console.log("📝 Saving attendance:", { student_id, course_id, date, status });

    // Validation
    if (!student_id || !course_id || !date || !status) {
      console.log("❌ Missing fields");
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate status
    if (status !== "Present" && status !== "Absent") {
      console.log("❌ Invalid status:", status);
      return res.status(400).json({ error: "Status must be Present or Absent" });
    }

    // Check if record exists
    const existing = await db.query(`
      SELECT 1 FROM attendance
      WHERE TRIM(STUDENT_ID)='${student_id.trim()}'
      AND TRIM(COURSE_ID)='${course_id.trim()}'
      AND DATE='${date}'
    `);

    if (existing.length) {
      console.log("🔄 Updating existing attendance record");
      // UPDATE existing record
      await db.query(`
        UPDATE attendance 
        SET STATUS='${status}'
        WHERE TRIM(STUDENT_ID)='${student_id.trim()}'
        AND TRIM(COURSE_ID)='${course_id.trim()}'
        AND DATE='${date}'
      `);
    } else {
      console.log("➕ Inserting new attendance record");
      // INSERT new record
      await db.query(`
        INSERT INTO attendance (STUDENT_ID, COURSE_ID, DATE, STATUS)
        VALUES ('${student_id.trim()}', '${course_id.trim()}', '${date}', '${status}')
      `);
    }

    console.log("✅ Attendance saved successfully");
    res.json({ message: "Attendance saved successfully" });

  } catch (err) {
    console.error("❌ Attendance update error:", err);
    console.error("Error details:", err.message);
    res.status(500).json({ 
      error: "Failed to save attendance",
      details: err.message 
    });
  }
});

// =============================================================
// 📊 STUDENT ATTENDANCE ROUTES (WITH DEBUG LOGGING)
// =============================================================

// Get attendance for a specific student
app.get("/attendance/:studentId", async (req, res) => {
  try {
    const sid = clean(req.params.studentId);
    console.log("📊 Fetching attendance for student:", sid);
    
    const sres = await db.query(
      `SELECT DEPARTMENT FROM student WHERE TRIM(STUDENT_ID)='${sid}'`
    );
    
    if (sres.length === 0) {
      console.log("❌ Student not found:", sid);
      return res.status(404).send("Student not found");
    }

    const dept = clean(sres[0].DEPARTMENT);
    console.log("✅ Student department:", dept);

    const query = `
      SELECT 
        c.COURSE_ID,
        c.COURSE_NAME,
        COUNT(a.STATUS) as TOTAL_CLASSES,
        SUM(CASE WHEN a.STATUS = 'Present' THEN 1 ELSE 0 END) as ATTENDED
      FROM course c
      LEFT JOIN attendance a 
        ON TRIM(c.COURSE_ID) = TRIM(a.COURSE_ID)
        AND TRIM(a.STUDENT_ID) = '${sid}'
      WHERE TRIM(c.DEPARTMENT)='${dept}'
      GROUP BY c.COURSE_ID, c.COURSE_NAME
      ORDER BY c.COURSE_NAME
    `;

    const result = await db.query(query);
    console.log("✅ Found attendance for", result.length, "courses");
    res.json(result);

  } catch (err) {
    console.error("❌ Student attendance error:", err);
    console.error("Error details:", err.message);
    res.status(500).send("DB error: " + err.message);
  }
});

// =============================================================
// 📄 TEACHER MARKS PDF DOWNLOAD
// =============================================================

app.post("/download/teacher-marks", async (req, res) => {
  try {
    const { teacherName, department, marksData, generatedDate } = req.body;

    if (!teacherName || !department || !Array.isArray(marksData)) {
      return res.status(400).send("Invalid payload");
    }

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const newPage = () => pdf.addPage([842, 595]); // A4 Landscape
    let page = newPage();
    let y = 540;

    // ========== HEADER ==========
    page.drawText("Student Marks Report", {
      x: 320,
      y,
      size: 20,
      font: bold,
      color: rgb(0.298, 0.431, 0.961) // #4c6ef5
    });

    y -= 30;

    // Teacher Info
    page.drawText(`Teacher: ${clean(teacherName)}`, {
      x: 50,
      y,
      size: 12,
      font: bold
    });

    page.drawText(`Department: ${clean(department)}`, {
      x: 350,
      y,
      size: 12,
      font: bold
    });

    page.drawText(`Generated: ${generatedDate}`, {
      x: 650,
      y,
      size: 12,
      font: bold
    });

    y -= 35;

    // ========== TABLE HEADER ==========
    const headerY = y;
    const colX = {
      studentId: 50,
      studentName: 140,
      courseId: 320,
      courseName: 420,
      marks: 650,
      status: 730
    };

    // Header background
    page.drawRectangle({
      x: 40,
      y: headerY - 5,
      width: 762,
      height: 25,
      color: rgb(0.945, 0.953, 0.961) // #f1f3f5
    });

    // Header text
    page.drawText("Student ID", { x: colX.studentId, y: headerY + 5, size: 11, font: bold });
    page.drawText("Student Name", { x: colX.studentName, y: headerY + 5, size: 11, font: bold });
    page.drawText("Course ID", { x: colX.courseId, y: headerY + 5, size: 11, font: bold });
    page.drawText("Course Name", { x: colX.courseName, y: headerY + 5, size: 11, font: bold });
    page.drawText("Marks", { x: colX.marks, y: headerY + 5, size: 11, font: bold });
    page.drawText("Status", { x: colX.status, y: headerY + 5, size: 11, font: bold });

    y = headerY - 25;

    // ========== TABLE ROWS ==========
    let rowCount = 0;
    let totalMarks = 0;
    let passCount = 0;
    let failCount = 0;

    for (const row of marksData) {
      // Check if we need a new page
      if (y < 100) {
        page = newPage();
        y = 540;

        // Redraw header on new page
        page.drawRectangle({
          x: 40,
          y: y - 5,
          width: 762,
          height: 25,
          color: rgb(0.945, 0.953, 0.961)
        });

        page.drawText("Student ID", { x: colX.studentId, y: y + 5, size: 11, font: bold });
        page.drawText("Student Name", { x: colX.studentName, y: y + 5, size: 11, font: bold });
        page.drawText("Course ID", { x: colX.courseId, y: y + 5, size: 11, font: bold });
        page.drawText("Course Name", { x: colX.courseName, y: y + 5, size: 11, font: bold });
        page.drawText("Marks", { x: colX.marks, y: y + 5, size: 11, font: bold });
        page.drawText("Status", { x: colX.status, y: y + 5, size: 11, font: bold });

        y -= 25;
      }

      // Alternate row background
      if (rowCount % 2 === 0) {
        page.drawRectangle({
          x: 40,
          y: y - 5,
          width: 762,
          height: 20,
          color: rgb(0.973, 0.976, 0.980) // #f8f9fa
        });
      }

      // Row data
      const marks = Number(row.MARKS);
      const status = marks >= 40 ? "Pass" : "Fail";
      
      page.drawText(clean(row.STUDENT_ID), { x: colX.studentId, y, size: 10, font });
      page.drawText(clean(row.STUDENT_NAME).substring(0, 20), { x: colX.studentName, y, size: 10, font });
      page.drawText(clean(row.COURSE_ID), { x: colX.courseId, y, size: 10, font });
      page.drawText(clean(row.COURSE_NAME).substring(0, 25), { x: colX.courseName, y, size: 10, font });
      page.drawText(String(marks), { x: colX.marks, y, size: 10, font: bold });
      
      page.drawText(status, { 
        x: colX.status, 
        y, 
        size: 10, 
        font: bold,
        color: marks >= 40 ? rgb(0.169, 0.541, 0.243) : rgb(0.788, 0.165, 0.165) // green or red
      });

      totalMarks += marks;
      if (marks >= 40) passCount++;
      else failCount++;

      y -= 22;
      rowCount++;
    }

    // ========== SUMMARY SECTION ==========
    if (y < 150) {
      page = newPage();
      y = 540;
    }

    y -= 30;

    // Summary box
    page.drawRectangle({
      x: 40,
      y: y - 70,
      width: 762,
      height: 85,
      borderColor: rgb(0.298, 0.431, 0.961),
      borderWidth: 2
    });

    page.drawText("Summary Statistics", {
      x: 50,
      y: y - 20,
      size: 14,
      font: bold,
      color: rgb(0.298, 0.431, 0.961)
    });

    const avgMarks = marksData.length > 0 ? (totalMarks / marksData.length).toFixed(2) : 0;

    page.drawText(`Total Records: ${marksData.length}`, { x: 50, y: y - 40, size: 11, font });
    page.drawText(`Average Marks: ${avgMarks}`, { x: 250, y: y - 40, size: 11, font });
    page.drawText(`Pass: ${passCount}`, { x: 450, y: y - 40, size: 11, font, color: rgb(0.169, 0.541, 0.243) });
    page.drawText(`Fail: ${failCount}`, { x: 600, y: y - 40, size: 11, font, color: rgb(0.788, 0.165, 0.165) });

    // ========== FOOTER ==========
    const pages = pdf.getPages();
    pages.forEach((pg, idx) => {
      pg.drawText(`Page ${idx + 1} of ${pages.length}`, {
        x: 380,
        y: 30,
        size: 9,
        font,
        color: rgb(0.5, 0.5, 0.5)
      });

      pg.drawText("© 2025 Student Automated System", {
        x: 320,
        y: 15,
        size: 9,
        font,
        color: rgb(0.5, 0.5, 0.5)
      });
    });

    // ========== SAVE & SEND ==========
    const pdfBytes = await pdf.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=teacher_marks_${department}_${new Date().toISOString().split('T')[0]}.pdf`
    );

    res.send(Buffer.from(pdfBytes));

  } catch (err) {
    console.error("❌ Error generating teacher marks PDF:", err);
    res.status(500).send("Error generating teacher marks PDF");
  }
});


// =============================================================
// 📋 FIXED ATTENDANCE ROUTES FOR TEACHERS
// Add this to your server.js file (replace existing attendance routes)
// =============================================================

// 1️⃣ Get all attendance records for teacher's department
app.get("/teacher/attendance/:teacherId", async (req, res) => {
  try {
    const tid = req.params.teacherId.trim();
    console.log("📋 Fetching attendance for teacher:", tid);

    // Get teacher's department
    const trows = await db.query(`
      SELECT DEPARTMENT FROM teacher 
      WHERE TRIM(TEACHER_ID)='${tid}'
    `);

    if (!trows.length) {
      console.log("❌ Teacher not found:", tid);
      return res.status(404).json({ error: "Teacher not found" });
    }

    const dept = trows[0].DEPARTMENT.trim();
    console.log("✅ Teacher department:", dept);

    // Get attendance records with JOIN to get student and course names
    console.log("📋 Fetching attendance records for department:", dept);
    
    const attendance = await db.query(`
      SELECT 
        a.STUDENT_ID,
        s.NAME AS STUDENT_NAME,
        a.COURSE_ID,
        c.COURSE_NAME,
        a.DATE,
        a.STATUS
      FROM attendance a
      JOIN student s ON TRIM(a.STUDENT_ID) = TRIM(s.STUDENT_ID)
      JOIN course c ON TRIM(a.COURSE_ID) = TRIM(c.COURSE_ID)
      WHERE TRIM(s.DEPARTMENT)='${dept}'
        AND TRIM(c.DEPARTMENT)='${dept}'
      ORDER BY a.DATE DESC, s.NAME
    `);

    console.log("✅ Found", attendance.length, "attendance records");
    res.json(attendance);

  } catch (err) {
    console.error("❌ Teacher attendance load error:", err);
    console.error("Error details:", err.message);
    res.status(500).json({ 
      error: "Server error", 
      details: err.message 
    });
  }
});

// 2️⃣ Insert or Update attendance (UPSERT)
app.post("/teacher/attendance", async (req, res) => {
  try {
    const { student_id, course_id, date, status } = req.body;
    console.log("📝 Saving attendance:", { student_id, course_id, date, status });

    // Validation
    if (!student_id || !course_id || !date || !status) {
      console.log("❌ Missing fields");
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate status
    if (status !== "Present" && status !== "Absent") {
      console.log("❌ Invalid status:", status);
      return res.status(400).json({ error: "Status must be Present or Absent" });
    }

    // Check if record exists
    const existing = await db.query(`
      SELECT 1 FROM attendance
      WHERE TRIM(STUDENT_ID)='${student_id.trim()}'
      AND TRIM(COURSE_ID)='${course_id.trim()}'
      AND DATE='${date}'
    `);

    if (existing.length) {
      console.log("🔄 Updating existing attendance record");
      // UPDATE existing record
      await db.query(`
        UPDATE attendance 
        SET STATUS='${status}'
        WHERE TRIM(STUDENT_ID)='${student_id.trim()}'
        AND TRIM(COURSE_ID)='${course_id.trim()}'
        AND DATE='${date}'
      `);
    } else {
      console.log("➕ Inserting new attendance record");
      // INSERT new record
      await db.query(`
        INSERT INTO attendance (STUDENT_ID, COURSE_ID, DATE, STATUS)
        VALUES ('${student_id.trim()}', '${course_id.trim()}', '${date}', '${status}')
      `);
    }

    console.log("✅ Attendance saved successfully");
    res.json({ message: "Attendance saved successfully" });

  } catch (err) {
    console.error("❌ Attendance update error:", err);
    console.error("Error details:", err.message);
    res.status(500).json({ 
      error: "Failed to save attendance",
      details: err.message 
    });
  }
});

// =============================================================
// 📊 STUDENT ATTENDANCE ROUTE (for student view)
// =============================================================

// Get attendance for a specific student
app.get("/attendance/:studentId", async (req, res) => {
  try {
    const sid = req.params.studentId.trim();
    console.log("📊 Fetching attendance for student:", sid);
    
    const sres = await db.query(
      `SELECT DEPARTMENT FROM student WHERE TRIM(STUDENT_ID)='${sid}'`
    );
    
    if (sres.length === 0) {
      console.log("❌ Student not found:", sid);
      return res.status(404).send("Student not found");
    }

    const dept = sres[0].DEPARTMENT.trim();
    console.log("✅ Student department:", dept);

    const query = `
      SELECT 
        c.COURSE_ID,
        c.COURSE_NAME,
        COUNT(a.STATUS) as TOTAL_CLASSES,
        SUM(CASE WHEN a.STATUS = 'Present' THEN 1 ELSE 0 END) as ATTENDED
      FROM course c
      LEFT JOIN attendance a 
        ON TRIM(c.COURSE_ID) = TRIM(a.COURSE_ID)
        AND TRIM(a.STUDENT_ID) = '${sid}'
      WHERE TRIM(c.DEPARTMENT)='${dept}'
      GROUP BY c.COURSE_ID, c.COURSE_NAME
      ORDER BY c.COURSE_NAME
    `;

    const result = await db.query(query);
    console.log("✅ Found attendance for", result.length, "courses");
    res.json(result);

  } catch (err) {
    console.error("❌ Student attendance error:", err);
    console.error("Error details:", err.message);
    res.status(500).send("DB error: " + err.message);
  }
});

// =============================================================
// IMPORTANT: Make sure your attendance table exists with this structure:
// CREATE TABLE attendance (
//   STUDENT_ID VARCHAR(20),
//   COURSE_ID VARCHAR(20),
//   DATE DATE,
//   STATUS VARCHAR(10),
//   PRIMARY KEY (STUDENT_ID, COURSE_ID, DATE)
// );
// =============================================================

// ------------------------------------------------------
app.get("/", (req, res) => {
  res.send("🚀 Student Automated System Backend Running...");
});

const PORT = 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);