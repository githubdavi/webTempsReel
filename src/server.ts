import express from "express";
import cors from "cors";
import { JsonDB, Config } from "node-json-db";
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
const db = new JsonDB(new Config("data/db.json", true, true, "/"));
const PORT = Number(process.env.PORT) || 3000;
export const server = app.listen(PORT, () =>
  console.log(`http://localhost:${PORT}`),
);
