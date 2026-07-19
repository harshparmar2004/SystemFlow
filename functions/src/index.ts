import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import * as crypto from "crypto";
import * as qrcode from "qrcode";
import { getFunctions } from "firebase-admin/functions";

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

async function generateTeamCode(eventId: string, eventPrefix: string): Promise<string> {
  const counterRef = db.collection('counters').doc(eventId);
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(counterRef);
    let count = 1;
    if (doc.exists) {
      count = (doc.data()?.count || 0) + 1;
    }
    transaction.set(counterRef, { count }, { merge: true });
    
    const paddedNumber = count.toString().padStart(4, '0');
    const hash = crypto.createHash('md5').update(`${eventPrefix}${count}`).digest('hex').substring(0, 2).toUpperCase();
    return `${eventPrefix}-${paddedNumber}-${hash}`;
  });
}

/**
 * Triggered when a team is created or updated.
 * If status changes to "pending", generate an OTP, save it, and email the lead.
 */
export const onTeamPending = functions.firestore
  .document("teams/{teamId}")
  .onWrite(async (change: any, context: any) => {
    const after = change.after.data();
    const before = change.before.data();

    // Only proceed if status changed to pending or it's a new pending team
    if (!after || after.status !== "pending") return null;
    if (before && before.status === "pending") return null;

    const teamId = context.params.teamId;
    const lead = after.members?.find((m: any) => m.role === "lead");

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
    } catch (error) {
      console.error("Error sending OTP email:", error);
    }
    return null;
  });

/**
 * Callable function to verify the OTP.
 */
