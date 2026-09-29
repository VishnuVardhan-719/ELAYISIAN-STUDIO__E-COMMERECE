import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import {
  Flower2,
  Fingerprint,
  PackageCheck,
  Sprout,
  ArrowRight,
} from "lucide-react";
import { categoryService, creatorService, productService } from "../services/api";
import { useResource } from "../hooks/useResource";
import { assets } from "../data/assets";
import { ProductGrid } from "../components/ProductCard";
import { CreatorCard } from "../components/CreatorCard";
import { Arrow, ErrorState, LoadingState } from "../components/ui";
import styles from "./Home.module.css";
const CURATED: [string, string][] = [
  ["art", "Art"],
  ["ceramics", "Ceramics"],
  ["textiles", "Textiles"],
  ["jewellery", "Jewellery"],
  ["decor", "Decor"],
  ["craft", "Crafts"],
];
export default function Home() {
  const [joined, setJoined] = useState(false);
  const load = useCallback(async () => {
    const [catalog, categories, creators] = await Promise.all([
      productService.list({ pageSize: 100 }),
      categoryService.list(),
      creatorService.list(),
    ]);
    return { products: catalog.items, categories, creators };
  }, []);
  const { data, loading, error, retry } = useResource(load);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} retry={retry} />;
  const { products, categories, creators } = data ?? {
    products: [],
    categories: [],
    creators: [],
  };
  const curatedCategories = CURATED.flatMap(([id, label]) => {
    const category = categories.find((entry) => entry.id === id);
    return category ? [{ ...category, label }] : [];
  });
  const featured = products.filter(
    (product) => product.featured && product.status === "active",
  );
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.intro}>
            <span />Independent craft, thoughtfully gathered
          </div>
          <h1>
            Made by people.
            <br />
            Found with feeling.
          </h1>
          <p>
            Art, textiles, objects and gifts with a story—chosen from
            independent makers across India.
          </p>
          <div className={styles.heroActions}>
            <Link className="button" to="/shop">Shop the collection<Arrow size={18} /></Link>
            <Link className="button secondary" to="/creators">Meet the makers<Arrow size={18} /></Link>
          </div>
          <div className={styles.heroFoot}>
            <span className={styles.handMark}>
              <Fingerprint size={27} strokeWidth={1} />
            </span>
            <span>
              Made in small studios.
              <br />Chosen one by one.
            </span>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <img
            src={assets.hero}
            alt="A maker's table with an original painting, flowers, wrapped gifts, block-printed textile and handmade jewellery"
            fetchPriority="high"
            width="1536"
            height="1024"
          />
          <div className={styles.imageCaption}>
            <span>Art, textiles and gifts—made in small studios.</span>
          </div>
          <Link
            className={styles.heroTag}
            to="/collections/objects-for-slow-living"
          >
            <small>The handmade edit</small>
            <span>Gifts with a story.</span>
            <Arrow size={20} />
          </Link>
        </div>
      </section>
      <section className={`section container ${styles.curated}`} aria-label="Curated collections">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">Curated collections</p>
            <h2>Follow what catches your eye.</h2>
          </div>
          <Link className="textLink" to="/collections">
            Explore collections
            <Arrow />
          </Link>
        </div>
        <div className={styles.categories}>
          {curatedCategories.map((c) => (
            <Link
              key={c.id}
              to={`/shop?category=${c.id}`}
              className={styles.category}
            >
              <div>
                <img
                  src={c.image}
                  alt={c.description}
                  loading="lazy"
                  width="400"
                  height="450"
                />
              </div>
              <span>
                {c.label}
                <Arrow size={16} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className={`section container ${styles.featured}`} aria-label="Featured products">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">The studio edit</p>
            <h2>Pieces worth living with.</h2>
          </div>
          <Link className="textLink" to="/shop">
            View all pieces
            <Arrow />
          </Link>
        </div>
        <ProductGrid products={featured} creators={creators} />
        <p className={styles.sectionNote}>
          A few favourites from our makers. Each one a little different. Each
          one made with care.
        </p>
      </section>
      <section className={styles.creatorSection}>
        <div className="container section">
          <div className="sectionHead">
            <div>
              <p className="eyebrow">The people behind the pieces</p>
              <h2>Meet the makers.</h2>
            </div>
            <div className={styles.sectionAside}>
              <p>
                Real people. Remarkable craft.
                <br />
                Get to know the hands behind what you love.
              </p>
              <Link className="textLink" to="/creators">
                All creators
                <Arrow />
              </Link>
            </div>
          </div>
          <div className="creatorGrid">
            {creators.map((c) => (
              <CreatorCard key={c.id} creator={c} />
            ))}
          </div>
        </div>
      </section>
      <section className={`container section ${styles.collaboration}`}>
        <div className={styles.collabImage}>
          <img
            src={assets.collaboration}
            alt="An independent printmaker holding a freshly hand-printed botanical paper in her studio"
            loading="lazy"
            width="1024"
            height="1536"
          />
          <div className={styles.studioNote}>
            Your point of view.
            <br />A wider audience.
          </div>
        </div>
        <div className={styles.collabCopy}>
          <p className="eyebrow">Made by you. Discovered here.</p>
          <h2>
            Your craft deserves
            <br />
            to be found.
          </h2>
          <p>
            You put a little of yourself into everything you make. We help it
            find a home with people who see its value.
          </p>
          <p>
            Join a thoughtful community of independent artists and makers. Tell
            us your story. We’ll take it from there.
          </p>
          <ol className={styles.steps} aria-label="Collaboration journey">
            <li><span>01</span>Share your craft</li>
            <li><span>02</span>Studio review</li>
            <li><span>03</span>Get approved</li>
            <li><span>04</span>Showcase your work</li>
          </ol>
          <Link className="button" to="/become-a-creator">
            Become a creator
            <Arrow />
          </Link>
          <Link className="textLink" to="/become-a-creator#how-it-works">
            How collaboration works
          </Link>
        </div>
      </section>
      <section className={styles.benefits} aria-label="Why Elysian">
        <div className="container">
          {[
            {
              icon: Flower2,
              title: "Curated",
              text: "Every piece chosen for its character, quality and care.",
            },
            {
              icon: Fingerprint,
              title: "Independent",
              text: "Meet the real people and small studios behind your finds.",
            },
            {
              icon: Sprout,
              title: "Made with intention",
              text: "Thoughtful materials. Patient processes. Lasting meaning.",
            },
            {
              icon: PackageCheck,
              title: "Carefully shipped",
              text: "Thoughtfully packed for the journey from a maker’s studio to your home.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title}>
              <Icon size={28} strokeWidth={1} />
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className={`section container ${styles.story}`}>
        <div>
          <p className="eyebrow">The work behind the object</p>
          <h2>
            Some things are
            <br />
            better made slowly.
          </h2>
          <p>
            The patient stitch. The softly irregular brushstroke. The knot tied
            by hand. These aren’t flaws. They are the quiet evidence that a
            person was here, making something with care.
          </p>
          <Link className="textLink" to="/about">
            The story of Elysian
            <Arrow />
          </Link>
        </div>
        <img
          src={assets.story}
          alt="An Indian textile artist slowly embroidering a botanical motif by hand"
          loading="lazy"
          width="1536"
          height="1024"
        />
      </section>
      <section className={styles.newsletter} aria-label="Newsletter">
        <div className={styles.newsletterInner}>
          <div>
            <p>Letters from the studio</p>
            <h2>Bring more meaning home.</h2>
          </div>
          <div className={styles.newsletterAction}>
            <p>
              Meet a new maker. See what they’re working on. Find one object
              you’ll want to live with.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setJoined(true);
              }}
            >
              <label className="srOnly" htmlFor="newsletter-email">
                Your email address
              </label>
              <input
                id="newsletter-email"
                type="email"
                placeholder="Your email address"
                required
                disabled={joined}
              />
              <button disabled={joined}>
                {joined ? "Interest noted" : "Join the list"}
                {!joined && <ArrowRight size={18} />}
              </button>
            </form>
            <small role="status">
              {joined
                ? "This is a demo. Your email was not sent or stored."
                : "One considered letter each month. Unsubscribe whenever you like."}
            </small>
          </div>
        </div>
      </section>
    </>
  );
}
