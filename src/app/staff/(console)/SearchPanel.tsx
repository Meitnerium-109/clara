"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Spinner } from "@/components/ui/Spinner";
import type { OrderListItem } from "@/server/staffData";
import { OrdersTable } from "./OrdersTable";
import { searchOrdersAction } from "./searchActions";

export function SearchPanel({ initial }: { initial: OrderListItem[] }) {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState<string | null>(null);
  const [orders, setOrders] = useState(initial);
  const [failed, setFailed] = useState(false);
  const [searching, startSearch] = useTransition();

  function run(q: string) {
    startSearch(async () => {
      try {
        const result = await searchOrdersAction(q);
        setFailed(!result.ok);
        if (result.ok) {
          setOrders(result.orders);
          setSearched(q.trim() || null);
        }
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <section aria-labelledby="search-heading" className="flex flex-col gap-4">
      <form
        role="search"
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(query);
        }}
      >
        <label htmlFor="order-search" id="search-heading" className="sr-only">
          Search orders
        </label>
        <input
          id="order-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, mobile (last 4+ digits) or order ID"
          maxLength={100}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3.5"
        />
        <Button type="submit" loading={searching}>
          Search
        </Button>
        {searched && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setQuery("");
              run("");
            }}
          >
            Clear
          </Button>
        )}
      </form>

      <p className="text-sm text-ink-muted" aria-live="polite">
        {searching ? (
          <span className="inline-flex items-center gap-2">
            <Spinner label={null} className="h-4 w-4" /> Searching…
          </span>
        ) : searched ? (
          `${orders.length} result${orders.length === 1 ? "" : "s"} for “${searched}”`
        ) : (
          "Most recently updated orders"
        )}
      </p>

      {failed ? (
        <ErrorState message="Search failed. Please try again." action={<Button onClick={() => run(query)}>Try again</Button>} />
      ) : orders.length === 0 ? (
        <EmptyState
          title={searched ? "No orders match" : "No orders yet"}
          message={searched ? "Check the spelling, or try the order ID or the last 4 digits of the mobile." : "Import an LIS file to get started."}
        />
      ) : (
        <OrdersTable orders={orders} />
      )}
    </section>
  );
}
