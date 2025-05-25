const res2 = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/c233c3beaad0e9252a83b5cd16e60718/workers/services/sweet-fog-4805/environments/production?expand=routes`,
  {
    method: "GET",
    headers: {
      "X-Auth-Email": "jerryyang.xyy@outlook.com",
      "X-Auth-Key": "05b032629b3f0a9f5eb4911d34307a6611350",
      Accept: "*/*",
      Host: "api.cloudflare.com",
    },
  }
);

const json2 = await res2.json();
console.log(json2.result.script.routes[0].pattern);
