import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, ShoppingBag } from "lucide-react";
import type { Creator, Product } from "../types/domain";
import { formatPrice } from "../utils/commerce";
import { useStudio } from "../context/StudioContext";
import styles from "./ProductCard.module.css";
export function ProductCard({
  product,
  creator,
}: {
  product: Product;
  creator?: Creator;
}) {
  const { wishlist, toggleWishlist, cart, addToCart, busy } = useStudio();
  const [adding, setAdding] = useState(false);
  const saved = wishlist.includes(product.id);
  const inBag = cart.find((item) => item.productId === product.id)?.quantity ?? 0;
  const unavailable = product.status !== "active" || product.stock <= 0;
  const atLimit = !unavailable && inBag >= product.stock;
  const add = async () => {
    if (busy || adding || unavailable || atLimit) return;
    setAdding(true);
    try { await addToCart(product.id, 1); }
    finally { setAdding(false); }
  };
  return (
    <article className={styles.card}>
      <div className={styles.visual}>
        <Link to={`/products/${product.id}`} tabIndex={-1} aria-hidden="true">
          <img
            src={product.images[0]}
            alt=""
            loading="lazy"
            width="500"
            height="600"
          />
          {product.images[1] && (
            <img
              className={styles.secondary}
              src={product.images[1]}
              alt=""
              loading="lazy"
              width="500"
              height="600"
            />
          )}
        </Link>
        {product.stock === 0 && (
          <span className={styles.sold}>Currently unavailable</span>
        )}
        <button
          className={styles.wishlist}
          aria-label={`${saved ? "Remove" : "Save"} ${product.name} ${saved ? "from" : "to"} wishlist`}
          aria-pressed={saved}
          onClick={() => toggleWishlist(product.id)}
        >
          <Heart
            size={18}
            strokeWidth={1.4}
            fill={saved ? "currentColor" : "none"}
          />
        </button>
      </div>
      <div className={styles.info}>
        <p className={styles.creator}>{creator?.studio}</p>
        <div className={styles.row}>
          <h3>
            <Link to={`/products/${product.id}`}>{product.name}</Link>
          </h3>
          <span>{formatPrice(product.price)}</span>
        </div>
        <p className={styles.meta}>{product.material.split(",")[0]}</p>
        <button
          type="button"
          className={`button secondary ${styles.add}`}
          disabled={busy || adding || unavailable || atLimit}
          aria-busy={adding}
          aria-label={unavailable ? `${product.name} is currently unavailable` : atLimit ? `Stock limit reached for ${product.name}` : `Add ${product.name} to bag`}
          onClick={add}
        >
          <ShoppingBag size={16} aria-hidden="true" />
          {unavailable ? "Sold out" : atLimit ? "Stock limit reached" : adding ? "Adding…" : "Add to bag"}
        </button>
        {inBag > 0 && <div className={styles.bag}><Link to="/cart">View bag</Link><span>{inBag} in bag</span></div>}
      </div>
    </article>
  );
}
export function ProductGrid({
  products,
  creators = [],
}: {
  products: Product[];
  creators?: Creator[];
}) {
  const byId = new Map(creators.map((creator) => [creator.id, creator]));
  return (
    <div className="productGrid">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} creator={byId.get(p.creatorId)} />
      ))}
    </div>
  );
}
