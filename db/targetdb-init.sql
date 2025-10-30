CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    cost_center TEXT NOT NULL,
    region TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    employee_number TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    job_title TEXT NOT NULL,
    employment_status TEXT NOT NULL,
    department_id INTEGER NOT NULL REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    customer_number TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    marital_status TEXT,
    date_of_birth DATE,
    loyalty_status TEXT,
    annual_income NUMERIC(10, 2),
    department_id INTEGER REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS customer_addresses (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    address_type TEXT NOT NULL,
    line1 TEXT NOT NULL,
    line2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    country TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (customer_id, address_type)
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    employee_id INTEGER REFERENCES employees(id),
    order_date DATE NOT NULL,
    status TEXT NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    shipping_address_id INTEGER REFERENCES customer_addresses(id)
);

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL,
    UNIQUE (order_id, product_id)
);

INSERT INTO departments (code, name, cost_center, region)
VALUES
    ('FIN', 'Finance', '100-FIN', 'EMEA'),
    ('ENG', 'Engineering', '200-ENG', 'NAM'),
    ('HR', 'People Operations', '300-HR', 'APAC'),
    ('MKT', 'Marketing', '400-MKT', 'LATAM'),
    ('OPS', 'Operations', '500-OPS', 'EMEA')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    cost_center = EXCLUDED.cost_center,
    region = EXCLUDED.region;

INSERT INTO employees (employee_number, first_name, last_name, email, job_title, employment_status, department_id)
VALUES
    ('E1001', 'Maya', 'Patel', 'maya.patel@example.com', 'Finance Director', 'Active', (SELECT id FROM departments WHERE code = 'FIN')),
    ('E1002', 'Anders', 'Larsson', 'anders.larsson@example.com', 'Lead Data Engineer', 'Active', (SELECT id FROM departments WHERE code = 'ENG')),
    ('E1003', 'Lucia', 'Romero', 'lucia.romero@example.com', 'HR Business Partner', 'Active', (SELECT id FROM departments WHERE code = 'HR')),
    ('E1004', 'Talia', 'Nguyen', 'talia.nguyen@example.com', 'Marketing Strategist', 'On Leave', (SELECT id FROM departments WHERE code = 'MKT')),
    ('E1005', 'Jamal', 'Owens', 'jamal.owens@example.com', 'Logistics Supervisor', 'Active', (SELECT id FROM departments WHERE code = 'OPS'))
ON CONFLICT (employee_number) DO UPDATE
SET first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    job_title = EXCLUDED.job_title,
    employment_status = EXCLUDED.employment_status,
    department_id = EXCLUDED.department_id;

INSERT INTO customers (customer_number, first_name, last_name, email, phone, marital_status, date_of_birth, loyalty_status, annual_income, department_id)
VALUES
    ('CUST-1001', 'Amina', 'Hassan', 'amina.hassan@example.com', '+971-50-123-4567', 'Married', '1985-04-12', 'Platinum', 98000.00, (SELECT id FROM departments WHERE code = 'FIN')),
    ('CUST-1002', 'Liam', 'O''Connor', 'liam.oconnor@example.com', '+353-86-555-1212', 'Single', '1990-08-25', 'Gold', 72000.00, (SELECT id FROM departments WHERE code = 'ENG')),
    ('CUST-1003', 'Priya', 'Desai', 'priya.desai@example.com', '+91-98200-11122', 'Married', '1988-02-03', 'Gold', 84000.00, (SELECT id FROM departments WHERE code = 'ENG')),
    ('CUST-1004', 'Carlos', 'Mendez', 'carlos.mendez@example.com', '+57-310-555-7890', 'Single', '1992-11-17', 'Silver', 54000.00, (SELECT id FROM departments WHERE code = 'MKT')),
    ('CUST-1005', 'Sakura', 'Ito', 'sakura.ito@example.com', '+81-90-2222-3333', 'Married', '1979-06-30', 'Platinum', 115000.00, (SELECT id FROM departments WHERE code = 'HR')),
    ('CUST-1006', 'Noah', 'Williams', 'noah.williams@example.com', '+1-415-555-9012', 'Domestic Partnership', '1984-12-09', 'Gold', 89000.00, (SELECT id FROM departments WHERE code = 'OPS')),
    ('CUST-1007', 'Amara', 'Okafor', 'amara.okafor@example.com', '+234-803-555-6677', 'Single', '1995-05-21', 'Bronze', 48000.00, (SELECT id FROM departments WHERE code = 'OPS')),
    ('CUST-1008', 'Jonas', 'Lund', 'jonas.lund@example.com', '+46-70-123-4455', 'Married', '1981-03-14', 'Silver', 76000.00, (SELECT id FROM departments WHERE code = 'FIN'))
