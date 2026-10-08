-- Run AFTER you registered your own account through POST /api/auth/register.
-- Replace the number with the 13-digit student number of each admin.
update members set role = 'admin' where roll_number = '2500271530105';
select roll_number, full_name, role from members where role = 'admin';
