import { defineRoute } from "@teyik0/furin";
import OpenapiPage from "@web/components/openapi-page";
import { seoTemplate } from "@web/config/seoTemplate";

export const route = defineRoute("/openapi")
	.config({ mode: "ssr" })
	.head(() => ({
		meta: [{ title: `API 文档 | ${seoTemplate.title}` }],
	}))
	.page(() => <OpenapiPage />);
