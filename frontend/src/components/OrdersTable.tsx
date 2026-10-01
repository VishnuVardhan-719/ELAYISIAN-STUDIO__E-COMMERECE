import type { Order } from "../types/domain";
import { Badge, EmptyState } from "./ui";
import { formatDate, formatPrice } from "../utils/commerce";
export function OrdersTable({ orders }: { orders: Order[] }) {
  return orders.length ? (
    <div className="tableScroll">
      <table>
        <caption className="srOnly">Sample orders</caption>
        <thead>
          <tr>
            <th>Order</th>
            <th>Date</th>
            <th>Pieces</th>
            <th>Total</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.id}</td>
              <td>{formatDate(o.date)}</td>
              <td>
                {o.items.map((i) => (
                  <span className="block" key={i.productId}>
                    {i.name} × {i.quantity}
                  </span>
                ))}
              </td>
              <td>{formatPrice(o.total)}</td>
              <td>
                <Badge>{o.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyState
      title="No orders just yet."
      description="Your next thoughtful find will have a place here."
      href="/shop"
    />
  );
}
