import { createEmail } from 'unemail'
import resend from 'unemail/driver/resend'

const emailServer = createEmail({
  driver: resend({
    apiKey: process.env.EMAIL_KEY!,
  }),
})

export { emailServer }
