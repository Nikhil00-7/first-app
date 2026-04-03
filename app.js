const express = require('express');
const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/data', (req, res) => {
  res.status(200).json({ data: "This is some data from the service" });
});

module.exports = app;