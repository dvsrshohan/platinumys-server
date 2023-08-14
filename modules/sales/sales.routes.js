const express = require("express");
const {
  getAllSales,
  getASale,
  updateSale,
  createPosSale,
  createOnlineSale,
} = require("./sales.controllers");
const salesRoutes = express.Router();

// Define the Sells routes

salesRoutes.get("/", (req, res) => {
  getAllSales(req, res);
});

salesRoutes.post("/pos/", (req, res) => {
  createPosSale(req, res);
});
salesRoutes.post("/:id", (req, res) => {
  createOnlineSale(req, res);
});
salesRoutes.get("/:id", (req, res) => {
  getASale(req, res);
});

salesRoutes.put("/:id", (req, res) => {
  updateSale(req, res);
});

module.exports = salesRoutes;
