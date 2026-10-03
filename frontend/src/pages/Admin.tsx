import { useCallback, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { adminService } from "../services/api";
import { useResource } from "../hooks/useResource";
import { useStudio } from "../context/StudioContext";
import { DashboardShell } from "../components/DashboardShell";
import { OrdersTable } from "../components/OrdersTable";
import {
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  PageHeading,
} from "../components/ui";
import { formatDate, formatPrice } from "../utils/commerce";
import type { Collaboration } from "../types/domain";
const links: [string, string][] = [
  ["", "Overview"],
  ["/users", "Users"],
  ["/creators", "Creators"],
  ["/collaborations", "Collaboration requests"],
  ["/products", "Products"],
  ["/categories", "Categories"],
  ["/inventory", "Inventory"],
  ["/orders", "Orders"],
  ["/payments", "Payments"],
];
export default function Admin() {
  const path = useLocation().pathname;
  const [selected, setSelected] = useState<Collaboration | null>(null),
    [busy, setBusy] = useState(false);
  const { notify } = useStudio();
  const load = useCallback(
    async () => {
      const [summary, users, creators, products, categories, orders, payments, collaborations] = await Promise.all([
        adminService.getSummary(), adminService.listUsers(), adminService.listCreators(),
        adminService.listProducts(), adminService.listCategories(), adminService.listOrders(),
        adminService.listPayments(), adminService.listCollaborations(),
      ]);
      return { summary, users, creators, products, categories, orders, payments, collaborations };
    },
    [],
  );
  const { data, loading, error, retry } = useResource(load);
  const title = links.find(([suffix]) => `/admin${suffix}` === path)?.[1];
  const review = async (status: "approved" | "declined") => {
    if (!selected) return;
    setBusy(true);
    try {
      await adminService.reviewDemo(selected.id, status);
      retry();
      setSelected(null);
      notify(import.meta.env.VITE_API_MODE === "rest" ? `Request ${status}.` : `Request ${status} in this demo session.`);
    } catch (failure) {
      notify(failure instanceof Error ? failure.message : "The request could not be updated. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <DashboardShell
      title="Studio management"
      name="Elysian team"
      base="/admin"
      links={links}
    >
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} retry={retry} />
      ) : data && title ? (
        <>
          <PageHeading
            title={path === "/admin" ? "The studio at a glance." : title}
            description="Manage sample marketplace records in the Elysian demo workspace."
          />
          {path === "/admin" && (
            <>
              <div className="statGrid">
                <Link to="/admin/collaborations">
                  <span>Pending requests</span>
                  <strong>{data.summary.pending}</strong>
                  <small>Makers waiting for review</small>
                </Link>
                <Link to="/admin/products">
                  <span>Products</span>
                  <strong>{data.summary.products}</strong>
                  <small>Across {data.summary.creators} studios</small>
                </Link>
                <Link to="/admin/orders">
                  <span>Sample orders</span>
                  <strong>{data.summary.orders}</strong>
                  <small>Illustrative transactions</small>
                </Link>
                <Link to="/admin/inventory">
                  <span>Inventory alerts</span>
                  <strong>{data.summary.lowStock}</strong>
                  <small>Pieces with fewer than 4 left</small>
                </Link>
              </div>
              <h2 className="dashboardSubhead">
                Waiting for a thoughtful look
              </h2>
              <div className="requestList">
                {data.collaborations
                  .filter((c) => c.status === "pending")
                  .map((c) => (
                    <button key={c.id} onClick={() => setSelected(c)}>
                      <div>
                        <strong>{c.creatorName}</strong>
                        <span>{c.description}</span>
                      </div>
                      <Badge>Review request</Badge>
                    </button>
                  ))}
              </div>
              <h2 className="dashboardSubhead">Recent sample orders</h2>
              <OrdersTable orders={data.orders} />
            </>
          )}
          {path === "/admin/users" && (
            <div className="tableScroll">
              <table>
                <caption className="srOnly">Demo users</caption>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <Badge>{u.role}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {path === "/admin/creators" && (
            <div className="tableScroll">
              <table>
                <caption className="srOnly">Creators</caption>
                <thead>
                  <tr>
                    <th>Creator</th>
                    <th>Studio</th>
                    <th>Location</th>
                    <th>Products</th>
                  </tr>
                </thead>
                <tbody>
                  {data.creators.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link className="textLink" to={`/creators/${c.id}`}>
                          {c.name}
                        </Link>
                      </td>
                      <td>{c.studio}</td>
                      <td>{c.location}</td>
                      <td>
                        {
                          data.products.filter((p) => p.creatorId === c.id)
                            .length
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {path === "/admin/collaborations" && (
            <div className="tableScroll">
              <table>
                <caption className="srOnly">
                  Creator collaboration requests
                </caption>
                <thead>
                  <tr>
                    <th>Maker</th>
                    <th>Craft</th>
                    <th>Received</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.collaborations.map((c) => (
                    <tr key={c.id}>
                      <td>{c.creatorName}</td>
                      <td>
                        {
                          data.categories.find((cat) => cat.id === c.categoryId)
                            ?.name
                        }
                      </td>
                      <td>{formatDate(c.date)}</td>
                      <td>
                        <Badge>{c.status}</Badge>
                      </td>
                      <td>
                        <button
                          className="textButton"
                          onClick={() => setSelected(c)}
                        >
                          Review<span className="srOnly"> {c.creatorName}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(path === "/admin/products" || path === "/admin/inventory") && (
            <div className="tableScroll">
              <table>
                <caption className="srOnly">{title}</caption>
                <thead>
                  <tr>
                    <th>Piece</th>
                    <th>Creator</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>
                      {path === "/admin/inventory"
                        ? "Inventory health"
                        : "Status"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.products]
                    .sort((a, b) =>
                      path === "/admin/inventory" ? a.stock - b.stock : 0,
                    )
                    .map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div className="tableProduct">
                            <img src={p.images[0]} alt="" />
                            <span>{p.name}</span>
                          </div>
                        </td>
                        <td>
                          {
                            data.creators.find((c) => c.id === p.creatorId)
                              ?.name
                          }
                        </td>
                        <td>{formatPrice(p.price)}</td>
                        <td>{p.stock}</td>
                        <td>
                          <Badge>
                            {path === "/admin/inventory"
                              ? p.stock === 0
                                ? "Out of stock"
                                : p.stock < 4
                                  ? "Low stock"
                                  : "In stock"
                              : p.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
          {path === "/admin/categories" && (
            <div className="tableScroll">
              <table>
                <caption className="srOnly">Categories</caption>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Products</th>
                  </tr>
                </thead>
                <tbody>
                  {data.categories.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{c.description}</td>
                      <td>
                        {
                          data.products.filter((p) => p.categoryId === c.id)
                            .length
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {path === "/admin/orders" && <OrdersTable orders={data.orders} />}
          {path === "/admin/payments" && (
            <>
              <p className="noticeBox">
                {import.meta.env.VITE_API_MODE === "rest"
                  ? "Razorpay sandbox and sample payment records. No real funds have moved."
                  : "These are illustrative payment records. No payment processor is connected and no funds have moved."}
              </p>
              <div className="tableScroll">
                <table>
                  <caption className="srOnly">Illustrative payments</caption>
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Order</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((p) => (
                      <tr key={p.id}>
                        <td>{p.id}</td>
                        <td>{p.orderId}</td>
                        <td>{formatPrice(p.amount)}</td>
                        <td>{p.method}</td>
                        <td>
                          <Badge>{p.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      ) : (
        <EmptyState
          title="Management page not found."
          description="Return to the studio overview."
          href="/admin"
          label="Studio overview"
        />
      )}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Review collaboration"
      >
        {selected && (
          <>
            <Badge>{selected.status}</Badge>
            <h3>{selected.creatorName}</h3>
            <p>{selected.email}</p>
            <p>{selected.description}</p>
            <p className="muted">
              {import.meta.env.VITE_API_MODE === "rest"
                ? "Approval creates a creator profile and grants access to the signed-in applicant's account. Older unlinked applications must be resubmitted. No email is sent."
                : "Demo review only. Decisions are saved in this browser; no creator access or email is provided."}
            </p>
            {selected.status === "pending" ? (
              <div className="buttonRow">
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => review("approved")}
                >
                  Approve application
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => review("declined")}
                >
                  Decline application
                </button>
              </div>
            ) : (
              <p>This request has already been {selected.status}.</p>
            )}
          </>
        )}
      </Modal>
    </DashboardShell>
  );
}
