// The society is in India, but the cloud server runs in UTC.
// We always compare "days" and "months" in Indian time so "today" means today for students.
const TZ = 'Asia/Kolkata';
const dayKey = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
const monthKey = (d) => dayKey(d).slice(0, 7); // YYYY-MM
module.exports = { TZ, dayKey, monthKey };
