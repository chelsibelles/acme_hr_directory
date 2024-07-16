const pg = require("pg");
const express = require("express");

const client = new pg.Client(
    process.env.DATABASE_URL || "postgres://localhost/acme_hr_directory_db"
);

const server = express();

const init = async () => {
    await client.connect();
    console.log("connected to database");

    let SQL = `
    DROP TABLE IF EXISTS employees;
    DROP TABLE IF EXISTS departments;

    CREATE TABLE departments(
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
    );

    CREATE TABLE employees(
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    department_id INTEGER REFERENCES departments(id) NOT NULL
    );`;

    await client.query(SQL);
    console.log("tables created");

    SQL = `
    INSERT INTO departments(name) VALUES ('Recruitment and Staffing');
    INSERT INTO departments(name) VALUES ('Employee Relations');
    INSERT INTO departments(name) VALUES ('Training and Development');

    INSERT INTO employees(name, department_id) VALUES ('Emily Johnson', (SELECT id FROM departments WHERE name='Employee Relations'));
    INSERT INTO employees(name, department_id) VALUES ('Michael Smith', (SELECT id FROM departments WHERE name='Recruitment and Staffing'));
    INSERT INTO employees(name, department_id) VALUES ('Olivia Brown', (SELECT id FROM departments WHERE name='Employee Relations'));
    INSERT INTO employees(name, department_id) VALUES ('James Wilson', (SELECT id FROM departments WHERE name='Training and Development'));
    INSERT INTO employees(name, department_id) VALUES ('Sophia Davis', (SELECT id FROM departments WHERE name='Recruitment and Staffing'));`;

    await client.query(SQL);
    console.log("data seeded");

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => console.log(`listening on port ${PORT}`));
};

init();

server.use(express.json());
server.use(require("morgan")("dev"));

// GET /api/employees
server.get("/api/employees", async (req, res, next) => {
    try {
        const SQL = `
        SELECT * from employees;
        `;
        const response = await client.query(SQL);
        res.send(response.rows);
    } catch (err) {
        next(err);
    }
});

// GET /api/departments
server.get("/api/departments", async (req, res, next) => {
    try {
        const SQL = `
        SELECT * FROM departments;
        `;
        const response = await client.query(SQL);
        res.send(response.rows);
    } catch (err) {
        next(err);
    }
});

// POST /api/employees
server.post("/api/employees", async (req, res, next) => {
    try {
        const { name, department_id } = req.body;
        if (!name || !department_id) {
            return res.status(400).send({
                message: "Please send the name and department_id to create an employee."
            });
        }
        const SQL = `
        INSERT INTO employees (name, department_id)
        VALUES($1, $2)
        RETURNING *;
        `;
        const response = await client.query(SQL, [name, department_id]);
        res.status(201).send(response.rows[0]);
    } catch (err) {
        next(err);
    }
});

// PUT /api/employees/:id
server.put("/api/employees/:id", async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, department_id } = req.body;

        // Validate input
        if (!name && !department_id) {
            return res.status(400).send({ message: "Please provide name or department_id to update the employee." });
        }

        // Build dynamic SQL query
        let SQL = 'UPDATE employees SET';
        const fields = [];
        if (name) fields.push(` name = '${name}'`);
        if (department_id) fields.push(` department_id = ${department_id}`);
        SQL += fields.join(', ');
        SQL += `, updated_at = now() WHERE id = ${id} RETURNING *;`;

        // Execute the query
        const response = await client.query(SQL);

        if (response.rowCount === 0) {
            return res.status(404).send({ message: "Employee not found." });
        }

        res.send(response.rows[0]);
    } catch (err) {
        console.error("Error updating employee:", err);
        next(err);
    }
});

// DELETE /api/employees/:id
server.delete("/api/employees/:id", async (req, res, next) => {
    try {
        const { id } = req.params;
        const SQL = `
        DELETE FROM employees
        WHERE id = $1;
        `;
        const response = await client.query(SQL, [id]);
        if (response.rowCount === 0) {
            return res.status(404).send({ message: "Employee not found." });
        }
        res.sendStatus(204);
    } catch (err) {
        next(err);
    }
});

// Error handling middleware
server.use((err, req, res, next) => {
    res.status(err.status || 500).send({ error: err.message || err });
});

