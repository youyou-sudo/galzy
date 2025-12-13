import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@shadcn/ui/components/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@shadcn/ui/components/select'
import { usePagination } from '@shadcn/ui/hooks/use-pagination'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

type PaginationProps = {
  currentPage: number
  totalPages: number
  paginationItemsToDisplay?: number
  setDatapage: (datapage: number) => void
  setLimit: (limit: number) => void
  limit?: number
}

export default function Component({
  currentPage,
  totalPages,
  paginationItemsToDisplay = 5,
  setDatapage,
  setLimit,
  limit = 10,
}: PaginationProps) {
  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage,
    totalPages,
    paginationItemsToDisplay,
  })

  const handlePageClick = (page: number) => {
    if (page !== currentPage) {
      setDatapage(page)
    }
  }

  const handleLimitChange = () => {
    setDatapage(1) // 切换条数时返回第1页
  }

  return (
    <div className="flex items-center justify-between gap-3">
      {/* Page number information */}
      <p
        className="text-muted-foreground flex-1 text-sm whitespace-nowrap"
        aria-live="polite"
      >
        Page <span className="text-foreground">{currentPage}</span> of
        <span className="text-foreground">{totalPages}</span>
      </p>

      {/* Pagination */}
      <div className="grow">
        <Pagination>
          <PaginationContent>
            {/* Previous page button */}
            <PaginationItem>
              <PaginationLink
                href={'#'}
                className="aria-disabled:pointer-events-none aria-disabled:opacity-50 cursor-pointer"
                onClick={() =>
                  currentPage > 1 && handlePageClick(currentPage - 1)
                }
                aria-label="Go to previous page"
                aria-disabled={currentPage === 1 ? true : undefined}
              >
                <ChevronLeftIcon size={16} aria-hidden="true" />
              </PaginationLink>
            </PaginationItem>

            {/* Left ellipsis */}
            {showLeftEllipsis && (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            )}

            {/* Page numbers */}
            {pages.map((page) => (
              <PaginationItem key={page}>
                <PaginationLink
                  href={'#'}
                  className="cursor-pointer"
                  isActive={page === currentPage}
                  onClick={() => handlePageClick(page)}
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}

            {/* Right ellipsis */}
            {showRightEllipsis && (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            )}

            {/* Next page button */}
            <PaginationItem>
              <PaginationLink
                href={'#'}
                className="aria-disabled:pointer-events-none aria-disabled:opacity-50 cursor-pointer"
                onClick={() =>
                  currentPage < totalPages && handlePageClick(currentPage + 1)
                }
                aria-label="Go to next page"
                aria-disabled={currentPage === totalPages ? true : undefined}
              >
                <ChevronRightIcon size={16} aria-hidden="true" />
              </PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>

      {/* Results per page */}
      <div className="flex flex-1 justify-end">
        <Select
          defaultValue={String(limit)}
          onValueChange={(value) => {
            setLimit(Number(value))
            handleLimitChange()
          }}
          aria-label="Results per page"
        >
          <SelectTrigger
            id="results-per-page"
            className="w-fit whitespace-nowrap"
          >
            <SelectValue placeholder="Select number of results" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 / page</SelectItem>
            <SelectItem value="20">20 / page</SelectItem>
            <SelectItem value="50">50 / page</SelectItem>
            <SelectItem value="100">100 / page</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
