import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import {
  accountService,
  creatorService,
  orderService,
  productService,
  resetDemoData,
  SESSION_KEY,
} from "../services/api";
import { useResource } from "../hooks/useResource";
import { useStudio } from "../context/StudioContext";
import { useAuth } from "../context/AuthContext";
import { DashboardShell } from "../components/DashboardShell";
import { OrdersTable } from "../components/OrdersTable";
import { ProductGrid } from "../components/ProductCard";
import {
  Arrow,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Modal,
  PageHeading,
} from "../components/ui";
import type { Address } from "../types/domain";
import type { AccountPreferences } from "../types/preferences";
const restMode = import.meta.env.VITE_API_MODE === "rest";
const links: [string, string][] = [
  ["", "Overview"],
  ["/orders", "Orders"],
  ["/wishlist", "Wishlist"],
  ["/addresses", "Addresses"],
  ["/settings", "Account settings"],
];
export default function Account() {
  const path = useLocation().pathname;
  const { wishlist } = useStudio();
  const { user } = useAuth();
  const load = useCallback(async () => {
    if (!user) return null;
    const [profile, orders, wishlistProducts, creators, preferences] = await Promise.all([
      accountService.getProfile(user.id),
      orderService.listForUser(user.id),
      productService.listByIds(wishlist),
      creatorService.list(),
      accountService.getPreferences(user.id),
    ]);
    return { profile, orders, wishlistProducts, creators, preferences };
  }, [user, wishlist]);
  const { data, loading, error, retry } = useResource(load);
  return (
    <DashboardShell
      title="Your little corner"
      name={data?.profile?.name || "Your account"}
      base="/account"
      links={links}
    >
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} retry={retry} />
      ) : data ? (
        <>
          {path === "/account" && (
            <>
              <PageHeading
                title={`Welcome back, ${data.profile?.name.split(" ")[0] || "you"}.`}
                description="A home for your favourite finds and the stories you’ve collected."
              />
              <div className="statGrid">
                <Link to="/account/orders">
                  <span>Your orders</span>
                  <strong>{data.orders.length}</strong>
                  <small>
                    Your purchase history
                    <Arrow size={15} />
                  </small>
                </Link>
                <Link to="/account/wishlist">
                  <span>Saved pieces</span>
                  <strong>{wishlist.length}</strong>
                  <small>
                    A little inspiration
                    <Arrow size={15} />
                  </small>
                </Link>
              </div>
              <div className="sectionHead">
                <h2>Your recent orders</h2>
                <Link className="textLink" to="/account/orders">
                  View all
                  <Arrow />
                </Link>
              </div>
              <OrdersTable orders={data.orders.slice(0, 2)} />
            </>
          )}
          {path === "/account/orders" && (
            <>
              <PageHeading
                title="Your collected stories."
                description={restMode ? "Every order you place with your account is listed here." : "Every order you place in this browser is listed here."}
              />
              <OrdersTable orders={data.orders} />
            </>
          )}
          {path === "/account/wishlist" && (
            <>
              <PageHeading
                title="Things that feel like you."
                description="A little collection of pieces you’d love to come back to."
              />
              {data.wishlistProducts.length ? (
                <ProductGrid
                  products={data.wishlistProducts}
                  creators={data.creators}
                />
              ) : (
                <EmptyState
                  title="Keep a little inspiration here."
                  description="Tap the heart on any piece to save it for another day."
                  href="/shop"
                />
              )}
            </>
          )}
          {path === "/account/addresses" && user && <Addresses userId={user.id} />}
          {path === "/account/settings" && (
            <Settings
              key={user?.id}
              userId={user?.id || ""}
              name={data.profile?.name || ""}
              email={data.profile?.email || ""}
              preferences={data.preferences}
              onSaved={retry}
            />
          )}{" "}
          {!links.some(([suffix]) => path === `/account${suffix}`) && (
            <EmptyState
              title="Page not found."
              description="Return to your account overview."
              href="/account"
              label="Account overview"
            />
          )}
        </>
      ) : null}
    </DashboardShell>
  );
}
function Settings({
  userId,
  name,
  email,
  preferences,
  onSaved,
}: {
  userId: string;
  name: string;
  email: string;
  preferences: AccountPreferences;
  onSaved: () => void;
}) {
  const { notify } = useStudio();
  const [busy, setBusy] = useState(false);
  const [choices, setChoices] = useState(preferences);
  const lifecycle = useRef({ active: true, revision: 0 });
  useEffect(() => {
    const current = lifecycle.current;
    current.active = true;
    const sessionChanged = () => {
      ++current.revision;
      setBusy(false);
    };
    window.addEventListener("elysian-session-change", sessionChanged);
    return () => {
      current.active = false;
      ++current.revision;
      window.removeEventListener("elysian-session-change", sessionChanged);
    };
  }, []);
  const restMode = import.meta.env.VITE_API_MODE === "rest";
  return (
    <>
      <PageHeading
        title="The personal details."
        description={restMode ? "Edit your profile. Changes are saved to your account." : "Edit your profile. Changes are saved to this browser."}
      />
      <form
        className="settingsForm"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          const form = new FormData(event.currentTarget);
          const session = localStorage.getItem(SESSION_KEY);
          const revision = lifecycle.current.revision;
          const isCurrentSession = () => lifecycle.current.active && revision === lifecycle.current.revision && session === localStorage.getItem(SESSION_KEY);
          setBusy(true);
          let profileSaved = false;
          try {
            await accountService.updateProfile(userId, {
              name: String(form.get("name") || ""),
              email: String(form.get("email") || ""),
            });
            if (!isCurrentSession()) return;
            profileSaved = true;
            await accountService.savePreferences(userId, choices);
            if (!isCurrentSession()) return;
            onSaved();
            notify("Your details were saved.");
          } catch {
            if (!isCurrentSession()) return;
            notify(profileSaved
              ? "Your profile was saved, but preferences could not be saved. Try again."
              : "Your details could not be saved. Try again.");
          } finally {
            if (isCurrentSession()) setBusy(false);
          }
        }}
      >
        <Field
          label="Full name"
          defaultValue={name}
          name="name"
          required
          minLength={2}
        />
        <Field
          label="Email address"
          defaultValue={email}
          name="email"
          type="email"
          required
        />
        <h3>Stay in the loop</h3>
        <label className="checkboxLabel">
          <input
            type="checkbox"
            name="makersAndCollections"
            checked={choices.makersAndCollections}
            disabled={busy}
            onChange={(event) => setChoices({ ...choices, makersAndCollections: event.target.checked })}
          />
          New makers and collections
        </label>
        <label className="checkboxLabel">
          <input
            type="checkbox"
            name="studioStories"
            checked={choices.studioStories}
            disabled={busy}
            onChange={(event) => setChoices({ ...choices, studioStories: event.target.checked })}
          />
          Stories from the studio
        </label>
        <button className="button" disabled={busy}>
          {busy ? "Saving…" : "Save preferences"}
        </button>
      </form>
      {!restMode && <section className="infoSection">
        <h2>Demo data</h2>
        <p>
          Everything on this site is stored in this browser. Resetting restores
          the original sample catalogue, clears your bag and wishlist, and signs
          you out.
        </p>
        <button
          className="button secondary"
          onClick={() => {
            resetDemoData();
            window.location.reload();
          }}
        >
          Reset demo data
        </button>
      </section>}
    </>
  );
}
function Addresses({ userId }: { userId: string }) {
  const load = useCallback(
    () => accountService.listAddresses(userId),
    [userId],
  );
  const { data, loading, error, retry } = useResource(load);
  const { notify } = useStudio();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const save = async (form: HTMLFormElement) => {
    const f = new FormData(form);
    const address: Address = {
      id: crypto.randomUUID(),
      userId,
      name: String(f.get("name")),
      line: String(f.get("line")),
      city: String(f.get("city")),
      state: String(f.get("state")),
      postalCode: String(f.get("postalCode")),
      phone: String(f.get("phone")),
    };
    setBusy(true);
    try {
      await accountService.saveAddress(address);
      retry();
      setOpen(false);
      notify("Address saved.");
    } catch {
      notify("Address could not be added. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeading
        title="Places you call home."
        description="Saved addresses are used to pre-fill checkout."
      />
      <button className="button secondary" onClick={() => setOpen(true)}>
        <Plus size={17} />
        Add address
      </button>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} retry={retry} />
      ) : data?.length ? (
        <div className="addressGrid">
          {data.map((a) => (
            <article className="addressCard" key={a.id}>
              <h3>{a.name}</h3>
              <p>
                {a.line}
                <br />
                {a.city}, {a.state}
                <br />
                {a.postalCode}
                <br />
                {a.phone}
              </p>
              <button
                className="textButton"
                onClick={async () => {
                  await accountService.removeAddress(a.id);
                  retry();
                  notify("Address removed.");
                }}
              >
                <Trash2 size={15} />
                Remove
              </button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No saved addresses."
          description="Add an address and it will be offered at checkout."
        />
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add an address">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save(e.currentTarget);
          }}
        >
          <Field label="Full name" name="name" required />
          <Field label="Street address" name="line" required />
          <div className="formGrid">
            <Field label="City" name="city" required />
            <Field label="State" name="state" required />
            <Field
              label="PIN code"
              name="postalCode"
              pattern="[1-9][0-9]{5}"
              inputMode="numeric"
              required
            />
            <Field
              label="Phone"
              name="phone"
              type="tel"
              pattern="[6-9][0-9]{9}"
              required
            />
          </div>
          <button className="button" disabled={busy}>
            {busy ? "Saving…" : "Add address"}
          </button>
        </form>
      </Modal>
    </>
  );
}
