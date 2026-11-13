-- Insert default admin user
-- Password: admin123 (hashed with bcrypt)
INSERT INTO users (
    id,
    username,
    email,
    password_hash,
    first_name,
    last_name,
    role,
    status
) VALUES (
    gen_random_uuid(),
    'admin',
    'admin@academic-system.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- admin123
    'System',
    'Administrator',
    'admin',
    'active'
) ON CONFLICT (email) DO NOTHING;

-- Insert sample lecturer
-- Password: lecturer123
INSERT INTO users (
    id,
    username,
    email,
    password_hash,
    first_name,
    last_name,
    role,
    status
) VALUES (
    gen_random_uuid(),
    'lecturer1',
    'lecturer1@academic-system.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- lecturer123
    'John',
    'Doe',
    'lecturer',
    'active'
) ON CONFLICT (email) DO NOTHING;

-- Insert sample student
-- Password: student123
INSERT INTO users (
    id,
    username,
    email,
    password_hash,
    first_name,
    last_name,
    role,
    status
) VALUES (
    gen_random_uuid(),
    'student1',
    'student1@academic-system.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- student123
    'Jane',
    'Smith',
    'student',
    'active'
) ON CONFLICT (email) DO NOTHING;