ON CONFLICT (customer_number) DO UPDATE
SET first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    marital_status = EXCLUDED.marital_status,
    date_of_birth = EXCLUDED.date_of_birth,
    loyalty_status = EXCLUDED.loyalty_status,
    annual_income = EXCLUDED.annual_income,
    department_id = EXCLUDED.department_id;

INSERT INTO customer_addresses (customer_id, address_type, line1, line2, city, state, postal_code, country, is_primary)
VALUES
    ((SELECT id FROM customers WHERE customer_number = 'CUST-1001'), 'home', '14 Al Reem Tower', 'Apt 1902', 'Abu Dhabi', 'Abu Dhabi', '51133', 'United Arab Emirates', TRUE),
    ((SELECT id FROM customers WHERE customer_number = 'CUST-1001'), 'billing', '14 Al Reem Tower', 'Apt 1902', 'Abu Dhabi', 'Abu Dhabi', '51133', 'United Arab Emirates', TRUE),
    ((SELECT id FROM customers WHERE customer_number = 'CUST-1002'), 'home', '27 Grand Canal Dock', NULL, 'Dublin', 'Leinster', 'D02', 'Ireland', TRUE),
    ((SELECT id FROM customers WHERE customer_number = 'CUST-1003'), 'home', '88 Marine Drive', 'Bandra West', 'Mumbai', 'Maharashtra', '400050', 'India', TRUE),
    ((SELECT id FROM customers WHERE customer_number = 'CUST-1003'), 'shipping', '88 Marine Drive', 'Bandra West', 'Mumbai', 'Maharashtra', '400050', 'India', TRUE),
    ((SELECT id FROM customers WHERE customer_number = 'CUST-1004'), 'home', 'Carrera 7 #45-10', 'Suite 8B', 'Bogotá', 'Bogotá DC', '110231', 'Colombia', TRUE),
    ((SELECT id FROM customers WHERE customer_number = 'CUST-1005'), 'home', '2-14-8 Minato', NULL, 'Tokyo', 'Tokyo', '105-0022', 'Japan', TRUE),
    ((SELECT id FROM customers WHERE customer_number = 'CUST-1005'), 'shipping', '2-14-8 Minato', NULL, 'Tokyo', 'Tokyo', '105-0022', 'Japan', TRUE),
    ((SELECT id FROM customers WHERE customer_number = 'CUST-1006'), 'home', '845 Market Street', 'Unit 32', 'San Francisco', 'California', '94103', 'United States', TRUE),
    ((SELECT id FROM customers WHERE customer_number = 'CUST-1006'), 'shipping', '845 Market Street', 'Unit 32', 'San Francisco', 'California', '94103', 'United States', TRUE),
    ((SELECT id FROM customers WHERE customer_number = 'CUST-1007'), 'home', '12 Admiralty Way', NULL, 'Lagos', 'Lagos', '106104', 'Nigeria', TRUE),
    ((SELECT id FROM customers WHERE customer_number = 'CUST-1008'), 'home', 'Sveavägen 44', NULL, 'Stockholm', 'Stockholm', '111 34', 'Sweden', TRUE)
ON CONFLICT (customer_id, address_type) DO UPDATE
SET line1 = EXCLUDED.line1,
    line2 = EXCLUDED.line2,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    postal_code = EXCLUDED.postal_code,
    country = EXCLUDED.country,
    is_primary = EXCLUDED.is_primary;

INSERT INTO products (sku, name, category, unit_price)
VALUES
    ('SKU-ACC-001', 'Executive Leather Notebook', 'Accessories', 35.50),
    ('SKU-ANL-002', 'Advanced Analytics Suite License', 'Software', 2499.00),
    ('SKU-HRD-003', 'High-Precision Badge Printer', 'Hardware', 780.00),
    ('SKU-MKT-004', 'Global Campaign Media Package', 'Services', 12500.00),
    ('SKU-OPS-005', 'Cold Chain Sensor Kit', 'Hardware', 455.75)
ON CONFLICT (sku) DO UPDATE
SET name = EXCLUDED.name,
    category = EXCLUDED.category,
    unit_price = EXCLUDED.unit_price;

