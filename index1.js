import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";

dotenv.config();

const db = neon(process.env.DATABASE_URL);

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: 'http://localhost:3001',
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type"],
  })
);

const uploadDir = path.join(process.cwd(), "uploads");
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

    const result = await db`
      INSERT INTO files (filename, pathname, description)
      VALUES (${filename}, ${pathname}, ${description})
      RETURNING *;
    `;

    res.json({
      message: "File uploaded successfully!",
      file: result[0],
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
});

app.get("/files", async (req, res) => {
  try {
    const result = await db`SELECT * FROM files ORDER BY id;`;
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch files", error: err.message });
  }
});

app.get("/files/:id/download", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db`SELECT * FROM files WHERE id = ${id};`;

    if (result.length === 0) {
      return res.status(404).json({ message: "File not found" });
    }

    const file = result[0];
    const filePath = path.join(process.cwd(), file.pathname.replace("/uploads/", "uploads/"));

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    res.download(filePath, file.filename);
  } catch (err) {
    res.status(500).json({ message: "Failed to download file", error: err.message });
  }
});

app.delete("/files/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db`SELECT * FROM files WHERE id = ${id};`;

    if (result.length === 0) {
      return res.status(404).json({ message: "File not found" });
    }

    const file = result[0];
    const filePath = path.join(process.cwd(), file.pathname.replace("/uploads/", "uploads/"));

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await db`DELETE FROM files WHERE id = ${id};`;

    res.json({ message: "File deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete file", error: err.message });
  }
});

app.put("/files/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { filename, description } = req.body;

    const result = await db`
      UPDATE files
      SET filename = ${filename}, description = ${description}
      WHERE id = ${id}
      RETURNING *;
    `;

    if (result.length === 0) {
      return res.status(404).json({ message: "File not found" });
    }

    res.json({ message: "File updated successfully", file: result[0] });
  } catch (err) {
    res.status(500).json({ message: "Failed to update file", error: err.message });
  }
});

app.use("/uploads", express.static(uploadDir));

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

export default app
