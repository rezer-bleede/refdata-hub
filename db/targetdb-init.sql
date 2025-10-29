CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    marital_status TEXT,
    department_id INTEGER REFERENCES departments(id)
);

INSERT INTO departments (code, name)
VALUES
    ('FIN', 'Finance'),
    ('ENG', 'Engineering'),
    ('HR', 'People Operations')
ON CONFLICT (code) DO NOTHING;

INSERT INTO customers (first_name, last_name, email, marital_status, department_id)
VALUES
    ('Amina', 'Hassan', 'amina.hassan@example.com', 'Married', 1),
    ('Liam', 'O''Connor', 'liam.oconnor@example.com', 'Single', 2),
    ('Priya', 'Desai', 'priya.desai@example.com', 'Married', 2),
    ('Carlos', 'Mendez', 'carlos.mendez@example.com', 'Single', 3)
ON CONFLICT DO NOTHING;
