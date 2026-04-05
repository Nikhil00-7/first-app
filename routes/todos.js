// routes/todos.js
const express = require('express');
const router = express.Router();
const todoController = require('../controller/todoController');

router.get('/', todoController.getTodos);
router.get('/:id', todoController.getTodo);
router.post('/', todoController.createTodo);
router.put('/:id', todoController.updateTodo);
router.delete('/:id', todoController.deleteTodo);

module.exports = router;