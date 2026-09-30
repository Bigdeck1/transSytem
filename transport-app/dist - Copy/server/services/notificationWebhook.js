"use strict";
/**
 * JRR Transport — Customer Milestone Email Dispatcher
 * Sends branded, responsive status update emails to shipment recipients.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCustomerMilestoneEmail = sendCustomerMilestoneEmail;
exports.sendMilestoneNotification = sendMilestoneNotification;
const nodemailer_1 = __importDefault(require("nodemailer"));
async function sendCustomerMilestoneEmail(payload) {
    if (!payload.recipientEmail || !payload.recipientEmail.includes("@")) {
        console.log(`[Email Dispatcher] Skipped: No valid recipient email for trip #${payload.tripNumber}`);
        return { success: false, message: "No valid recipient email provided." };
    }
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER || "rencyanimation@gmail.com";
    const pass = process.env.SMTP_PASS || "jnesrgodboczskdn";
    const transporter = nodemailer_1.default.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    });
    const baseUrl = process.env.APP_PUBLIC_URL || process.env.BASE_URL || "http://192.168.1.5:3000";
    const activeCode = payload.trackingCode || payload.tripNumber;
    const trackingUrl = `${baseUrl}/track/${encodeURIComponent(activeCode)}`;
    // Theme color and copy per status
    let statusBadgeColor = "#2563eb";
    let statusBadgeText = "ORDER BOOKED";
    let headline = "Your Shipment Has Been Booked";
    let leadText = `Your shipment <strong>#${payload.tripNumber}</strong> has been logged in the JRR Transport logistics system and scheduled for dispatch from our Morong Depot.`;
    switch (payload.status) {
        case "in-transit":
            statusBadgeColor = "#2563eb";
            statusBadgeText = "OUT FOR DELIVERY";
            headline = "Your Shipment is Out for Delivery";
            leadText = `Great news! Your package is currently on board with driver <strong>${payload.driverName || "our fleet"}</strong> and is en route to your delivery address.`;
            break;
        case "approaching":
            statusBadgeColor = "#d97706";
            statusBadgeText = "ARRIVING SOON";
            headline = "Driver is 10-15 Minutes Away";
            leadText = `Our delivery vehicle is approaching your destination. Please ensure an authorized recipient is present to receive the parcel and provide signature.`;
            break;
        case "delivered":
            statusBadgeColor = "#16a34a";
            statusBadgeText = "DELIVERED ✓";
            headline = "Package Successfully Delivered";
            leadText = `Your delivery has been completed successfully and received by <strong>${payload.podRecipientName || payload.recipientName}</strong>. Thank you for choosing JRR Transport!`;
            break;
        case "failed":
            statusBadgeColor = "#dc2626";
            statusBadgeText = "DELIVERY ATTEMPTED";
            headline = "Delivery Attempt Unsuccessful";
            leadText = `Our driver attempted delivery for shipment <strong>#${payload.tripNumber}</strong>, but was unable to complete drop-off (${payload.failureReason || "Recipient unavailable"}). Please contact dispatch for re-attempt options.`;
            break;
    }
    // Format Driver Live GPS & Map link if available
    let driverLocationRow = "";
    if (payload.driverLocation && payload.driverLocation.latitude && payload.driverLocation.longitude) {
        const lat = Number(payload.driverLocation.latitude);
        const lng = Number(payload.driverLocation.longitude);
        const speed = payload.driverLocation.speed !== undefined ? Math.round(Number(payload.driverLocation.speed)) : null;
        const gmapsLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        driverLocationRow = `
      <tr>
        <td style="padding: 6px 0; color: #64748b;">Live Driver GPS:</td>
        <td style="padding: 6px 0; font-weight: 700; text-align: right;">
          <a href="${gmapsLink}" target="_blank" style="color: #0284c7; text-decoration: underline;">
            📍 Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}
          </a>
          ${speed !== null ? `<span style="font-size: 11px; color: #10b981; margin-left: 6px;">(${speed} km/h)</span>` : ""}
        </td>
      </tr>
    `;
    }
    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${headline}</title>
    </head>
    <body style="margin: 0; padding: 20px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 0.5px;">JRR TRANSPORT</h1>
          <p style="margin: 4px 0 0; font-size: 12px; color: #93c5fd; letter-spacing: 0.5px;">FLEET LOGISTICS & FREIGHT SERVICES</p>
        </div>

        <!-- Main Content -->
        <div style="padding: 30px 24px;">
          
          <div style="margin-bottom: 16px;">
            <span style="display: inline-block; background: ${statusBadgeColor}; color: #ffffff; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 20px; letter-spacing: 0.5px;">
              ${statusBadgeText}
            </span>
          </div>

          <h2 style="color: #0f172a; margin: 0 0 12px 0; font-size: 20px; font-weight: 800;">${headline}</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
            Hello <strong>${payload.recipientName}</strong>,<br>
            ${leadText}
          </p>

          <!-- Tracking Code Highlight Box -->
          <div style="background: #eff6ff; border: 1px dashed #3b82f6; border-radius: 12px; padding: 14px 18px; margin: 18px 0; text-align: center;">
            <div style="font-size: 11px; font-weight: 700; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
              Your Tracking Reference Code
            </div>
            <div style="font-family: 'Courier New', monospace; font-size: 22px; font-weight: 800; color: #1e3a8a; letter-spacing: 1.5px;">
              ${activeCode}
            </div>
          </div>

          <!-- Shipment Summary Card -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; margin: 20px 0;">
            <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.5px;">
              Shipment Details & Telematics
            </div>
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Order Number:</td>
                <td style="padding: 6px 0; font-weight: 700; color: #0f172a; text-align: right;">#${payload.tripNumber}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Tracking Code:</td>
                <td style="padding: 6px 0; font-weight: 700; color: #1e40af; text-align: right;">${activeCode}</td>
              </tr>
              ${payload.driverName
        ? `<tr>
                      <td style="padding: 6px 0; color: #64748b;">Assigned Driver:</td>
                      <td style="padding: 6px 0; font-weight: 700; color: #0f172a; text-align: right;">${payload.driverName}</td>
                    </tr>`
        : ""}
              ${driverLocationRow}
              ${payload.deliveryLocation
        ? `<tr>
                      <td style="padding: 6px 0; color: #64748b;">Delivery Address:</td>
                      <td style="padding: 6px 0; font-weight: 600; color: #334155; text-align: right;">${payload.deliveryLocation}</td>
                    </tr>`
        : ""}
            </table>
          </div>

          <!-- Live Tracking CTA -->
          <div style="text-align: center; margin: 28px 0 16px 0;">
            <a href="${trackingUrl}" target="_blank" style="background: #1e40af; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-size: 14px; font-weight: 700; display: inline-block; box-shadow: 0 4px 12px rgba(30,64,175,0.25);">
              Track Live Shipment Radar 🚚
            </a>
            <div style="margin-top: 10px; font-size: 11px; color: #64748b;">
              Direct Link: <a href="${trackingUrl}" style="color: #2563eb; text-decoration: underline;">${trackingUrl}</a>
            </div>
          </div>
        </div>

          <!-- Live Tracking CTA -->
          <div style="text-align: center; margin: 28px 0 16px 0;">
            <a href="${trackingUrl}" target="_blank" style="background: #1e40af; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-size: 14px; font-weight: 700; display: inline-block; box-shadow: 0 4px 12px rgba(30,64,175,0.25);">
              Track Live Shipment Radar 🚚
            </a>
            <div style="margin-top: 10px; font-size: 11px; color: #64748b;">
              Direct Link: <a href="${trackingUrl}" style="color: #2563eb; text-decoration: underline;">${trackingUrl}</a>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.5;">
          <strong style="color: #334155;">JRR Main Logistics HQ Depot</strong><br>
          Malalim St, Sitio Malalim, Morong, 1960 Rizal<br>
          <span style="font-size: 11px; color: #94a3b8; display: block; margin-top: 6px;">
            This is an automated notification. For dispatch inquiries, reply directly or call dispatch support.
          </span>
        </div>

      </div>
    </body>
    </html>
  `;
    await transporter.sendMail({
        from: `"JRR Transport Dispatch" <${user}>`,
        to: payload.recipientEmail,
        subject: `[JRR Transport] Update: Shipment #${payload.tripNumber} — ${headline}`,
        html: htmlTemplate,
    });
    console.log(`[Email Dispatcher] Successfully sent email to ${payload.recipientEmail} for #${payload.tripNumber}`);
    return { success: true, message: `Email delivered to ${payload.recipientEmail}` };
}
// Backward compatibility alias
async function sendMilestoneNotification(payload) {
    return sendCustomerMilestoneEmail(payload);
}
//# sourceMappingURL=notificationWebhook.js.map