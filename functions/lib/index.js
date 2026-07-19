"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyQrScan = exports.onTeamVerified = exports.verifyOtp = exports.onTeamPending = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const qrcode = require("qrcode");
admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();
// Configure Nodemailer transporter (placeholder configuration)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.example.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
        user: process.env.SMTP_USER || "user@example.com",
        pass: process.env.SMTP_PASS || "password",
    },
});
// Helper to generate a 6-digit OTP
const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};
/**
 * Triggered when a team is created or updated.
 * If status changes to "pending", generate an OTP, save it, and email the lead.
 */
exports.onTeamPending = functions.firestore
    .document("teams/{teamId}")
    .onWrite(async (change, context) => {
    var _a;
    const after = change.after.data();
    const before = change.before.data();
    // Only proceed if status changed to pending or it's a new pending team
    if (!after || after.status !== "pending")
        return null;
    if (before && before.status === "pending")
        return null;
    const teamId = context.params.teamId;
    const lead = (_a = after.members) === null || _a === void 0 ? void 0 : _a.find((m) => m.role === "lead");
    if (!lead || !lead.email) {
        console.error("Team lead or lead email not found for team:", teamId);
        return null;
    }
    const otp = generateOtp();
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000)); // 10 mins
    // Save OTP
    await db.collection("otps").doc(teamId).set({
        otp,
        expiresAt,
        email: lead.email,
    });
    // Send email
    const mailOptions = {
        from: '"Hackathon Registration" <noreply@hackathon.com>',
        to: lead.email,
        subject: "Verify Your Hackathon Registration",
        text: `Your OTP for team registration is: ${otp}. It expires in 10 minutes.`,
        html: `<p>Your OTP for team registration is: <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
    };
    try {
        await transporter.sendMail(mailOptions);
        // Update team status to otp_sent
        await db.collection("teams").doc(teamId).update({
            status: "otp_sent",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`OTP sent to ${lead.email} for team ${teamId}`);
    }
    catch (error) {
        console.error("Error sending OTP email:", error);
    }
    return null;
});
/**
 * Callable function to verify the OTP.
 */
exports.verifyOtp = functions.https.onCall(async (data, context) => {
    const { teamId, otp } = data;
    if (!teamId || !otp) {
        throw new functions.https.HttpsError("invalid-argument", "Missing teamId or otp");
    }
    const otpDoc = await db.collection("otps").doc(teamId).get();
    if (!otpDoc.exists) {
        throw new functions.https.HttpsError("not-found", "OTP not found for this team");
    }
    const otpData = otpDoc.data();
    if ((otpData === null || otpData === void 0 ? void 0 : otpData.otp) !== otp) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid OTP");
    }
    if ((otpData === null || otpData === void 0 ? void 0 : otpData.expiresAt.toMillis()) < Date.now()) {
        throw new functions.https.HttpsError("failed-precondition", "OTP has expired");
    }
    const teamDoc = await db.collection("teams").doc(teamId).get();
    if (!teamDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Team not found");
    }
    const teamData = teamDoc.data();
    // Success, mark as verified and generate QR payload
    const secret = process.env.QR_HMAC_SECRET || "default_development_secret_do_not_use_in_prod";
    const exp = Date.now() + 72 * 60 * 60 * 1000; // 72 hours
    const payloadObj = {
        teamId,
        eventId: teamData === null || teamData === void 0 ? void 0 : teamData.eventId,
        exp,
    };
    const payloadStr = JSON.stringify(payloadObj);
    const signature = crypto.createHmac("sha256", secret).update(payloadStr).digest("hex");
    const signedPayload = `${payloadStr}|${signature}`;
    // Generate QR Code image
    let qrCodeUrl = "";
    try {
        const qrBuffer = await qrcode.toBuffer(signedPayload, { type: "png" });
        const bucket = storage.bucket();
        const file = bucket.file(`qrcodes/${teamId}.png`);
        await file.save(qrBuffer, {
            metadata: { contentType: "image/png" },
        });
        // Make file public to get a download URL (or use signed URLs)
        await file.makePublic();
        qrCodeUrl = file.publicUrl();
    }
    catch (err) {
        console.error("Error generating or uploading QR code:", err);
    }
    await db.collection("teams").doc(teamId).update({
        status: "verified",
        qrPayload: signedPayload,
        qrSignatureExp: admin.firestore.Timestamp.fromMillis(exp),
        qrCodeUrl,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // Delete the used OTP
    await db.collection("otps").doc(teamId).delete();
    return { success: true, message: "Team verified successfully" };
});
/**
 * Triggered when a team is verified.
 * Emails the QR code to the lead.
 */
exports.onTeamVerified = functions.firestore
    .document("teams/{teamId}")
    .onWrite(async (change, context) => {
    var _a;
    const after = change.after.data();
    const before = change.before.data();
    if (!after || after.status !== "verified")
        return null;
    if (before && before.status === "verified")
        return null;
    const teamId = context.params.teamId;
    const lead = (_a = after.members) === null || _a === void 0 ? void 0 : _a.find((m) => m.role === "lead");
    if (!lead || !lead.email || !after.qrCodeUrl) {
        console.error("Missing lead email or QR code URL for verified team:", teamId);
        return null;
    }
    const mailOptions = {
        from: '"Hackathon Registration" <noreply@hackathon.com>',
        to: lead.email,
        subject: "Your Hackathon Check-in QR Code",
        text: "You are verified! Please find your check-in QR code attached.",
        html: "<p>You are verified! Please find your check-in QR code attached.</p>",
        attachments: [
            {
                filename: "checkin-qr.png",
                path: after.qrCodeUrl, // Nodemailer can fetch from URL
            },
        ],
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log(`QR code emailed to ${lead.email} for team ${teamId}`);
    }
    catch (error) {
        console.error("Error sending QR email:", error);
    }
    return null;
});
/**
 * Callable function to verify a QR code scan.
 */
exports.verifyQrScan = functions.https.onCall(async (data, context) => {
    var _a;
    const { signedPayload, gateId } = data;
    if (!signedPayload) {
        return { status: "INVALID_SIGNATURE", message: "Missing payload" };
    }
    // Volunteer check could be here: const volunteerId = context.auth?.uid;
    const volunteerId = ((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid) || "unknown_volunteer";
    const parts = signedPayload.split("|");
    if (parts.length !== 2) {
        return { status: "INVALID_SIGNATURE" };
    }
    const [payloadStr, signature] = parts;
    const secret = process.env.QR_HMAC_SECRET || "default_development_secret_do_not_use_in_prod";
    const expectedSignature = crypto.createHmac("sha256", secret).update(payloadStr).digest("hex");
    // Constant time compare
    let isValid = false;
    try {
        isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    }
    catch (e) {
        // Buffer length mismatch throws error
        return { status: "INVALID_SIGNATURE" };
    }
    if (!isValid) {
        return { status: "INVALID_SIGNATURE" };
    }
    let payloadObj;
    try {
        payloadObj = JSON.parse(payloadStr);
    }
    catch (e) {
        return { status: "INVALID_SIGNATURE" };
    }
    const { teamId, exp } = payloadObj;
    if (Date.now() > exp) {
        return { status: "EXPIRED" };
    }
    const teamDoc = await db.collection("teams").doc(teamId).get();
    if (!teamDoc.exists) {
        return { status: "NOT_VERIFIED" };
    }
    const teamData = teamDoc.data();
    if (!teamData) {
        return { status: "NOT_VERIFIED" };
    }
    if (teamData.status === "checked_in") {
        return { status: "DUPLICATE_SCAN" };
    }
    if (teamData.status !== "verified") {
        return { status: "NOT_VERIFIED", message: "Team is not in verified state" };
    }
    // Success, mark as checked_in
    const batch = db.batch();
    batch.update(teamDoc.ref, {
        status: "checked_in",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const checkInRef = teamDoc.ref.collection("checkIns").doc();
    batch.set(checkInRef, {
        scannedBy: volunteerId,
        gateId: gateId || "main_gate",
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    await batch.commit();
    return { status: "SUCCESS", message: `Team ${teamData.teamName} checked in successfully` };
});
//# sourceMappingURL=index.js.map