import { defineRoute } from "@teyik0/furin";
import ContactPage from "@web/components/contact-page";
import { seoTemplate } from "@web/config/seoTemplate";

export const route = defineRoute("/contact")
	.config({ mode: "ssr" })
	.head(() => ({
		meta: [{ title: `联系喵喵们 | ${seoTemplate.title}` }],
	}))
	.page(() => <ContactPage />);
