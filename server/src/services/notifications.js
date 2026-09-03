import { supabase } from '../lib/supabase.js'
import { sendEmail } from '../lib/email.js'

export async function notify({
  user_id,
  message,
  transfer_id = null,
  grocery_order_id = null,
  email = false,
}) {
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id,
      message,
      transfer_id,
      grocery_order_id,
    })
    if (error) {
      console.log('Notification insert skipped:', error.message)
      return
    }

    if (!email) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user_id)
      .single()

    if (profile?.email) {
      await sendEmail({
        to: profile.email,
        subject: 'My30A Host',
        text: message,
      })
    }
  } catch (error) {
    console.log('Notification skipped:', error.message)
  }
}