INSERT INTO orders (order_number, customer_id, employee_id, order_date, status, total_amount, shipping_address_id)
VALUES
    ('SO-10001', (SELECT id FROM customers WHERE customer_number = 'CUST-1001'), (SELECT id FROM employees WHERE employee_number = 'E1001'), '2024-01-15', 'Completed', 25345.00, (SELECT id FROM customer_addresses WHERE customer_id = (SELECT id FROM customers WHERE customer_number = 'CUST-1001') AND address_type = 'billing')),
    ('SO-10002', (SELECT id FROM customers WHERE customer_number = 'CUST-1003'), (SELECT id FROM employees WHERE employee_number = 'E1002'), '2024-02-02', 'Completed', 1737.50, (SELECT id FROM customer_addresses WHERE customer_id = (SELECT id FROM customers WHERE customer_number = 'CUST-1003') AND address_type = 'shipping')),
    ('SO-10003', (SELECT id FROM customers WHERE customer_number = 'CUST-1004'), (SELECT id FROM employees WHERE employee_number = 'E1004'), '2024-02-18', 'Processing', 12500.00, (SELECT id FROM customer_addresses WHERE customer_id = (SELECT id FROM customers WHERE customer_number = 'CUST-1004') AND address_type = 'home')),
    ('SO-10004', (SELECT id FROM customers WHERE customer_number = 'CUST-1005'), (SELECT id FROM employees WHERE employee_number = 'E1003'), '2024-03-05', 'Completed', 1444.00, (SELECT id FROM customer_addresses WHERE customer_id = (SELECT id FROM customers WHERE customer_number = 'CUST-1005') AND address_type = 'shipping')),
    ('SO-10005', (SELECT id FROM customers WHERE customer_number = 'CUST-1006'), (SELECT id FROM employees WHERE employee_number = 'E1005'), '2024-03-22', 'Shipped', 4777.75, (SELECT id FROM customer_addresses WHERE customer_id = (SELECT id FROM customers WHERE customer_number = 'CUST-1006') AND address_type = 'shipping')),
    ('SO-10006', (SELECT id FROM customers WHERE customer_number = 'CUST-1007'), (SELECT id FROM employees WHERE employee_number = 'E1005'), '2024-04-11', 'Pending Payment', 633.25, (SELECT id FROM customer_addresses WHERE customer_id = (SELECT id FROM customers WHERE customer_number = 'CUST-1007') AND address_type = 'home'))
ON CONFLICT (order_number) DO UPDATE
SET customer_id = EXCLUDED.customer_id,
    employee_id = EXCLUDED.employee_id,
    order_date = EXCLUDED.order_date,
    status = EXCLUDED.status,
    total_amount = EXCLUDED.total_amount,
    shipping_address_id = EXCLUDED.shipping_address_id;

INSERT INTO order_items (order_id, product_id, quantity, unit_price)
VALUES
    ((SELECT id FROM orders WHERE order_number = 'SO-10001'), (SELECT id FROM products WHERE sku = 'SKU-ACC-001'), 10, 35.50),
    ((SELECT id FROM orders WHERE order_number = 'SO-10001'), (SELECT id FROM products WHERE sku = 'SKU-ANL-002'), 10, 2499.00),
    ((SELECT id FROM orders WHERE order_number = 'SO-10002'), (SELECT id FROM products WHERE sku = 'SKU-ACC-001'), 5, 35.50),
    ((SELECT id FROM orders WHERE order_number = 'SO-10002'), (SELECT id FROM products WHERE sku = 'SKU-HRD-003'), 2, 780.00),
    ((SELECT id FROM orders WHERE order_number = 'SO-10003'), (SELECT id FROM products WHERE sku = 'SKU-MKT-004'), 1, 12500.00),
    ((SELECT id FROM orders WHERE order_number = 'SO-10004'), (SELECT id FROM products WHERE sku = 'SKU-OPS-005'), 2, 455.75),
    ((SELECT id FROM orders WHERE order_number = 'SO-10004'), (SELECT id FROM products WHERE sku = 'SKU-ACC-001'), 15, 35.50),
    ((SELECT id FROM orders WHERE order_number = 'SO-10005'), (SELECT id FROM products WHERE sku = 'SKU-OPS-005'), 5, 455.75),
    ((SELECT id FROM orders WHERE order_number = 'SO-10005'), (SELECT id FROM products WHERE sku = 'SKU-ANL-002'), 1, 2499.00),
    ((SELECT id FROM orders WHERE order_number = 'SO-10006'), (SELECT id FROM products WHERE sku = 'SKU-OPS-005'), 1, 455.75),
    ((SELECT id FROM orders WHERE order_number = 'SO-10006'), (SELECT id FROM products WHERE sku = 'SKU-ACC-001'), 5, 35.50)
ON CONFLICT (order_id, product_id) DO UPDATE
SET quantity = EXCLUDED.quantity,
    unit_price = EXCLUDED.unit_price;
