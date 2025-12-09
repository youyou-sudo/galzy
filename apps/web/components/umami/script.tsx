import Script from 'next/script'
import '@web/lib/env'

export default function UmamiScript() {
  if (process.env.NODE_ENV !== 'production') return null

  const umami_script_url = process.env.UMAMI_SCRIPT_URL
  const umami_website_id = process.env.UMAMI_DATA_WEBSITE_ID
  if (!umami_script_url || !umami_website_id) return null

  return (
    <Script defer src={`${umami_script_url}`} data-website-id={umami_website_id} />
  )
}
