import { useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { Heart, MapPin } from "lucide-react";
import {
  collectionService,
  creatorService,
  productService,
} from "../services/api";
import { useResource } from "../hooks/useResource";
import { useStudio } from "../context/StudioContext";
import { ProductGrid } from "../components/ProductCard";
import { CreatorCard } from "../components/CreatorCard";
import {
  Arrow,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeading,
} from "../components/ui";
export function Collections() {
  const { collectionSlug } = useParams();
  const load = useCallback(
    async () => ({
      collections: await collectionService.list(),
      products: (await productService.list({ pageSize: 100 })).items,
    }),
    [],
  );
  const { data, loading, error, retry } = useResource(load);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} retry={retry} />;
  const selected = data?.collections.find((c) => c.slug === collectionSlug);
  if (collectionSlug && !selected)
    return (
      <EmptyState
        title="Collection not found."
        description="Explore another corner of the studio."
        href="/collections"
        label="Browse collections"
      />
    );
  return (
    <div className="container page">
      {selected ? (
        <>
          <div className="collectionBanner">
            <img src={selected.image} alt={selected.name} />
            <div>
              <p className="eyebrow">The Elysian collections</p>
              <h1>{selected.name}</h1>
              <p>{selected.description}</p>
            </div>
          </div>
          <ProductGrid
            products={
              data?.products.filter((p) =>
                selected.productIds.includes(p.id),
              ) || []
            }
          />
        </>
      ) : (
        <>
          <PageHeading
            eyebrow="A considered point of view"
            title="Collected with feeling."
            description="Pieces that belong together. Stories that bring a room to life."
          />
          <div className="collectionGrid">
            {data?.collections.map((c, i) => (
              <Link
                className="collectionTile"
                key={c.slug}
                to={`/collections/${c.slug}`}
              >
                <img
                  src={c.image}
                  alt={c.name}
                  loading={i ? "lazy" : "eager"}
                />
                <div>
                  <h2>{c.name}</h2>
                  <p>{c.description}</p>
                  <span className="textLink">
                    Explore collection
                    <Arrow />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
export function Creators() {
  const load = useCallback(() => creatorService.list(), []);
  const { data, loading, error, retry } = useResource(load);
  return (
    <div className="container page">
      <PageHeading
        eyebrow="Independent hands. Individual stories."
        title="Good things begin with people."
        description="Meet the artists, makers, and small studios putting a little of themselves into everything they create."
      />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} retry={retry} />
      ) : (
        <div className="creatorGrid">
          {data?.map((c) => (
            <CreatorCard key={c.id} creator={c} />
          ))}
        </div>
      )}
      <div className="inviteBand">
        <h2>There’s room for your story, too.</h2>
        <Link className="button" to="/become-a-creator">
          Join the makers
          <Arrow />
        </Link>
      </div>
    </div>
  );
}
export function CreatorProfile() {
  const { creatorId = "" } = useParams();
  const load = useCallback(
    async () => ({
      creator: await creatorService.getById(creatorId),
      products: (await productService.list({ pageSize: 100 })).items.filter(
        (p) => p.creatorId === creatorId,
      ),
      collections: await collectionService.list(),
    }),
    [creatorId],
  );
  const { data, loading, error, retry } = useResource(load);
  const { favorites, toggleCreator } = useStudio();
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} retry={retry} />;
  if (!data?.creator)
    return (
      <EmptyState
        title="Maker not found."
        description="Meet the independent studios in our community."
        href="/creators"
        label="Meet the makers"
      />
    );
  const c = data.creator;
  return (
    <div className="container page">
      <div className="breadcrumb">
        <Link to="/creators">Creators</Link>
        <span>/</span>
        {c.name}
      </div>
      <section className="creatorProfile">
        <img src={c.image} alt={c.name} />
        <div>
          <p className="eyebrow">{c.specialty}</p>
          <h1>{c.studio}</h1>
          <p className="creatorLocation">
            <MapPin size={15} />
            {c.location}
          </p>
          <p className="lede">{c.bio}</p>
          <div className="profileMeta">
            <span>By {c.name}</span>
            <span>Making since {c.since}</span>
            <span>{data.products.length} pieces</span>
          </div>
          <button
            className="button secondary"
            aria-pressed={favorites.includes(c.id)}
            onClick={() => toggleCreator(c.id)}
          >
            <Heart
              size={16}
              fill={favorites.includes(c.id) ? "currentColor" : "none"}
            />
            {favorites.includes(c.id)
              ? "Following this maker"
              : "Follow this maker"}
          </button>
          <small className="muted block">
            Following is available for this demo session.
          </small>
        </div>
      </section>
      <section className="section">
        <div className="sectionHead">
          <h2>From {c.name.split(" ")[0]}’s hands.</h2>
          <span className="muted">
            {data.products.length} thoughtfully made pieces
          </span>
        </div>
        {data.products.length ? (
          <ProductGrid products={data.products} />
        ) : (
          <EmptyState
            title="Something is taking shape."
            description="This maker’s next collection is on its way."
          />
        )}
      </section>
      <section className="makerStory">
        <img src={c.cover} alt={`A glimpse into ${c.studio}`} loading="lazy" />
        <div>
          <p className="eyebrow">A shared love of making</p>
          <h2>A place in the studio.</h2>
          <p>
            {c.name} joins Elysian as an independent collaborator. Their work is
            part of our shared belief that everyday objects can carry
            extraordinary stories.
          </p>
          <h3>Featured in</h3>
          {data.collections
            .filter((col) =>
              col.productIds.some((id) =>
                data.products.some((p) => p.id === id),
              ),
            )
            .map((col) => (
              <Link
                key={col.slug}
                className="textLink"
                to={`/collections/${col.slug}`}
              >
                {col.name}
                <Arrow />
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}
