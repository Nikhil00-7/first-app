// models/todoModel.js
const pool = require('../config/db');

const Todo = {
  async getAll() {
    const [rows] = await pool.query('SELECT * FROM todos ORDER BY created_at DESC');
    return rows;
  },

  async getById(id) {
    const [rows] = await pool.query('SELECT * FROM todos WHERE id = ?', [id]);
    return rows[0];
  },

  async create(title, description) {
    const [result] = await pool.query(
      'INSERT INTO todos (title, description) VALUES (?, ?)',
      [title, description]
    );
    return { id: result.insertId, title, description, completed: false };
  },

  async update(id, title, description, completed) {
    const [result] = await pool.query(
      'UPDATE todos SET title = ?, description = ?, completed = ? WHERE id = ?',
      [title, description, completed, id]
    );
    return result.affectedRows > 0;
  },

  async delete(id) {
    const [result] = await pool.query('DELETE FROM todos WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
};

module.exports = Todo;