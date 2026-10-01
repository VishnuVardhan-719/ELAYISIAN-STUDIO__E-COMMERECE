import { Component, lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { StudioProvider } from "./context/StudioContext";
import { LoadingState } from "./components/ui";
import Home from "./pages/Home";
const Shop = lazy(() => import("./pages/Shop"));
const Product = lazy(() => import("./pages/Product"));
const Collections = lazy(() =>
  import("./pages/Discovery").then((m) => ({ default: m.Collections })),
);
const Creators = lazy(() =>
  import("./pages/Discovery").then((m) => ({ default: m.Creators })),
);
const CreatorProfile = lazy(() =>
  import("./pages/Discovery").then((m) => ({ default: m.CreatorProfile })),
);
const BecomeCreator = lazy(() => import("./pages/BecomeCreator"));
const Auth = lazy(() => import("./pages/Auth"));
const Cart = lazy(() => import("./pages/Cart"));
const Account = lazy(() => import("./pages/Account"));
const CreatorDashboard = lazy(() => import("./pages/CreatorDashboard"));
const Admin = lazy(() => import("./pages/Admin"));
const Info = lazy(() => import("./pages/Info"));
class AppBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="emptyState" role="alert">
        <h1>The studio needs a moment.</h1>
        <p>
          Reload the page to try again. Your saved bag and wishlist will stay on
          this device.
        </p>
        <button className="button" onClick={() => window.location.reload()}>
          Reload the studio
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <AppBoundary>
      <BrowserRouter>
        <AuthProvider>
          <StudioProvider>
            <Suspense fallback={<LoadingState />}>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="shop" element={<Shop />} />
                  <Route path="products/:productId" element={<Product />} />
                  <Route path="collections" element={<Collections />} />
                  <Route
                    path="collections/:collectionSlug"
                    element={<Collections />}
                  />
                  <Route path="creators" element={<Creators />} />
                  <Route
                    path="creators/:creatorId"
                    element={<CreatorProfile />}
                  />
                  <Route path="become-a-creator" element={<BecomeCreator />} />
                  <Route path="login" element={<Auth mode="login" />} />
                  <Route path="register" element={<Auth mode="register" />} />
                  <Route path="cart" element={<Cart />} />
                  <Route path="checkout" element={<Cart checkout />} />
                  <Route
                    path="account/*"
                    element={
                      <ProtectedRoute>
                        <Account />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="creator-dashboard/*"
                    element={
                      <ProtectedRoute roles={["creator", "admin"]}>
                        <CreatorDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="admin/*"
                    element={
                      <ProtectedRoute roles={["admin"]}>
                        <Admin />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<Info />} />
                </Route>
              </Routes>
            </Suspense>
          </StudioProvider>
        </AuthProvider>
      </BrowserRouter>
    </AppBoundary>
  );
}
