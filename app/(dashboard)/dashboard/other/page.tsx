import { AddSubDialog } from "@/components/dashboard/other/addSub";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function page() {
  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between p-6">
          <div>
            <h1 className="text-3xl font-bold">条目信息补充</h1>
            <p className="mt-1 opacity-50">该页面用于补充条目信息</p>
          </div>
          <div className="flex items-center space-x-4">
            <AddSubDialog />
          </div>
        </div>
        <Card>
          <CardContent>
            <Table>
              <TableCaption>A list of your recent invoices.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Invoice</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">INV001</TableCell>
                  <TableCell>Paid</TableCell>
                  <TableCell>Credit Card</TableCell>
                  <TableCell className="text-right">$250.00</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
