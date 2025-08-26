import { env } from "next-runtime-env";
import Script from "next/script";
import React from "react";

export default async function UmamiScript() {
  return (
    <Script
      src={`${env("UMAMI_URL")}/script.js`}
      data-website-id={`${env("UMAMI_DATA_WEBSITE_ID")}`}
      defer
    />
  );
}
