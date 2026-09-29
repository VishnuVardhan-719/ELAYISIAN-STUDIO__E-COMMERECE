import { Suspense, useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Search,
  UserRound,
  Heart,
  ShoppingBag,
  Menu,
  ArrowRight,
  Instagram,
  LogOut,
} from "lucide-react";
import { HOME_BY_ROLE, useAuth } from "../context/AuthContext";
import { useStudio } from "../context/StudioContext";
import { Modal, Arrow, LoadingState } from "./ui";
import Entrance from "./Entrance";
export default function Layout() {
  const [menu, setMenu] = useState(false),
    [search, setSearch] = useState(false),
    [query, setQuery] = useState("");
  const { cart, wishlist } = useStudio();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const workspaceLink: [string, string] = user
    ? [HOME_BY_ROLE[user.role], "Your workspace"]
    : ["/login", "Sign in"];
  useEffect(() => {
    setMenu(false);
    setSearch(false);
  }, [location.pathname]);
  return (
    <>
      <Entrance key={location.pathname} />
      <div id="studio-content" style={{ display: "contents" }}>
      <a className="skipLink" href="#main">
        Skip to content
      </a>
      <div className="announcement">
        Considered objects. Independent makers. A little more meaning.
      </div>
      <header className="siteHeader">
        <div className="headerInner">
          <button
            className="iconButton mobileOnly"
            aria-label="Open navigation"
            onClick={() => setMenu(true)}
          >
            <Menu size={23} />
          </button>
          <Link className="wordmark" to="/" aria-label="Elysian Studio home">
            ELYSIAN<span>STUDIO</span>
          </Link>
          <nav className="desktopNav" aria-label="Main navigation">
            {[
              ["/shop", "Shop"],
              ["/collections", "Collections"],
              ["/creators", "Creators"],
              ["/about", "Our story"],
            ].map(([to, label]) => (
              <NavLink key={to} to={to}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="headerActions">
            <button
              className="iconButton"
              aria-label="Search the shop"
              onClick={() => setSearch(true)}
            >
              <Search size={20} />
            </button>
            {user ? (
              <>
                <Link
                  className="iconButton accountIcon"
                  to={HOME_BY_ROLE[user.role]}
                  aria-label={`Your workspace, signed in as ${user.name}`}
                >
                  <UserRound size={20} />
                </Link>
                <button
                  className="iconButton"
                  aria-label="Sign out"
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                >
                  <LogOut size={19} />
                </button>
              </>
            ) : (
              <Link className="textLink" to="/login">
                Sign in
              </Link>
            )}
            <Link
              className="iconButton wishlistIcon"
              to="/account/wishlist"
              aria-label={`Wishlist, ${wishlist.length} saved items`}
            >
              <Heart size={20} />
              {wishlist.length > 0 && (
                <span className="count">{wishlist.length}</span>
              )}
            </Link>
            <Link
              className="iconButton"
              to="/cart"
              aria-label={`Shopping bag, ${cart.reduce((s, i) => s + i.quantity, 0)} items`}
            >
              <ShoppingBag size={20} />
              <span className="bagCount">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            </Link>
          </div>
        </div>
      </header>
      <main id="main">
        <Suspense fallback={<LoadingState />}>
          <RouteScroll />
          <Outlet />
        </Suspense>
      </main>
      <footer className="siteFooter">
        <div className="footerTop">
          <div className="footerBrand">
            <Link className="wordmark" to="/">
              ELYSIAN<span>STUDIO</span>
            </Link>
            <p>
              Made by people.
              <br />
              Found with feeling.
            </p>
            <a
              href="https://www.instagram.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="Visit Instagram (opens in a new tab)"
            >
              <Instagram size={19} />
            </a>
          </div>
          <div>
            <h3>Explore</h3>
            <Link to="/shop">Shop all</Link>
            <Link to="/collections">Collections</Link>
            <Link to="/creators">Our creators</Link>
            <Link to="/about">Our story</Link>
          </div>
          <div>
            <h3>For the makers</h3>
            <Link to="/become-a-creator">Become a creator</Link>
            <Link to="/become-a-creator#how-it-works">
              How collaboration works
            </Link>
            <Link to="/creator-dashboard">
              Creator studio <span className="tinyDemo">Demo</span>
            </Link>
          </div>
          <div>
            <h3>A little help</h3>
            <Link to="/contact">Contact us</Link>
            <Link to="/shipping">Shipping & returns</Link>
            <Link to="/account/orders">Your orders</Link>
            <Link to="/admin">
              Studio management <span className="tinyDemo">Demo</span>
            </Link>
          </div>
        </div>
        <div className="footerBottom">
          <span>
            © {new Date().getFullYear()} Elysian Studio. A considered way to
            collect.
          </span>
          <div>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <span>India · INR ₹</span>
          </div>
        </div>
      </footer>
      <Modal
        open={menu}
        onClose={() => setMenu(false)}
        title="Explore Elysian"
        drawer
      >
        <nav className="mobileNav" aria-label="Mobile navigation">
          {[
            ["/", "Home"],
            ["/shop", "Shop"],
            ["/collections", "Collections"],
            ["/creators", "Creators"],
            ["/about", "Our story"],
            workspaceLink,
            ["/account/wishlist", "Wishlist"],
            ["/become-a-creator", "Become a creator"],
          ].map(([to, label]) => (
            <Link key={to} to={to} onClick={() => setMenu(false)}>
              {label}
              <Arrow />
            </Link>
          ))}
        </nav>
      </Modal>
      <Modal
        open={search}
        onClose={() => setSearch(false)}
        title="Find something meaningful"
      >
        <form
          className="searchForm"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(false);
            navigate(`/shop?q=${encodeURIComponent(query)}`);
          }}
        >
          <label htmlFor="global-search">
            Products, materials, little things you love
          </label>
          <div>
            <input
              id="global-search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try ceramics, cotton or a vase…"
            />
            <button className="iconButton" aria-label="Submit search">
              <ArrowRight />
            </button>
          </div>
        </form>
        <p className="muted">
          A good place to start: ceramics, textiles, or original art.
        </p>
      </Modal>
      </div>
    </>
  );
}

function RouteScroll() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const section = hash && document.getElementById(hash.slice(1));
      if (section) section.scrollIntoView();
      else window.scrollTo(0, 0);
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash]);
  return null;
}
