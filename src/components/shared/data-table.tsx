"use client";

import { useMemo, useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type RowSelectionState,
  type OnChangeFn,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "./empty-state";
import {
  DataTableFacetedFilter,
  type FilterOption,
} from "./data-table-faceted-filter";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
} from "lucide-react";

import type { RowData } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    filterOptions?: FilterOption[];
  }
}

type DataTableBaseProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: TData) => void;
  noPagination?: boolean;
  initialSorting?: SortingState;
  initialColumnFilters?: ColumnFiltersState;
  /**
   * Told whenever the column sort changes. For a table whose rows can be
   * rearranged by hand: those controls have to know when the view is no
   * longer in the stored order.
   */
  onSortingChange?: (sorting: SortingState) => void;
};

export type DataTableProps<TData, TValue> =
  | (DataTableBaseProps<TData, TValue> & {
      enableRowSelection?: false;
    })
  | (DataTableBaseProps<TData, TValue> & {
      enableRowSelection: true;
      getRowId: (row: TData) => string;
      rowSelection?: RowSelectionState;
      onRowSelectionChange?: OnChangeFn<RowSelectionState>;
    });

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i);
  }

  const pages: (number | "ellipsis")[] = [0];

  if (current <= 2) {
    pages.push(1, 2, 3, "ellipsis", total - 1);
  } else if (current >= total - 3) {
    pages.push("ellipsis", total - 4, total - 3, total - 2, total - 1);
  } else {
    pages.push("ellipsis", current - 1, current, current + 1, "ellipsis", total - 1);
  }

  return pages;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search...",
  emptyTitle = "No results",
  emptyDescription = "No items found.",
  onRowClick,
  noPagination,
  initialSorting,
  initialColumnFilters,
  onSortingChange,
  ...rest
}: DataTableProps<TData, TValue>) {
  const enableRowSelection = rest.enableRowSelection === true;
  const rowSelectionProp =
    enableRowSelection && "rowSelection" in rest ? rest.rowSelection : undefined;
  const onRowSelectionChange =
    enableRowSelection && "onRowSelectionChange" in rest
      ? rest.onRowSelectionChange
      : undefined;
  const getRowId =
    enableRowSelection && "getRowId" in rest ? rest.getRowId : undefined;
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? []);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(initialColumnFilters ?? []);
  const [internalRowSelection, setInternalRowSelection] =
    useState<RowSelectionState>({});

  const rowSelection = rowSelectionProp ?? internalRowSelection;
  const setRowSelection = onRowSelectionChange ?? setInternalRowSelection;

  const selectColumn: ColumnDef<TData, unknown> = useMemo(
    () => ({
      id: "select",
      size: 40,
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all on page"
          indeterminate={
            table.getIsSomePageRowsSelected() &&
            !table.getIsAllPageRowsSelected()
          }
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(checked) =>
            table.toggleAllPageRowsSelected(checked)
          }
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label="Select row"
          checked={row.getIsSelected()}
          onCheckedChange={(checked) => row.toggleSelected(checked)}
        />
      ),
    }),
    []
  );

  const tableColumns = useMemo(
    () => (enableRowSelection ? [selectColumn, ...columns] : columns),
    [enableRowSelection, selectColumn, columns]
  );

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: (updater) => {
      setSorting((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        onSortingChange?.(next);
        return next;
      });
    },
    onColumnFiltersChange: setColumnFilters,
    enableRowSelection,
    onRowSelectionChange: setRowSelection,
    getRowId: enableRowSelection ? getRowId : undefined,
    state: { sorting, columnFilters, rowSelection },
    ...(noPagination && {
      initialState: { pagination: { pageSize: 999999 } },
    }),
  });

  const colSpan = tableColumns.length;

  const filterableColumns = table.getAllColumns().filter(
    (col) => col.columnDef.meta?.filterOptions?.length
  );

  const isFiltered = columnFilters.length > 0;

  const filteredRows = table.getFilteredRowModel().rows.length;
  const selectedRows = enableRowSelection
    ? table.getFilteredSelectedRowModel().rows.length
    : 0;
  const itemCountLabel = `${filteredRows} ${filteredRows === 1 ? "item" : "items"}`;

  const pageCount = table.getPageCount();
  const pageIndex = table.getState().pagination.pageIndex;
  const pageNumbers = getPageNumbers(pageIndex, pageCount);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {(searchKey || filterableColumns.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {searchKey && (
              <Input
                placeholder={searchPlaceholder}
                value={
                  (table.getColumn(searchKey)?.getFilterValue() as string) ??
                  ""
                }
                onChange={(e) =>
                  table.getColumn(searchKey)?.setFilterValue(e.target.value)
                }
                className="h-8 max-w-sm"
              />
            )}
            {filterableColumns.map((col) => (
              <DataTableFacetedFilter
                key={col.id}
                column={col}
                title={
                  typeof col.columnDef.header === "string"
                    ? col.columnDef.header
                    : col.id.charAt(0).toUpperCase() + col.id.slice(1)
                }
                options={col.columnDef.meta!.filterOptions!}
              />
            ))}
            {isFiltered && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => table.resetColumnFilters()}
              >
                Reset
                <X className="ml-1 size-3.5" />
              </Button>
            )}
          </div>
        )}
        <div className="text-sm text-muted-foreground">
          {enableRowSelection && selectedRows > 0 && (
            <span>{selectedRows} selected &middot; </span>
          )}
          <span>{itemCountLabel}</span>
        </div>
      </div>

      <div className="rounded-md border border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={
                      header.column.id === "select"
                        ? "w-10 max-w-10"
                        : undefined
                    }
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={onRowClick ? "cursor-pointer" : undefined}
                  onClick={
                    onRowClick
                      ? (e) => {
                          const target = e.target as HTMLElement;
                          if (target.closest("button, a, input, [role=menuitem]")) return;
                          onRowClick(row.original);
                        }
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={colSpan} className="h-48 text-center">
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {!noPagination && pageCount > 1 && (
        <div className="flex justify-end">
          <div className="flex flex-wrap items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.firstPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="First page"
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>

            {pageNumbers.map((page, i) =>
              page === "ellipsis" ? (
                <span
                  key={`ellipsis-${i}`}
                  className="flex size-7 items-center justify-center text-sm text-muted-foreground"
                >
                  ...
                </span>
              ) : (
                <Button
                  key={page}
                  variant={page === pageIndex ? "default" : "outline"}
                  size="icon-sm"
                  onClick={() => table.setPageIndex(page)}
                  aria-label={`Page ${page + 1}`}
                  aria-current={page === pageIndex ? "page" : undefined}
                >
                  {page + 1}
                </Button>
              )
            )}

            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.lastPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Last page"
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
