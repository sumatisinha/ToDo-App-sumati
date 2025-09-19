const express = require('express');
const { Pool } = require('pg');
const app = express();
const port = 3000;

// Middleware to parse URL-encoded bodies (as sent by HTML forms)
app.use(express.urlencoded({ extended: true }));

// PostgreSQL client configuration
// The client will use environment variables for connection details.
// Make sure to set these in your environment or docker-compose.yml
const pool = new Pool({
    user: process.env.POSTGRES_USER || 'myuser',
    host: process.env.POSTGRES_HOST || 'db', // 'db' is the service name in docker-compose
    database: process.env.POSTGRES_DB || 'mydatabase',
    password: process.env.POSTGRES_PASSWORD || 'mypassword',
    port: process.env.POSTGRES_PORT || 5432,
});

// Function to create the table if it doesn't exist
const createTable = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS notes (
                id SERIAL PRIMARY KEY,
                content TEXT NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                deleted SMALLINT NOT NULL DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Table "notes" is ready.');
    } catch (err) {
        console.error('Error creating table:', err.stack);
    } finally {
        client.release();
    }
};

// Main route to display notes and the form
app.get('/', async (req, res) => {
    console.log('Fetching notes from the database...');
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT id, content, status FROM notes WHERE deleted = 0 ORDER BY created_at DESC');
        const notes = result.rows.map(row => `
            <li class="note-item ${row.status === 'done' ? 'done' : ''}">
                <span class="note-content">${row.content}</span>
                <div class="note-actions">
                    <form style="display: flex; gap: 0.5rem;">
                        <button type="submit" formaction="/toggle/${row.id}" formmethod="POST" class="action-btn done-btn">${row.status === 'done' ? 'Undo' : 'Done'}</button>
                        <button type="submit" formaction="/edit/${row.id}" formmethod="GET" class="action-btn edit-btn">Edit</button>
                        <button type="submit" formaction="/delete/${row.id}" formmethod="POST" class="action-btn delete-btn">Delete</button>
                    </form>
                </div>
            </li>
        `).join('');

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Notes App</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f9; color: #333; margin: 0; padding: 1rem; }
                    h1, h2 { color: #4a4a4a; text-align: center; }
                    .container { max-width: 600px; margin: auto; background: #fff; padding: 2rem; border-radius: 8px; box-shadow: 0 2px V10px rgba(0,0,0,0.1); }
                    form { margin-bottom: 2rem; display: flex; }
                    input[type="text"] { flex-grow: 1; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px 0 0 4px; font-size: 1rem; }
                    button { padding: 0.75rem 1rem; background-color: #007bff; color: white; border: none; border-radius: 0 4px 4px 0; cursor: pointer; font-size: 1rem; }
                    button:hover { background-color: #0056b3; }
                    ul { list-style-type: none; padding: 0; }
                    .note-item { display: flex; justify-content: space-between; align-items: center; background: #e9ecef; padding: 0.75rem; border-radius: 4px; margin-bottom: 0.5rem; }
                    .note-item.done .note-content { text-decoration: line-through; color: #6c757d; }
                    .note-actions { display: flex; gap: 0.5rem; }
                    .action-btn { display: inline-block; box-sizing: border-box; min-width: 55px; text-align: center; padding: 0.3rem 0.6rem; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; color: white; font-size: 0.8rem; }
                    .done-btn { background-color: #28a745; }
                    .edit-btn { background-color: #ffc107; color: #212529; }
                    .delete-btn { background-color: #dc3545; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>PostgreSQL Notes App</h1>
                    <form action="/submit" method="POST">
                        <input type="text" name="note" placeholder="Enter your note" required>
                        <button type="submit">Save Note</button>
                    </form>
                    <h2>Saved Notes:</h2>
                    <ul>
                        ${notes || "<p>No notes yet. Add one!</p>"}
                    </ul>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error fetching notes:', err.stack);
        res.status(500).send('Error connecting to the database');
    } finally {
        client.release();
    }
});

// Route to display the edit page for a specific note
app.get('/edit/:id', async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT content FROM notes WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).send('Note not found');
        }
        const noteContent = result.rows[0].content;
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Edit Note</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f9; color: #333; margin: 0; padding: 1rem; }
                    .container { max-width: 600px; margin: 3rem auto; background: #fff; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    form { display: flex; flex-direction: column; }
                    textarea { font-size: 1rem; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 1rem; }
                    button { padding: 0.75rem; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Edit Note</h1>
                    <form action="/update/${id}" method="POST">
                        <textarea name="note" rows="4" required>${noteContent}</textarea>
                        <button type="submit">Update Note</button>
                    </form>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error fetching note for edit:', err.stack);
        res.status(500).send('Error fetching note');
    } finally {
        client.release();
    }
});

// Route to handle form submission
app.post('/submit', async (req, res) => {
    const { note } = req.body;
    if (!note) {
        return res.status(400).send('Note content cannot be empty.');
    }

    console.log(`Saving note: "${note}"`);
    const client = await pool.connect();
    try {
        await client.query('INSERT INTO notes (content) VALUES ($1)', [note]);
        res.redirect('/');
    } catch (err) {
        console.error('Error saving note:', err.stack);
        res.status(500).send('Failed to save the note.');
    } finally {
        client.release();
    }
});

// Route to handle updating a note
app.post('/update/:id', async (req, res) => {
    const { id } = req.params;
    const { note } = req.body;
    if (!note) {
        return res.status(400).send('Note content cannot be empty.');
    }
    const client = await pool.connect();
    try {
        await client.query('UPDATE notes SET content = $1 WHERE id = $2', [note, id]);
        res.redirect('/');
    } catch (err) {
        console.error('Error updating note:', err.stack);
        res.status(500).send('Failed to update the note.');
    } finally {
        client.release();
    }
});

// Route to handle toggling the status of a note
app.post('/toggle/:id', async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        // Toggle status between 'pending' and 'done'
        await client.query(`
            UPDATE notes 
            SET status = CASE 
                WHEN status = 'done' THEN 'pending' 
                ELSE 'done' 
            END 
            WHERE id = $1
        `, [id]);
        res.redirect('/');
    } catch (err) {
        console.error('Error toggling note status:', err.stack);
        res.status(500).send('Failed to toggle note status.');
    } finally {
        client.release();
    }
});

// Route to handle deleting a note
app.post('/delete/:id', async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('UPDATE notes SET deleted = 1 WHERE id = $1', [id]);
        res.redirect('/');
    } catch (err) {
        console.error('Error deleting note:', err.stack);
        res.status(500).send('Failed to delete the note.');
    } finally {
        client.release();
    }
});

app.listen(port, async () => {
    console.log(`App running on http://localhost:${port}`);
    // Ensure the database table is ready when the server starts
    await createTable();
});

