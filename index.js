const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const { Pool } = require("pg");

let db = new Pool({
  user: "postgres",
  host: "127.0.0.1",
  database: "File_app",
  password: "metrosathak@1234",
  port: 5432,
});

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: "http://localhost:3001",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type"],
  })
);

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const { description } = req.body;
    const filename = req.file.originalname;
    const pathname = `/uploads/${req.file.filename}`; 

    const result = await db.query(
      `INSERT INTO files (filename, pathname, description) 
       VALUES ($1, $2, $3) RETURNING *`,
      [filename, pathname, description]
    );

    res.json({
      message: "File uploaded successfully!",
      file: result.rows[0],
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Upload failed", error: err });
  }
});


app.get("/files", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM files ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch files", error: err });
  }
});


app.get("/files/:id/download", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query("SELECT * FROM files WHERE id = $1", [id]);

    if (result.rows.length === 0){
    return res.status(404).json({ message: "File not found" });
    }
    const file = result.rows[0];
    const filePath = path.join(__dirname, file.pathname.replace("/uploads/", "uploads/"));

    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found on server" });

    res.download(filePath, file.filename);
  } catch (err) {
    res.status(500).json({ message: "Failed to download file", error: err });
  }
});


app.delete("/files/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query("SELECT * FROM files WHERE id = $1", [id]);

    if (result.rows.length === 0) return res.status(404).json({ message: "File not found" });

    const file = result.rows[0];
    const filePath = path.join(__dirname, file.pathname.replace("/uploads/", "uploads/"));

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await db.query("DELETE FROM files WHERE id = $1", [id]);

    res.json({ message: "File deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete file", error: err });
  }
});


app.put("/files/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { filename, description } = req.body;

    const result = await db.query(
      "UPDATE files SET filename = $1, description = $2 WHERE id = $3 RETURNING *",
      [filename, description, id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ message: "File not found" });

    res.json({ message: "File updated successfully", file: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: "Failed to update file", error: err });
  }
});


app.use("/uploads", express.static(uploadDir));

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
