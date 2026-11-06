import express from "express";
import cors from "cors";
import { JsonDB, Config } from "node-json-db";

interface User {
  id: string;
  name: string;
  username: string;
  email: string;
}

interface Product {
  id: string;
  name: string;
  stock: number;
}

type Status = "preparing" | "shipped" | "delivered" | "cancelled";

interface Order {
  id: number;
  userId: User["id"];
  productId: Product["id"];
  quantity: number;
  status: Status;
  createdAt: string;
}

const isStatus = (value: string): value is Status =>
  value === "preparing" ||
  value === "shipped" ||
  value === "delivered" ||
  value === "cancelled";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
const db = new JsonDB(new Config("data/db.json", true, true, "/"));
const PORT = Number(process.env.PORT) || 3000;

const clients = new Set<express.Response>();

app.get("/stream", (_req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();
  clients.add(res);
  res.on("close", () => clients.delete(res));
});

let id = 0;
function broadcast(event: string, data: unknown) {
  const msg = `id: ${++id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(msg);
}

app.get("/users", async (req, res) => {
  try {
    res.status(200).json(await db.getData("/user"));
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.get("/products", async (req, res) => {
  try {
    res.status(200).json(await db.getData("/Product"));
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.get("/orders", async (req, res) => {
  try {
    res.status(200).json(await db.getData("/Order"));
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.get("/orders/:id", async (req, res) => {
  try {
    const orders: Order[] = await db.getData("/Order");
    const order = orders.find((order) => order.id === Number(req.params.id));
    if (!order) return res.status(404).json({ error: "Commande introuvable" });
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.post("/orders", async (req, res) => {
  const userId = req.body.userId;
  const productId = req.body.productId;
  const quantity = req.body.quantity;
  if (!userId || !productId || !Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ error: "Champ manquant ou invalide" });
  }

  const users: User[] = await db.getData("/user");
  const products: Product[] = await db.getData("/Product");
  const orders: Order[] = await db.getData("/Order");

  if (!users.find((user) => user.id === userId))
    return res.status(404).json({ error: "Client introuvable" });
  const product = products.find((p) => p.id === productId);
  if (!product) return res.status(404).json({ error: "Produit introuvable" });
  if (product.stock < quantity)
    return res.status(409).json({ error: "Stock insuffisant" });

  product.stock -= quantity;
  const order: Order = {
    id: orders.length + 1,
    userId,
    productId,
    quantity,
    status: "preparing",
    createdAt: new Date().toISOString(),
  };
  orders.push(order);

  await db.push("/Product", products);
  await db.push("/Order", orders);
  broadcast("order-created", order);
  broadcast("stock", product);
  res.status(201).json(order);
});

app.patch("/orders/:id/status", async (req, res) => {
  const status = req.body.status;
  if (!isStatus(status))
    return res.status(400).json({ error: "Statut invalide" });

  const orders: Order[] = await db.getData("/Order");
  const order = orders.find((o) => o.id === Number(req.params.id));
  if (!order) return res.status(404).json({ error: "Commande introuvable" });

  if (status === "cancelled") {
    if (order.status !== "preparing")
      return res.status(409).json({
        error:
          "La commande n'est pas en préparation et ne peut donc pas être annulée",
      });
    const products: Product[] = await db.getData("/Product");
    const product = products.find((product) => product.id === order.productId);
    if (!product) return res.status(404).json({ error: "Produit introuvable" });
    product.stock += order.quantity;
    await db.push("/Product", products);
    broadcast("stock", product);
  } else if (
    !(order.status === "preparing" && status === "shipped") &&
    !(order.status === "shipped" && status === "delivered")
  ) {
    return res
      .status(409)
      .json({ error: ` ${order.status} -> ${status} impossible` });
  }

  order.status = status;
  await db.push("/Order", orders);
  broadcast(status === "cancelled" ? "order-cancelled" : "order-status", order);

  if (status === "shipped") {
    setTimeout(async () => {
      const orders: Order[] = await db.getData("/Order");
      const shipped = orders.find((o) => o.id === order.id);
      if (shipped && shipped.status === "shipped") {
        shipped.status = "delivered";
        await db.push("/Order", orders);
        broadcast("order-status", shipped);
      }
    }, 20000);
  }

  res.json(order);
});

export const server = app.listen(PORT, () =>
  console.log(`http://localhost:${PORT}`),
);
