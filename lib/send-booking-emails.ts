import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendBookingNotification(
  groupName: string,
  groupEmail: string,
  customerName: string,
  customerEmail: string,
  selectedTier: string,
  requestedDate: string,
  eventDetails?: string,
) {
  try {
    // Email to group
    await resend.emails.send({
      from: 'bookings@customquartetstuff.com',
      to: groupEmail,
      subject: `New Booking Request: ${customerName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0a1633;">New Booking Request</h2>

          <div style="background: #f7f5f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Customer Name:</strong> ${customerName}</p>
            <p><strong>Customer Email:</strong> ${customerEmail}</p>
            <p><strong>Selected Tier:</strong> ${selectedTier}</p>
            <p><strong>Requested Date:</strong> ${requestedDate}</p>
            ${eventDetails ? `<p><strong>Event Details:</strong></p><p>${eventDetails}</p>` : ''}
          </div>

          <p>Log into your CQS Studio to view and respond to this booking request.</p>

          <a href="https://customquartetstuff.com/studio/bookings" style="display: inline-block; background: #b83b3f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px;">
            View Booking Request
          </a>
        </div>
      `,
    })

    // Confirmation email to customer
    await resend.emails.send({
      from: 'bookings@customquartetstuff.com',
      to: customerEmail,
      subject: `Your booking request for ${groupName} has been received`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0a1633;">Booking Request Received</h2>

          <p>Hi ${customerName},</p>

          <p>Thank you for your interest in booking <strong>${groupName}</strong>!</p>

          <div style="background: #f7f5f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Package:</strong> ${selectedTier}</p>
            <p><strong>Requested Date:</strong> ${requestedDate}</p>
          </div>

          <p>We've received your booking request and will get back to you shortly at <strong>${customerEmail}</strong>.</p>

          <p>Thanks,<br/>Custom Quartet Stuff</p>
        </div>
      `,
    })

    return { success: true }
  } catch (error) {
    console.error('Error sending booking emails:', error)
    throw error
  }
}
