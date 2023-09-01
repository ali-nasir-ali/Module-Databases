const express = require("express");
const { Pool } = require("pg");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

const db = new Pool({
  user: process.env.DB_USERNAME,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

app.get("/products", (req, res) => {
  db.query(
    "SELECT p.product_name, pa.unit_price, s.supplier_name FROM products AS p INNER JOIN product_availability AS pa ON p.id = pa.prod_id INNER JOIN suppliers AS s ON pa.supp_id = s.id"
  )
    .then((result) => {
      const productList = result.rows.map((row) => ({
        name: row.product_name,
        price: row.unit_price,
        supplierName: row.supplier_name,
      }));
      res.status(200).json(productList);
    })
    .catch((error) =>
      res.status(500).json({
        message: error.message,
      })
    );
});

app.get("/products/:name", (req, res) => {
  const productName = req.params.name;
  db.query("SELECT * FROM products WHERE product_name LIKE '%' || $1 || '%'", [productName])
    .then((result) => {
      const productList = result.rows.map((row) => ({
        name: row.product_name,
      }));
      res.status(200).json(productList);
    })
    .catch((error) =>
      res.status(500).json({
        message: error.message,
      })
    );
});

app.get("/customers/:customerId", (req, res) => {
  const customerId = req.params.customerId;
  db.query("SELECT * FROM customers WHERE id = $1", [customerId])
    .then((result) => {
      if (result.rows.length === 0) {
        res.status(404).json({
          message: `Customer with ID ${customerId} not found`,
        });
      } else {
        const customer = result.rows[0];
        res.status(200).json({
          id: customer.id,
          name: customer.name,
          address: customer.address,
          city: customer.city,
          country: customer.country,
        });
      }
    })
    .catch((error) =>
      res.status(500).json({
        message: error.message,
      })
    );
});

app.post("/customers", (req, res) => {
  const { name, address, city, country } = req.body;
  db.query("INSERT INTO customers (name, address, city, country) VALUES ($1, $2, $3, $4) RETURNING id", [name, address, city, country])
    .then((result) => {
      const customerId = result.rows[0].id;
      res.status(201).json({
        id: customerId,
        name,
        address,
        city,
        country,
      });
    })
    .catch((error) =>
      res.status(500).json({
        message: error.message,
      })
    );
});

app.post("/products", (req, res) => {
  const { name } = req.body;
  db.query("INSERT INTO products (product_name) VALUES ($1) RETURNING id", [name])
    .then((result) => {
      const productId = result.rows[0].id;
      res.status(201).json({
        id: productId,
        name,
      });
    })
    .catch((error) =>
      res.status(500).json({
        message: error.message,
      })
    );
});

app.post("/availability", (req, res) => {
  const { productId, price, supplierId } = req.body;
  db.query("SELECT * FROM products WHERE id = $1", [productId])
    .then((result) => {
      if (result.rows.length === 0) {
        res.status(400).json({
          message: `Product with ID ${productId} not found`,
        });
      } else {
        return db.query("SELECT * FROM suppliers WHERE id = $1", [supplierId]);
      }
    })
    .then((result) => {
      if (result.rows.length === 0) {
        res.status(400).json({
          message: `Supplier with ID ${supplierId} not found`,
        });
      } else if (price <= 0) {
        res.status(400).json({
          message: "Price must be a positive integer",
        });
      } else {
        return db.query("INSERT INTO product_availability (prod_id, supp_id, unit_price) VALUES ($1, $2, $3) RETURNING id", [productId, supplierId, price]);
      }
    })
    .then((result) => {
      const availabilityId = result.rows[0].id;
      res.status(201).json({
        id: availabilityId,
        productId,
        price,
        supplierId,
      });
    })
    .catch((error) =>
      res.status(500).json({
        message: error.message,
      })
    );
});

app.post("/customers/:customerId/orders", (req, res) => {
  const { orderDate, orderReference } = req.body;
  const customerId = req.params.customerId;
  db.query("SELECT * FROM customers WHERE id = $1", [customerId])
    .then((result) => {
      if (result.rows.length === 0) {
        res.status(400).json({
          message: `Customer with ID ${customerId} not found`,
        });
      } else {
        return db.query("INSERT INTO orders (customer_id, order_date, order_reference) VALUES ($1, $2, $3) RETURNING id", [customerId, orderDate, orderReference]);
      }
    })
    .then((result) => {
      const orderId = result.rows[0].id;
      res.status(201).json({
        id: orderId,
        customerId,
        orderDate,
        orderReference,
      });
    })
    .catch((error) =>
      res.status(500).json({
        message: error.message,
      })
    );
});

app.put("/customers/:customerId", (req, res) => {
  const { name, address, city, country } = req.body;
  const customerId = req.params.customerId;
  db.query("SELECT * FROM customers WHERE id = $1", [customerId])
    .then((result) => {
      if (result.rows.length === 0) {
        res.status(404).json({
          message: `Customer with ID ${customerId} not found`,
        });
      } else {
        return db.query("UPDATE customers SET name = $1, address = $2, city = $3, country = $4 WHERE id = $5", [name, address, city, country, customerId]);
      }
    })
    .then(() => {
      res.status(200).json({
        id: customerId,
        name,
        address,
        city,
        country,
      });
    })
    .catch((error) =>
      res.status(500).json({
        message: error.message,
      })
    );
});

app.delete("/orders/:orderId", (req, res) => {
  const orderId = req.params.orderId;
  db.query("DELETE FROM order_items WHERE order_id = $1", [orderId])
    .then(() => {
      return db.query("DELETE FROM orders WHERE id = $1", [orderId]);
    })
    .then(() => {
      res.status(204).send();
    })
    .catch((error) =>
      res.status(500).json({
        message: error.message,
      })
    );
});

app.delete("/customers/:customerId", (req, res) => {
  const customerId = req.params.customerId;
  db.query("SELECT * FROM orders WHERE customer_id = $1", [customerId])
    .then((result) => {
      if (result.rows.length > 0) {
        res.status(400).json({
          message: `Customer with ID ${customerId} has orders and cannot be deleted`,
        });
      } else {
        return db.query("DELETE FROM customers WHERE id = $1", [customerId]);
      }
    })
    .then(() => {
      res.status(204).send();
    })
    .catch((error) =>
      res.status(500).json({
        message: error.message,
      })
    );
});

app.get("/customers/:customerId/orders", (req, res) => {
  const customerId = req.params.customerId;
  db.query(
    "SELECT o.order_reference, o.order_date, p.product_name, pa.unit_price, s.supplier_name, oi.quantity FROM orders AS o INNER JOIN order_items AS oi ON o.id = oi.order_id INNER JOIN product_availability AS pa ON oi.prod_id = pa.prod_id AND oi.supp_id = pa.supp_id INNER JOIN products AS p ON oi.prod_id = p.id INNER JOIN suppliers AS s ON oi.supp_id = s.id WHERE o.customer_id = $1",
    [customerId]
  )
    .then((result) => {
      const orderList = result.rows.map((row) => ({
        orderReference: row.order_reference,
        orderDate: row.order_date,
        productName: row.product_name,
        unitPrice: row.unit_price,
        supplierName: row.supplier_name,
        quantity: row.quantity,
      }));
      res.status(200).json(orderList);
    })
    .catch((error) =>
      res.status(500).json({
        message: error.message,
      })
    );
});

app.listen(process.env.SERVER_PORT, () => {
  console.log(`Server is listening. Ready to accept requests!`);
});

module.exports = app;
