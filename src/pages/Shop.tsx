import { useCallback, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, X } from "lucide-react";
import {
  categoryService,
  creatorService,
  productService,
} from "../services/api";
import { useResource } from "../hooks/useResource";
import { ProductGrid } from "../components/ProductCard";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  PageHeading,
} from "../components/ui";
import { formatPrice } from "../utils/commerce";
export default function Shop() {
  const [params, setParams] = useSearchParams();
  const [drawer, setDrawer] = useState(false);
  const q = params.get("q") || "",
    category = params.get("category") || "",
    sort = params.get("sort") || "featured",
    rawMax = Number(params.get("max") || 6000),
    max = Number.isFinite(rawMax) ? Math.max(0, rawMax) : 6000,
    page = Math.max(1, Number(params.get("page")) || 1);
  const loader = useCallback(async () => {
    const [result, categories, creators] = await Promise.all([
      productService.list({
        search: q,
        category,
        sort,
        maxPrice: max,
        page,
        pageSize: 9,
      }),
      categoryService.list(),
      creatorService.list(),
    ]);
    return { ...result, categories, creators };
  }, [q, category, sort, max, page]);
  const { data, loading, error, retry } = useResource(loader);
  const update = (key: string, value: string) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      return next;
    });
  };
  const filters = (mobile: boolean) => (
    <>
      <div className="filterGroup">
        <h3>By craft</h3>
        <label>
          <input
            type="radio"
            name={mobile ? "category-mobile" : "category-desktop"}
            checked={!category}
            onChange={() => update("category", "")}
          />
          All handmade
        </label>
        {(data?.categories ?? []).map((c) => (
          <label key={c.id}>
            <input
              type="radio"
              name={mobile ? "category-mobile" : "category-desktop"}
              checked={category === c.id}
              onChange={() => update("category", c.id)}
            />
            {c.name}
          </label>
        ))}
      </div>
      <div className="filterGroup">
        <label htmlFor={mobile ? "price-mobile" : "price-desktop"}>
          Price up to {formatPrice(max)}
        </label>
        <input
          id={mobile ? "price-mobile" : "price-desktop"}
          type="range"
          min="0"
          max="6000"
          step="50"
          value={max}
          onChange={(e) => update("max", e.target.value)}
        />
        <div className="rangeLabels">
          <span>₹0</span>
          <span>₹6,000</span>
        </div>
      </div>
      <button className="textButton" onClick={() => setParams({})}>
        Clear all filters
      </button>
    </>
  );
  return (
    <div className="container page">
      <div className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>Shop
      </div>
      <PageHeading
        eyebrow="Made with care, collected with love"
        title="Find your kind of beautiful."
        description="Handmade objects and original art from independent studios across India."
      />
      <div className="shopToolbar">
        <form
          className="inlineSearch"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            update("q", String(form.get("q") || ""));
          }}
        >
          <Search size={18} />
          <input
            name="q"
            aria-label="Search products"
            placeholder="Search pieces, materials…"
            defaultValue={q}
            key={q}
          />
          <button className="textButton" type="submit">
            Search
          </button>
        </form>
        <button
          className="button secondary mobileOnly"
          onClick={() => setDrawer(true)}
        >
          <SlidersHorizontal size={16} />
          Filters
        </button>
        <label className="sortLabel">
          Sort by
          <select
            aria-label="Sort products"
            value={sort}
            onChange={(e) => update("sort", e.target.value)}
          >
            <option value="featured">Studio picks</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="name">Name: A–Z</option>
          </select>
        </label>
      </div>
      <div className="shopLayout">
        <aside className="shopFilters" aria-label="Product filters">
          {filters(false)}
        </aside>
        <div>
          <div className="resultsHeader">
            <span>
              {loading
                ? "Finding your next favourite…"
                : `${data?.total || 0} thoughtfully made pieces`}
            </span>
            {(q || category || max < 6000) && (
              <button className="textButton" onClick={() => setParams({})}>
                Reset filters
                <X size={13} />
              </button>
            )}
          </div>
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} retry={retry} />
          ) : data?.items.length ? (
            <>
              <ProductGrid
                products={data.items}
                creators={data.creators}
              />
              <nav className="pagination" aria-label="Product pages">
                <button
                  disabled={data.page <= 1}
                  onClick={() => update("page", String(data.page - 1))}
                >
                  Previous
                </button>
                <span>
                  Page {data.page} of {data.pages}
                </span>
                <button
                  disabled={data.page >= data.pages}
                  onClick={() => update("page", String(data.page + 1))}
                >
                  Next
                </button>
              </nav>
            </>
          ) : (
            <EmptyState
              title="Nothing here just yet."
              description="Try a different search or widen your filters. Your next favourite may be a little further afield."
            />
          )}
        </div>
      </div>
      <Modal
        title="Find your piece"
        open={drawer}
        onClose={() => setDrawer(false)}
        drawer
      >
        {filters(true)}
        <button className="button fullWidth" onClick={() => setDrawer(false)}>
          Show results
        </button>
      </Modal>
    </div>
  );
}