export const verifyOtp = functions.https.onCall(async (data: any, context: any) => {
  const { teamId, otp } = data;
  if (!teamId || !otp) {
    throw new functions.https.HttpsError("invalid-argument", "Missing teamId or otp");
  }

  const otpDoc = await db.collection("otps").doc(teamId).get();
  if (!otpDoc.exists) {
    throw new functions.https.HttpsError("not-found", "OTP not found for this team");
  }

  const otpData = otpDoc.data();
  if (otpData?.otp !== otp) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid OTP");
  }

  if (otpData?.expiresAt.toMillis() < Date.now()) {
    throw new functions.https.HttpsError("failed-precondition", "OTP has expired");
  }

  const teamDoc = await db.collection("teams").doc(teamId).get();
  if (!teamDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Team not found");
  }
  const teamData = teamDoc.data();

  // Success, mark as verified and generate QR payload
  const eventId = teamData?.eventId || 'default';
  const eventPrefix = eventId.substring(0, 3).toUpperCase() || 'HAC';
  let teamCode = teamData?.teamCode;
  
  if (!teamCode) {
    teamCode = await generateTeamCode(eventId, eventPrefix);
  }

  const secret = process.env.QR_HMAC_SECRET || "default_development_secret_do_not_use_in_prod";
  const exp = Date.now() + 72 * 60 * 60 * 1000; // 72 hours
  const payloadObj = {
    teamId,
    teamCode,
    eventId: teamData?.eventId,
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
  } catch (err) {
    console.error("Error generating or uploading QR code:", err);
  }

  await db.collection("teams").doc(teamId).update({
    status: "verified",
    teamCode,
    qrPayload: signedPayload,
    qrSignatureExp: admin.firestore.Timestamp.fromMillis(exp),
    qrCodeUrl,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Delete the used OTP
  await db.collection("otps").doc(teamId).delete();

  return { success: true, message: "Team verified successfully", teamCode };
});

export const deliverQrTask = functions.tasks.taskQueue({
  retryConfig: {
    maxAttempts: 3,
    minBackoffSeconds: 30,
  }
}).onDispatch(async (data: any) => {
  const { teamId, channel = 'email' } = data;
  
  const teamDoc = await db.collection("teams").doc(teamId).get();
  if (!teamDoc.exists) return;
  const teamData = teamDoc.data();
  
  const attempts = (teamData?.deliveryAttempts || 0) + 1;
  await db.collection("teams").doc(teamId).update({ deliveryAttempts: attempts });

  try {
    if (channel === 'email') {
      const lead = teamData?.members?.find((m: any) => m.role === "lead");
      if (!lead || !lead.email || !teamData?.qrCodeUrl) {
        throw new Error("Missing email or QR code URL");
      }
      const mailOptions = {
        from: '"Hackathon Registration" <noreply@hackathon.com>',
        to: lead.email,
        subject: "Your Hackathon Check-in QR Code",
        text: `You are verified! Your team code is ${teamData?.teamCode}. Please find your check-in QR code attached.`,
        html: `<p>You are verified! Your team code is <strong>${teamData?.teamCode}</strong>. Please find your check-in QR code attached.</p>`,
        attachments: [
          {
            filename: "checkin-qr.png",
            path: teamData?.qrCodeUrl,
          },
        ],
      };
      await transporter.sendMail(mailOptions);
    } else if (channel === 'whatsapp') {
      const lead = teamData?.members?.find((m: any) => m.role === "lead");
      if (!lead || !lead.phone) {
        throw new Error("Missing phone number for WhatsApp delivery");
      }
      console.log(`[STUB] Sending WhatsApp message to ${lead.phone} with QR Code URL: ${teamData?.qrCodeUrl}`);
      // TODO: Insert Twilio API call here
      // const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      // await client.messages.create({
      //   body: `Your Hackathon Check-in QR Code is here! Team Code: ${teamData?.teamCode}`,
      //   from: 'whatsapp:+14155238886',
      //   to: `whatsapp:${lead.phone}`,
      //   mediaUrl: [teamData?.qrCodeUrl]
      // });
    }

    await db.collection("teams").doc(teamId).update({
      deliveryStatus: "delivered",
      deliveredVia: channel,
      deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  } catch (error) {
    if (attempts >= 3) {
      await db.collection("teams").doc(teamId).update({
        deliveryStatus: "failed"
      });
      console.error(`Delivery failed after 3 attempts for ${teamId}`, error);
    } else {
      throw error;
    }
  }
});

/**
 * Triggered when a team is verified.
 * Enqueues a task to email the QR code to the lead.
 */
export const onTeamVerified = functions.firestore
  .document("teams/{teamId}")
  .onWrite(async (change: any, context: any) => {
    const after = change.after.data();
    const before = change.before.data();

    if (!after || after.status !== "verified") return null;
    if (before && before.status === "verified") return null;

    const teamId = context.params.teamId;

    await db.collection("teams").doc(teamId).update({
      deliveryStatus: "pending",
      deliveryAttempts: 0
    });

    const queue = getFunctions().taskQueue("deliverQrTask");
    await queue.enqueue({ teamId, channel: 'email' });

    return null;
  });

export const resendQr = functions.https.onCall(async (data: any, context: any) => {
  const { teamId, channel } = data;
  if (!teamId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing teamId");
  }

  await db.collection("teams").doc(teamId).update({
    deliveryStatus: "pending",
    deliveryAttempts: 0
  });

  const queue = getFunctions().taskQueue("deliverQrTask");
  await queue.enqueue({ teamId, channel: channel || 'email' });

  return { success: true };
});

// Typed Response for Scanner
export type QrScanStatus = 
  | "SUCCESS"
  | "EXPIRED"
  | "DUPLICATE_SCAN"
  | "INVALID_SIGNATURE"
  | "NOT_VERIFIED";

/**
 * Callable function to verify a QR code scan.
 */
export const verifyQrScan = functions.https.onCall(async (data: any, context: any): Promise<{ status: QrScanStatus; message?: string }> => {
  const { signedPayload, gateId } = data;
  
  if (!signedPayload) {
    return { status: "INVALID_SIGNATURE", message: "Missing payload" };
  }
  
  // Volunteer check could be here: const volunteerId = context.auth?.uid;
  const volunteerId = context.auth?.uid || "unknown_volunteer";

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
  } catch (e) {
    // Buffer length mismatch throws error
    return { status: "INVALID_SIGNATURE" };
  }

  if (!isValid) {
    return { status: "INVALID_SIGNATURE" };
  }

  let payloadObj;
  try {
    payloadObj = JSON.parse(payloadStr);
  } catch (e) {
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
