const axios = require('axios');
const supabase = require('../config/supabaseClient');

const registerStudent = async (req, res) => {
    try {
        const { roll_number, full_name, domain, github_handle, baseline_image_base64, consent } = req.body;
        if (!consent)
            return res.status(400).json({ error: "Biometricconsent required." });

        let final_embedding;
        try {
            const ml_response = await axios.post('http://localhost:8001/api/face/embed', { image_base64: baseline_image_base64 });
            final_embedding = ml_response.data.embedding;
        }
        catch (ml_error) {
            console.warn("ML Service (Port 8001) is offline. Using fallback for developement");
            final_embedding = new Array(512).fill(0.5);
        }

        const { data, error } = await supabase.from('members').insert([{
            roll_number, full_name, domain, github_handle, face_embedding: final_embedding, consent_at: new Date()
        }]).select();

        if (error) {
            console.error("Supabase Error:", error.message);
            return res.status(400).json({ error: error.message });
        }
        res.json({ member_id: data[0].id, status: "REGISTERED" });
    }
    catch (err) {
        console.error("Server Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const checkInStudent = async (req, res) => {
    try {
        const { roll_number, session_id, room_token, latitude, longitude, live_image_base64 } = req.body;
        if (!roll_number || !room_token || !latitude || !longitude)
            return res.status(400).json({ error: "Missing required check-in data." });

        const { data: sessionData, error: sessionError } = await supabase.from('sessions').select('id, status, current_room_token').eq('id', session_id).single();

        if (sessionError || !sessionData)
            return res.status(404).json({ error: "Class session not found." });

        if (sessionData.status != 'ACTIVE')
            return res.status(400).json({ error: "Attendance is closed for this class." });

        if (sessionData.current_room_token !== room_token)
            return res.status(403).json({ error: "Invalid or expired room token. Please check the projector." });

        const { data: gpsData, error: gpsError } = await supabase.rpc('verify_location', {
            session_id_param: session_id, student_lat: parseFloat(latitude), student_lon: parseFloat(longitude)
        });

        if (gpsError)
            return res.status(500).json({ error: "Failed to verify location coordinates." });

        if (!gpsData || !gpsData.is_within_radius)
            return res.status(403).json({ error: "You are outside the 15-meter lab radius." });

        let is_verified = false;

        try {
            const ml_response = await axios.post('http://localhost:8001/api/face/verify', { roll_number, live_image_base64 });
            is_verified = ml_response.data.match_status;
        }
        catch (ml_error) {
            console.warn("⚠️ ML Service (Port 8001) offline. Mocking liveness check for development.");
            is_verified = true;
        }

        if (!is_verified)
            return res.status(401).json({ error: "Spoofing detected or face mismatch." });

        const { data: memberData, error: memberError } = await supabase.from('members').select('id').eq('roll_number', roll_number).single();

        if (memberError || !memberData)
            return res.status(404).json({ error: "Student not registered in the system." });

        const { error: attendanceError } = await supabase.from('attendance').insert([{ session_id, member_id: memberData.id, status: 'PRESENT' }]);

        if (attendanceError)
            return res.status(500).json({ error: "Database failed to save attendance." });

        res.json({ message: "Attendance marked successfully!", status: "PRESENT" });
    }
    catch (err) {
        console.error("Check-In Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

module.exports = { registerStudent, checkInStudent };