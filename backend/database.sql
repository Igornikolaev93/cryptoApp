-- Create the users table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create the operations table
CREATE TABLE operations (
    operation_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    operation_type VARCHAR(50) NOT NULL, -- e.g., 'withdrawal', 'deposit'
    crypto_currency VARCHAR(50),
    crypto_amount NUMERIC,
    fiat_currency VARCHAR(50),
    fiat_amount NUMERIC,
    payment_method VARCHAR(100),
    wallet_address VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending', -- e.g., 'pending', 'completed', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);