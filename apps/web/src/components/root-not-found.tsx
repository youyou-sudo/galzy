import Errors from "@web/components/error";

export default function RootNotFound() {
	return <Errors code="404" errormessage="页面不存在" />;
}
