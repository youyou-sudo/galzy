import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@web/components/ui/breadcrumb";

export const Route = createFileRoute("/producer/")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="max-w-7xl mx-auto py-6 px-4 sm:px-0 space-y-4">
			<Breadcrumb className="mb-4">
				<BreadcrumbList>
					<BreadcrumbItem><BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink></BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem><BreadcrumbPage>厂商</BreadcrumbPage></BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
			<div className="flex justify-center items-center h-full text-[1.5rem]">
				该区域开发中
			</div>
		</div>
	);
}
