import { useCallback, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Check, Trash2, ShoppingBag } from "lucide-react";
import { useStudio } from "../context/StudioContext";
import { useAuth } from "../context/AuthContext";
import { accountService, orderService, productService } from "../services/api";
import { useResource } from "../hooks/useResource";
import { cartTotal, formatDate, formatPrice } from "../utils/commerce";
import {
  Arrow,
  Badge,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeading,
  Quantity,
} from "../components/ui";
import type { Order } from "../types/domain";
export default function Cart({ checkout = false }: { checkout?: boolean }) {
  const { cart, updateCart, removeFromCart, clearCart, busy, notify } =
    useStudio();
  const { user } = useAuth();
  const loader = useCallback(
    async () => ({
      catalog: (await productService.list({ pageSize: 100 })).items,
      addresses: user ? await accountService.listAddresses(user.id) : [],
    }),
    [user],
  );
  const { data, loading, error, retry } = useResource(loader);
  const [placed, setPlaced] = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [useNew, setUseNew] = useState(false);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} retry={retry} />;
  const products = data?.catalog || [];
  const addresses = data?.addresses || [];
  const activeAddress = useNew ? undefined : addresses[0];
  const total = cartTotal(cart, products),
    shipping = total >= 3000 ? 0 : 150;
  const placeOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || submitting) return;
    const form = new FormData(event.currentTarget);
    const address = {
      name: activeAddress?.name || String(form.get("name") || ""),
      line: activeAddress?.line || String(form.get("address") || ""),
      city: activeAddress?.city || String(form.get("city") || ""),
      state: activeAddress?.state || String(form.get("state") || ""),
      postalCode:
        activeAddress?.postalCode || String(form.get("postalCode") || ""),
      phone: activeAddress?.phone || String(form.get("phone") || ""),
    };
    setSubmitting(true);
    try {
      const order = await orderService.create({
        userId: user.id,
        items: cart,
        address,
      });
      await clearCart();
      setPlaced(order);
      notify(`Order ${order.id} placed.`);
    } catch (failure) {
      notify(
        failure instanceof Error
          ? failure.message
          : "Your order could not be placed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="container page">
      <PageHeading
        eyebrow="Chosen with feeling"
        title={checkout ? "A little closer to home." : "Your thoughtful finds."}
        description={
          checkout
            ? "Review your details and the pieces you’ve chosen."
            : "Good things come to those who collect thoughtfully."
        }
      />
      {placed ? (
        <div className="successPanel" role="status">
          <Check size={34} />
          <h2>Thank you — your order is in.</h2>
          <p>
            Order <strong>{placed.id}</strong> was placed on{" "}
            {formatDate(placed.date)} and is now <Badge>{placed.status}</Badge>.
          </p>
          <ul className="orderLines">
            {placed.items.map((item) => (
              <li key={item.productId}>
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>{formatPrice(item.quantity * item.unitPrice)}</span>
              </li>
            ))}
          </ul>
          <div className="summaryLine total">
            <span>Total paid</span>
            <span>{formatPrice(placed.total)}</span>
          </div>
          <Link className="button" to="/account/orders">
            View your orders
            <Arrow />
          </Link>
          <Link className="textLink" to="/shop">
            Continue exploring
            <Arrow />
          </Link>
        </div>
      ) : !cart.length ? (
        <EmptyState
          title="Your bag is waiting for a story."
          description="Discover a piece that feels like you, and make a little room for it here."
          href="/shop"
        />
      ) : (
        <div className="cartLayout">
          <div>
            {checkout ? (
              !user ? (
                <div className="demoNotice">
                  <span>
                    Please sign in to place an order. Your bag is saved.
                  </span>
                  <Link className="textLink" to="/login" state={{ from: "/checkout" }}>
                    Sign in
                    <Arrow />
                  </Link>
                </div>
              ) : (
                <>
                  <div className="demoNotice">
                    Demonstration checkout · no payment is taken and no card is
                    stored. A real order is created in this browser.
                  </div>
                  <form className="checkoutForm" onSubmit={placeOrder}>
                    <h2>Where should your finds go?</h2>
                    {addresses.length > 0 && (
                      <div className="field">
                        <span className="fieldLabel">Saved addresses</span>
                        <div className="addressChoices">
                          {addresses.map((address) => (
                            <button
                              key={address.id}
                              type="button"
                              className={`addressChoice ${activeAddress?.id === address.id ? "addressChoiceActive" : ""}`}
                              onClick={() => setUseNew(false)}
                            >
                              <strong>{address.name}</strong>
                              <span>
                                {address.line}, {address.city}, {address.state}{" "}
                                {address.postalCode}
                              </span>
                              <span>{address.phone}</span>
                            </button>
                          ))}
                          <button
                            type="button"
                            className={`addressChoice ${useNew ? "addressChoiceActive" : ""}`}
                            onClick={() => setUseNew(true)}
                          >
                            <strong>Use a new address</strong>
                            <span>Enter a different delivery address</span>
                          </button>
                        </div>
                      </div>
                    )}
                    {!activeAddress && (
                      <>
                        <div className="formGrid">
                          <Field
                            label="Full name"
                            name="name"
                            autoComplete="name"
                            required
                            minLength={2}
                          />
                          <Field
                            label="Email address"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                          />
                        </div>
                        <Field
                          label="Address"
                          name="address"
                          autoComplete="street-address"
                          required
                          minLength={5}
                        />
                        <div className="formGrid">
                          <Field
                            label="City"
                            name="city"
                            autoComplete="address-level2"
                            required
                          />
                          <Field
                            label="State"
                            name="state"
                            autoComplete="address-level1"
                            required
                          />
                          <Field
                            label="PIN code"
                            name="postalCode"
                            autoComplete="postal-code"
                            inputMode="numeric"
                            pattern="[1-9][0-9]{5}"
                            title="Enter a valid six-digit Indian PIN code"
                            required
                          />
                          <Field
                            label="Phone number"
                            name="phone"
                            autoComplete="tel-national"
                            type="tel"
                            pattern="[6-9][0-9]{9}"
                            title="Enter a ten-digit Indian mobile number"
                            required
                          />
                        </div>
                      </>
                    )}
                    <div className="paymentPlaceholder">
                      <ShoppingBag size={20} />
                      <div>
                        <h3>Payment is simulated.</h3>
                        <p>
                          Placing this order records it against your account and
                          creates a payment record. No money moves.
                        </p>
                      </div>
                    </div>
                    <button className="button" disabled={submitting || busy}>
                      {submitting ? "Placing your order…" : "Place order"}
                      {!submitting && <Arrow />}
                    </button>
                  </form>
                </>
              )
            ) : (
              cart.map((item) => {
                const p = products.find((x) => x.id === item.productId);
                return p ? (
                  <article className="cartItem" key={item.productId}>
                    <Link to={`/products/${p.id}`}>
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        width="130"
                        height="160"
                      />
                    </Link>
                    <div>
                      <Link className="cartItemName" to={`/products/${p.id}`}>
                        {p.name}
                      </Link>
                      <p className="muted">{p.material}</p>
                      <p>{formatPrice(p.price)}</p>
                      <Quantity
                        value={item.quantity}
                        max={p.stock}
                        onChange={(n) => updateCart(p.id, n)}
                        disabled={busy}
                      />
                    </div>
                    <div className="cartItemEnd">
                      <strong>{formatPrice(p.price * item.quantity)}</strong>
                      <button
                        className="iconButton"
                        aria-label={`Remove ${p.name} from bag`}
                        disabled={busy}
                        onClick={() => removeFromCart(p.id)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </article>
                ) : null;
              })
            )}
          </div>
          <aside className="orderSummary">
            <h2>A considered choice.</h2>
            {checkout &&
              cart.map((i) => {
                const p = products.find((p) => p.id === i.productId);
                return (
                  <div className="summaryLine" key={i.productId}>
                    <span>
                      {p?.name} × {i.quantity}
                    </span>
                    <span>{formatPrice((p?.price || 0) * i.quantity)}</span>
                  </div>
                );
              })}
            <div className="summaryLine">
              <span>Subtotal</span>
              <span>{formatPrice(total)}</span>
            </div>
            <div className="summaryLine">
              <span>Estimated shipping</span>
              <span>{shipping ? formatPrice(shipping) : "Complimentary"}</span>
            </div>
            <div className="summaryLine total">
              <span>Total</span>
              <span>{formatPrice(total + shipping)}</span>
            </div>
            <p className="muted">
              {shipping
                ? `${formatPrice(3000 - total)} away from complimentary shipping.`
                : "Your pieces travel on us."}
            </p>
            {!checkout && (
              <Link className="button fullWidth" to="/checkout">
                Continue to checkout
                <Arrow />
              </Link>
            )}
            <Link className="textLink" to={checkout ? "/cart" : "/shop"}>
              {checkout ? "Back to your bag" : "Keep exploring"}
            </Link>
            <p className="summaryFoot">
              Thoughtfully made. Carefully packed.
              <br />
              Delivered from independent hands.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
