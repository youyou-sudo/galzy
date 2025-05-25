"use server";
import { db } from "@/lib/kysely";

export const workerDataPull = async () => {
  const data = await db.selectFrom("galrc_cloudflare").selectAll().execute();

  await Promise.all(
    data.map(async (item) => {
      try {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");
        const dateStr = `${yyyy}-${mm}-${dd}`;

        const raw = JSON.stringify({
          query: `query getBillingMetrics($accountTag: String!, $datetimeStart: String!, $datetimeEnd: String!, $scriptName: String!) { viewer { accounts(filter: {accountTag: $accountTag}) { workersInvocationsAdaptive(limit: 10, filter: { scriptName: $scriptName, date_geq: $datetimeStart, date_leq: $datetimeEnd }) { sum { duration requests subrequests responseBodySize errors }}}}}`,
          variables: {
            accountTag: item.account_id,
            datetimeStart: dateStr,
            datetimeEnd: dateStr,
            scriptName: item.woker_name,
          },
        });

        const res = await fetch(
          "https://api.cloudflare.com/client/v4/graphql",
          {
            method: "POST",
            headers: {
              "X-Auth-Email": item.a_email,
              "X-Auth-Key": item.a_key,
              "Content-Type": "text/plain",
              Accept: "*/*",
              Host: "api.cloudflare.com",
            },
            body: raw,
            redirect: "follow",
          }
        );
        const res2 = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${item.account_id}/workers/services/${item.woker_name}/environments/production?expand=routes`,
          {
            method: "GET",
            headers: {
              "X-Auth-Email": item.a_email,
              "X-Auth-Key": item.a_key,
              Accept: "*/*",
              Host: "api.cloudflare.com",
            },
          }
        );

        const json = await res.json();
        const json2 = await res2.json();

        const result =
          json?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive?.[0]
            ?.sum ?? {};
        const result2 = json2.result.script.routes[0].pattern ?? {};
        const cleanDomain = result2.replace(/\*$/, "").replace(/\/+$/, "");
        const url = `https://${cleanDomain}`;

        await db
          .updateTable("galrc_cloudflare")
          .set({
            duration: result.duration ?? 0,
            errors: result.errors?.toString() ?? "0",
            requests: result.requests?.toString() ?? "0",
            responseBodySize: result.responseBodySize?.toString() ?? "0",
            subrequests: result.subrequests?.toString() ?? "0",
            url_endpoint: url,
            updateTime: new Date(),
          })
          .where("id", "=", item.id)
          .execute();
      } catch (err) {
        throw new Error(`请求失败: ${item.account_id}, ${err}`);
      }
    })
  );
};
