import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
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
  const { wishlist, toggleWishlist } = useStudio();
  const saved = wishlist.includes(product.id);
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
