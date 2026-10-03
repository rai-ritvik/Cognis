const supabase = require('../config/supabaseClient');

const startSession = async (req, res) => {
    try {
        const { title, latitude, longitude } = req.body;

        if (!title || !latitude || !longitude)
            return res.status(400).json({ error: "Missing required session details." });

        const initial_token = Math.floor(1000 + Math.random() * 9000).toString();
        const wkt_location = `POINT(${longitude} ${latitude})`;

        const { data, error } = await supabase.from('sessions').insert([{
            title, status: 'ACTIVE', current_room_token: initial_token, radius_m: 15, lab_location: wkt_location
        }]).select();

        if (error)
            return res.status(500).json({ error: "Failed to create class session." });

        res.json({ message: "Session started successfully!", session_id: data[0].id, current_room_token: data[0].current_room_token });
    }
    catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const endSession = async (req, res) => {
    try {
        const { session_id } = req.body;

        if (!session_id)
            return res.status(400).json({ error: "Missing session_id." });

        const { error } = await supabase.from('sessions').update({ status: 'CLOSED', current_room_token: null }).eq('id', session_id);

        if (error)
            return res.status(500).json({ error: "Failed to close the session." });

        res.json({ message: "Session officially closed. No more check-ins allowed." });
    }
    catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const rotateToken = async (req, res) => {
    try {
        const { session_id } = req.body;

        if (!session_id)
            return res.status(400).json({ error: "Missing session_id." });

        const new_token = Math.floor(1000 + Math.random() * 9000).toString();
        const { data, error } = await supabase.from('sessions').update({ current_room_token: new_token }).eq('id', session_id).eq('status', 'ACTIVE').select();

        if (error || data.length === 0)
            return res.status(400).json({ error: "Failed to rotate token. Is the class still active?" });

        res.json({ message: "Token rotated successfully.", new_room_token: new_token });
    }
    catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const getAttendance = async (req, res) => {
    try {
        const { session_id } = req.params;
        const { data, error } = await supabase.from('attendance').select(`status, created_at, members(roll_number)`).eq('session_id', session_id);

        if (error)
            return res.status(500).json({ error: "Failed to fetch attendance data." });

        const formattedList = data.map(record => ({
            roll_number: record.members.roll_number, status: record.status, time_logged: record.created_at
        }));
        res.json({ total_present: formattedList.length, students: formattedList });
    }
    catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
};

module.exports = { startSession, endSession, rotateToken, getAttendance };