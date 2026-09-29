import { useCallback, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { Plus } from "lucide-react";
import {
  categoryService,
  creatorService,
  orderService,
  productService,
} from "../services/api";
import { assets } from "../data/assets";
import { useResource } from "../hooks/useResource";
import { useStudio } from "../context/StudioContext";
import { useAuth } from "../context/AuthContext";
import { DashboardShell } from "../components/DashboardShell";
import { OrdersTable } from "../components/OrdersTable";
import {
  Arrow,
  Badge,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeading,
} from "../components/ui";
import { formatDate, formatPrice } from "../utils/commerce";
import type { Category, Product } from "../types/domain";
const links: [string, string][] = [
  ["", "Overview"],
  ["/products", "My products"],
  ["/add-product", "Add product"],
  ["/orders", "Orders"],
  ["/collaboration", "Collaboration"],
  ["/profile", "Profile"],
];
export default function CreatorDashboard() {
  const path = useLocation().pathname;
  const [params] = useSearchParams();
  const { user } = useAuth();
  const load = useCallback(async () => {
    const [categories, creators] = await Promise.all([
      categoryService.list(),
      creatorService.list(),
    ]);
    const creatorId = user?.creatorId ?? creators[0]?.id ?? "";
    const [products, orders, collaboration] = await Promise.all([
      creatorId ? productService.listForCreator(creatorId) : [],
      creatorId ? orderService.listForCreator(creatorId) : [],
      user ? creatorService.getCollaborationFor(user.email) : null,
    ]);
    return {
      categories,
      creatorId,
      creator: creators.find((entry) => entry.id === creatorId) ?? null,
      products,
      orders,
      collaboration,
    };
  }, [user]);
  const { data, loading, error, retry } = useResource(load);
  const { notify } = useStudio();
  return (
    <DashboardShell
      title="Creator studio"
      name={data?.creator?.studio || "Creator studio"}
      base="/creator-dashboard"
      links={links}
    >
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} retry={retry} />
      ) : data ? (
        <>
          {path === "/creator-dashboard" && (
            <>
              <PageHeading
                title={`Hello, ${data.creator?.name.split(" ")[0] || "there"}.`}
                description="A little space to grow your craft and keep an eye on your studio."
              />
              <div className="statGrid">
                <div>
                  <span>Pieces in your studio</span>
                  <strong>{data.products.length}</strong>
                  <small>
                    {data.products.filter((p) => p.status === "active").length}{" "}
                    active products
                  </small>
                </div>
                <div>
                  <span>Orders</span>
                  <strong>{data.orders.length}</strong>
                  <small>For your pieces only</small>
                </div>
                <div>
                  <span>Sales</span>
                  <strong>
                    {formatPrice(data.orders.reduce((s, o) => s + o.total, 0))}
                  </strong>
                  <small>Illustrative, not real revenue</small>
                </div>
              </div>
              <div className="sectionHead">
                <h2>From your studio</h2>
                <Link className="textLink" to="/creator-dashboard/add-product">
                  Add a piece
                  <Plus size={15} />
                </Link>
              </div>
              <CreatorProducts
                products={data.products.slice(0, 4)}
                categories={data.categories}
              />
              <h2 className="dashboardSubhead">Recent orders</h2>
              <OrdersTable orders={data.orders} />
            </>
          )}
          {path === "/creator-dashboard/products" && (
            <>
              <div className="sectionHead">
                <PageHeading
                  title="Your work, all together."
                  description="Manage the pieces in your studio."
                />
                <Link className="button" to="/creator-dashboard/add-product">
                  <Plus size={16} />
                  Add product
                </Link>
              </div>
              <CreatorProducts
                products={data.products}
                categories={data.categories}
              />
            </>
          )}
          {path === "/creator-dashboard/add-product" && (
            <ProductForm
              key={params.get("edit") || "new"}
              initial={data.products.find((p) => p.id === params.get("edit"))}
              categories={data.categories}
              creatorId={data.creatorId}
              onSaved={retry}
            />
          )}{" "}
          {path === "/creator-dashboard/orders" && (
            <>
              <PageHeading
                title="From your studio to their home."
                description="Orders containing your products. Totals reflect your items only."
              />
              <OrdersTable orders={data.orders} />
            </>
          )}
          {path === "/creator-dashboard/collaboration" && (
            <>
              <PageHeading
                title="Your collaboration with Elysian."
                description="The live status of your studio application."
              />
              {data.collaboration ? (
                <div className="successPanel">
                  <Badge>{data.collaboration.status}</Badge>
                  <h2>
                    {data.collaboration.status === "approved"
                      ? "A place for your craft."
                      : data.collaboration.status === "declined"
                        ? "Not this time."
                        : "Still with our studio team."}
                  </h2>
                  <p>
                    {data.collaboration.status === "approved"
                      ? "Your collaboration is approved. You can publish pieces to the shop."
                      : data.collaboration.status === "declined"
                        ? "Your application was not taken forward on this occasion. You are welcome to apply again with new work."
                        : "Your application is in the review queue. An admin decision will update this page."}
                  </p>
                  <ol className="statusTimeline">
                    <li>
                      Application received{" "}
                      <span>{formatDate(data.collaboration.date)}</span>
                    </li>
                    <li>
                      Work reviewed{" "}
                      <span>
                        {data.collaboration.status === "pending"
                          ? "Awaiting review"
                          : "Complete"}
                      </span>
                    </li>
                    <li>
                      Welcome to Elysian{" "}
                      <span>
                        {data.collaboration.status === "approved"
                          ? "Granted"
                          : data.collaboration.status === "declined"
                            ? "Not this time"
                            : "Pending decision"}
                      </span>
                    </li>
                  </ol>
                  {data.collaboration.status === "approved" && (
                    <Link
                      className="button"
                      to="/creator-dashboard/add-product"
                    >
                      Add your next piece
                      <Arrow />
                    </Link>
                  )}
                </div>
              ) : (
                <EmptyState
                  title="No application on file."
                  description="Apply to join the studio and follow the decision here."
                  href="/become-a-creator"
                  label="Apply to join"
                />
              )}
            </>
          )}
          {path === "/creator-dashboard/profile" && (
            <>
              <PageHeading
                title="The person behind the pieces."
                description="Your public studio details."
              />
              <form
                className="settingsForm"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  try {
                    await creatorService.updateProfile(data.creatorId, {
                      name: String(form.get("name") || ""),
                      studio: String(form.get("studio") || ""),
                      location: String(form.get("location") || ""),
                      bio: String(form.get("bio") || ""),
                    });
                    retry();
                    notify("Your studio profile was updated.");
                  } catch {
                    notify("Your profile could not be updated. Try again.");
                  }
                }}
              >
                <Field
                  label="Name"
                  name="name"
                  defaultValue={data.creator?.name}
                  required
                />
                <Field
                  label="Studio name"
                  name="studio"
                  defaultValue={data.creator?.studio}
                  required
                />
                <Field
                  label="Location"
                  name="location"
                  defaultValue={data.creator?.location}
                  required
                />
                <Field label="Studio story">
                  <textarea
                    id="studio-story"
                    name="bio"
                    defaultValue={data.creator?.bio}
                    rows={6}
                    required
                  />
                </Field>
                <button className="button">Save profile</button>
                {data.creatorId && (
                  <Link className="textLink" to={`/creators/${data.creatorId}`}>
                    View public profile
                    <Arrow />
                  </Link>
                )}
              </form>
            </>
          )}
          {!links.some(([suffix]) => path === `/creator-dashboard${suffix}`) && (
            <EmptyState
              title="Studio page not found."
              description="Return to your studio overview."
              href="/creator-dashboard"
              label="Studio overview"
            />
          )}
        </>
      ) : null}
    </DashboardShell>
  );
}
function CreatorProducts({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  return products.length ? (
    <div className="tableScroll">
      <table>
        <caption className="srOnly">Your products</caption>
        <thead>
          <tr>
            <th>Piece</th>
            <th>Price</th>
            <th>Stock</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>
                <div className="tableProduct">
                  <img src={p.images[0]} alt="" />
                  <div>
                    {p.name}
                    <small>
                      {categories.find((c) => c.id === p.categoryId)?.name}
                    </small>
                  </div>
                </div>
              </td>
              <td>{formatPrice(p.price)}</td>
              <td>{p.stock}</td>
              <td>
                <Badge>{p.status}</Badge>
              </td>
              <td>
                <Link
                  className="textLink"
                  to={`/creator-dashboard/add-product?edit=${p.id}`}
                >
                  Edit<span className="srOnly"> {p.name}</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyState
      title="Your first piece belongs here."
      description="Add a product to start building your studio."
      href="/creator-dashboard/add-product"
      label="Add product"
    />
  );
}
function ProductForm({
  initial,
  categories,
  creatorId,
  onSaved,
}: {
  initial?: Product;
  categories: Category[];
  creatorId: string;
  onSaved: () => void;
}) {
  const navigate = useNavigate();
  const { notify } = useStudio();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [preview, setPreview] = useState(initial?.images[0] || assets.vase);
  return (
    <>
      <PageHeading
        title={
          initial ? "A few finishing touches." : "Make room for a new piece."
        }
        description="Products are saved to your studio in this browser, and appear in the shop once active."
      />
      <form
        className="settingsForm"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const product: Product = {
            id: initial?.id || `piece-${crypto.randomUUID()}`,
            name: String(f.get("name")).trim(),
            description: String(f.get("description")).trim(),
            categoryId: String(f.get("categoryId")),
            price: Number(f.get("price")),
            stock: Number(f.get("stock")),
            images: [preview],
            creatorId,
            material: String(f.get("material")),
            dimensions: String(f.get("dimensions")),
            status: f.get("status") === "active" ? "active" : "draft",
          };
          setBusy(true);
          setError("");
          try {
            await productService.saveDemo(product);
            onSaved();
            notify("Your piece was saved to the studio.");
            navigate("/creator-dashboard/products");
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Could not save this piece.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field
          label="Product name"
          name="name"
          required
          minLength={3}
          defaultValue={initial?.name}
        />
        <Field label="Description">
          <textarea
            id="description"
            name="description"
            defaultValue={initial?.description}
            required
            minLength={20}
            rows={4}
          />
        </Field>
        <div className="formGrid">
          <Field label="Category">
            <select
              id="category"
              name="categoryId"
              defaultValue={initial?.categoryId || "ceramics"}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              id="status"
              name="status"
              defaultValue={initial?.status || "draft"}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
            </select>
          </Field>
          <Field
            label="Price (INR)"
            name="price"
            type="number"
            min="1"
            step="1"
            defaultValue={initial?.price}
            required
          />
          <Field
            label="Stock"
            name="stock"
            type="number"
            min="0"
            step="1"
            defaultValue={initial?.stock ?? 1}
            required
          />
          <Field
            label="Materials"
            name="material"
            defaultValue={initial?.material}
            required
          />
          <Field
            label="Dimensions"
            name="dimensions"
            defaultValue={initial?.dimensions}
            required
          />
        </div>
        <Field label="Product image">
          <select
            id="demo-product-image"
            value={preview}
            onChange={(e) => setPreview(e.target.value)}
          >
            {[
              ...new Set(
                [
                  initial?.images[0],
                  assets.vase,
                  assets.ceramics,
                  assets.bowls,
                  assets.textile,
                  assets.art,
                  assets.jewellery,
                  assets.basket,
                ].filter((x): x is string => !!x),
              ),
            ].map((image) => (
              <option value={image} key={image}>
                {image.split("/").at(-1)?.replace(".webp", "")}
              </option>
            ))}
          </select>
        </Field>
        <img
          className="formImagePreview"
          src={preview}
          alt="Selected product preview"
        />
        <p className="muted">
          Select a bundled image. A media upload service can be connected here.
        </p>
        {error && (
          <p className="fieldError" role="alert">
            {error}
          </p>
        )}
        <button className="button" disabled={busy}>
          {busy ? "Saving…" : "Save product"}
          <Arrow />
        </button>
      </form>
    </>
  );
}
