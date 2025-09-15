import Script from 'next/script'
import '@web/lib/env'

export default async function UmamiScript() {
  return (
    <Script
      src={`${process.env.UMAMI_URL}/script.js`}
      data-website-id={`${process.env.UMAMI_DATA_WEBSITE_ID}`}
      defer
    />
  )
}
