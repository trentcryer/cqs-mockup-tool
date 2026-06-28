import { createAdminClient } from '@/lib/supabase/server'
import { sendBookingNotification } from '@/lib/send-booking-emails'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      groupId,
      customerName,
      customerEmail,
      customerPhone,
      selectedTier,
      requestedDate,
      eventDetails,
    } = body

    // Validate required fields
    if (!groupId || !customerName || !customerEmail || !selectedTier || !requestedDate) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()

    // Get group details
    const { data: group, error: groupError } = await supabase
      .from('profiles')
      .select('quartet_name, booking_contact_email, booking_tiers, group_type')
      .eq('id', groupId)
      .single()

    if (groupError || !group) {
      return Response.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    // Save booking request to database
    const { error: insertError } = await supabase
      .from('booking_requests')
      .insert({
        group_id: groupId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        selected_tier: selectedTier,
        requested_date: requestedDate,
        event_details: eventDetails,
        status: 'pending',
      } as any)

    if (insertError) throw insertError

    // Send booking notification emails
    try {
      await sendBookingNotification(
        group.quartet_name,
        group.booking_contact_email,
        customerName,
        customerEmail,
        selectedTier,
        requestedDate,
        eventDetails
      )
    } catch (emailError) {
      console.error('Error sending booking emails:', emailError)
      // Don't fail the request if email sending fails
      // The booking was still saved to the database
    }

    return Response.json({
      success: true,
      message: 'Booking request submitted successfully',
    })
  } catch (err: any) {
    console.error('[/api/retail/bookings]', err)
    return Response.json(
      { error: err.message || 'Failed to submit booking request' },
      { status: 500 }
    )
  }
}
