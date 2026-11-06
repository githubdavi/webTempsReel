# webTempsReel

Lien du repo: https://github.com/githubdavi/webTempsReel

Pour lancer le projet : `docker compose up --build` puis http://localhost:3000

## Routes

`GET /users` : liste des utilisateurs
`GET /products` : liste des produits et leur stock
`GET /orders` : liste des commandes
`GET /orders/:id` : renvoie une commande
`POST /orders` `{ userId, productId, quantity }` : crée une commande et baisse le stock (404 client/produit introuvable, 409 stock insuffisant).
`PATCH /orders/:id/status` `{ status }` : passe à `shipped` puis `delivered`, ou `cancelled` depuis `preparing` en rendant le stock ( 400 statut invalide, 404 introuvable, 409 transition interdite).
`GET /stream` : flux SSE des événements `order-created`, `order-status`, `order-cancelled` et `stock`.
