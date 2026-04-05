// controllers/todoController.js
const Todo = require('../models/todoModel');

exports.getTodos = async (req, res, next) => {
  try {
    const todos = await Todo.getAll();
    res.json(todos);
  } catch (err) {
    next(err);
  }
};

exports.getTodo = async (req, res, next) => {
  try {
    const todo = await Todo.getById(req.params.id);
    if (!todo) return res.status(404).json({ message: 'Todo not found' });
    res.json(todo);
  } catch (err) {
    next(err);
  }
};

exports.createTodo = async (req, res, next) => {
  try {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required' });

    const newTodo = await Todo.create(title, description || null);
    res.status(201).json(newTodo);
  } catch (err) {
    next(err);
  }
};

exports.updateTodo = async (req, res, next) => {
  try {
    const { title, description, completed } = req.body;
    const success = await Todo.update(req.params.id, title, description, completed);
    
    if (!success) return res.status(404).json({ message: 'Todo not found' });
    
    res.json({ message: 'Todo updated successfully' });
  } catch (err) {
    next(err);
  }
};

exports.deleteTodo = async (req, res, next) => {
  try {
    const success = await Todo.delete(req.params.id);
    if (!success) return res.status(404).json({ message: 'Todo not found' });
    
    res.json({ message: 'Todo deleted successfully' });
  } catch (err) {
    next(err);
  }
};