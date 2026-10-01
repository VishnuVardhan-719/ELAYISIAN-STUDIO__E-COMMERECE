import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Heart, Truck, Leaf, ZoomIn } from "lucide-react";
import {
  categoryService,
  creatorService,
  productService,
} from "../services/api";
import type { Category, Creator } from "../types/domain";
import { useResource } from "../hooks/useResource";
import { useStudio } from "../context/StudioContext";
import { ProductGrid } from "../components/ProductCard";
import {
  Arrow,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  Quantity,
} from "../components/ui";
import { formatPrice } from "../utils/commerce";
export default function Product() {
  const { productId = "" } = useParams();
  const load = useCallback(async () => {
    const [product, related, creators, categories] = await Promise.all([
      productService.getById(productId),
      productService.listRelated(productId),
      creatorService.list(),
      categoryService.list(),
    ]);
    return { product, related, creators, categories };
  }, [productId]);
  const { data, loading, error, retry } = useResource(load);
  return (
    <div className="container page">
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} retry={retry} />
      ) : data?.product ? (
        <ProductContent
          key={productId}
          product={data.product}
          related={data.related}
          creators={data.creators}
          categories={data.categories}
        />
      ) : (
        <EmptyState
          title="This piece has wandered off."
          description="It may no longer be part of our collection. There are other lovely things to discover."
          href="/shop"
        />
      )}
    </div>
  );
}
function ProductContent({
  product: p,
  related,
  creators,
  categories,
}: {
  product: NonNullable<Awaited<ReturnType<typeof productService.getById>>>;
  related: Awaited<ReturnType<typeof productService.listRelated>>;
  creators: Creator[];
  categories: Category[];
}) {
  const [active, setActive] = useState(0),
    [quantity, setQuantity] = useState(1),
    [zoom, setZoom] = useState(false);
  const { wishlist, toggleWishlist, addToCart, busy } = useStudio();
  const creator = creators.find((c) => c.id === p.creatorId);
  const saved = wishlist.includes(p.id);
  return (
    <>
      <div className="breadcrumb">
        <Link to="/shop">Shop</Link>
        <span>/</span>
        <Link to={`/shop?category=${p.categoryId}`}>
          {categories.find((c) => c.id === p.categoryId)?.name}
        </Link>
        <span>/</span>
        <span>{p.name}</span>
      </div>
      <div className="productDetail">
        <div className="gallery">
          <button
            className="galleryMain"
            aria-label={`Enlarge image of ${p.name}`}
            onClick={() => setZoom(true)}
          >
            <img
              src={p.images[active]}
              alt={`${p.name}, view ${active + 1}`}
              width="800"
              height="950"
            />
            <ZoomIn size={20} />
          </button>
          {p.images.length > 1 && (
            <div className="thumbnails">
              {p.images.map((image, i) => (
                <button
                  key={image}
                  aria-label={`View image ${i + 1}`}
                  aria-pressed={active === i}
                  onClick={() => setActive(i)}
                >
                  <img src={image} alt="" width="90" height="100" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="productCopy">
          <p className="eyebrow">Made by hand, one at a time</p>
          <h1>{p.name}</h1>
          <Link className="makerByline" to={`/creators/${p.creatorId}`}>
            by {creator?.studio}
            <Arrow size={14} />
          </Link>
          <p className="productPrice">
            {formatPrice(p.price)}
            <small>Inclusive of applicable taxes</small>
          </p>
          <p className="productDescription">{p.description}</p>
          <p className={`availability ${p.stock === 0 ? "unavailable" : ""}`}>
            <span />
            {p.stock > 0
              ? `${p.stock} available · Made in small batches`
              : "Currently unavailable"}
          </p>
          <div className="buyRow">
            <Quantity
              value={quantity}
              max={p.stock}
              onChange={setQuantity}
              disabled={p.stock === 0 || busy}
            />
            <button
              className="button"
              disabled={p.stock === 0 || busy}
              onClick={() => addToCart(p.id, quantity)}
            >
              {p.stock === 0 ? "Sold out" : busy ? "Adding…" : "Add to bag"}
              <Arrow />
            </button>
            <button
              className="iconButton outlined"
              aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
              aria-pressed={saved}
              onClick={() => toggleWishlist(p.id)}
            >
              <Heart size={20} fill={saved ? "currentColor" : "none"} />
            </button>
          </div>
          <div className="productPromises">
            <span>
              <Truck size={17} />
              Packed with care. Ships across India.
            </span>
            <span>
              <Leaf size={17} />A small purchase. A real connection.
            </span>
          </div>
          <details open>
            <summary>The finer details</summary>
            <dl>
              <div>
                <dt>Material</dt>
                <dd>{p.material}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{p.dimensions}</dd>
              </div>
              <div>
                <dt>Made in</dt>
                <dd>{creator?.location}</dd>
              </div>
              <div>
                <dt>Care</dt>
                <dd>
                  Handle gently. Follow the maker’s care note included with your
                  piece.
                </dd>
              </div>
            </dl>
          </details>
          <details>
            <summary>Shipping & returns</summary>
            <p>
              Demo shipping estimate: 5–8 working days across India. Shipping is
              complimentary on orders of ₹3,000 or more; otherwise ₹150. Final
              terms will be confirmed when live checkout launches.
            </p>
            <Link className="textLink" to="/shipping">
              Read shipping information
            </Link>
          </details>
          <Link className="makerMini" to={`/creators/${p.creatorId}`}>
            <img src={creator?.image} alt="" width="50" height="50" />
            <div>
              <span>Meet {creator?.name}</span>
              <small>
                {creator?.specialty} · {creator?.location}
              </small>
            </div>
            <Arrow />
          </Link>
        </div>
      </div>
      {related.length > 0 && (
        <section className="section">
          <div className="sectionHead">
            <h2>A few kindred pieces.</h2>
            <Link className="textLink" to={`/shop?category=${p.categoryId}`}>
              Explore this craft
              <Arrow />
            </Link>
          </div>
          <ProductGrid products={related} creators={creators} />
        </section>
      )}
      <Modal open={zoom} onClose={() => setZoom(false)} title={p.name}>
        <img
          className="zoomImage"
          src={p.images[active]}
          alt={`${p.name}, enlarged view`}
        />
      </Modal>
    </>
  );
}
