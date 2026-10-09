const { z } = require('zod');

const roll = z.string().regex(/^\d{13}$/, 'Student number must be exactly 13 digits');
const password = z.string().min(8, 'Password must be at least 8 characters').max(72);
const image = z.string().min(100, 'Image frame is missing or too small').max(360_000, 'Each image frame must be at most 360 KB');
const enrollmentFrames = z.array(image).min(3, 'Enrollment requires at least 3 frames').max(8, 'Enrollment accepts at most 8 frames');
const attendanceFrames = z.array(image).min(15, 'Attendance verification requires at least 15 frames').max(20, 'Attendance verification accepts at most 20 frames');
const uuid = z.string().uuid();
const optionalText = (max) => z.string().trim().max(max).optional();
const githubHandle = z.string().trim().regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/, 'Invalid GitHub username');

const s = {
  idParam: z.object({ id: uuid }),

  register: z.object({
    roll_number: roll,
    full_name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email().max(200),
    password,
    domain: z.string().trim().min(2).max(50),
    year: z.string().trim().min(1).max(10),
    github_handle: githubHandle.optional(),
    consent: z.boolean().refine((v) => v === true, 'Biometric consent is required'),
    frames: enrollmentFrames,
  }),
  login: z.object({ roll_number: roll, password: z.string().min(1).max(72) }),
  forgot: z.object({ roll_number: roll }),
  verifyOtp: z.object({ roll_number: roll, code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits') }),
  resetPassword: z.object({ reset_token: z.string().min(10), new_password: password }),

  checkin: z.object({
    session_id: uuid,
    room_token: z.string().regex(/^\d{4}$/, 'Room code must be 4 digits'),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    frames: attendanceFrames,
  }),

  startSession: z.object({
    session_id: uuid.optional(),
    title: z.string().trim().min(3).max(120).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radius_m: z.coerce.number().int().min(5).max(200).optional(),
    duration_minutes: z.coerce.number().int().min(5).max(480).optional(),
  }),
  scheduleSession: z.object({
    title: z.string().trim().min(3).max(120),
    starts_at: z.string().datetime({ offset: true }),
    ends_at: z.string().datetime({ offset: true }).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radius_m: z.coerce.number().int().min(5).max(200).optional(),
  }),
  sessionIdBody: z.object({ session_id: uuid }),

  updateProfile: z.object({
    bio: optionalText(500),
    skills: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
    github_handle: githubHandle.optional(),
    linkedin_url: z.string().trim().url().max(200).optional(),
    instagram_url: z.string().trim().url().max(200).optional(),
  }),
  project: z.object({
    title: z.string().trim().min(2).max(120),
    repo_url: z.string().trim().url().max(300),
    description: optionalText(500),
  }),

  flag: z.object({ reason: z.string().trim().min(3).max(300) }),
  event: z.object({
    title: z.string().trim().min(2).max(120),
    description: optionalText(500),
    event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  }),
  review: z.object({ decision: z.enum(['approve', 'reject']) }),
};

module.exports = s;
