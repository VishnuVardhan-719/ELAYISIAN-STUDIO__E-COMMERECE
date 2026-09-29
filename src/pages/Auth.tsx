import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Arrow, Field, PageHeading } from "../components/ui";
import { HOME_BY_ROLE, useAuth } from "../context/AuthContext";
import { useStudio } from "../context/StudioContext";
import { DEMO_PASSWORD } from "../services/api";

const DEMO_ACCOUNTS: [string, string, string][] = [
  ["ananya@example.test", "customer", "Ananya (collector)"],
  ["mira@example.test", "creator", "Mira (maker)"],
  ["studio@example.test", "admin", "Studio team (admin)"],
];

export default function Auth({ mode }: { mode: "login" | "register" }) {
  const { login, register } = useAuth();
  const { notify } = useStudio();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const from = (location.state as { from?: string } | null)?.from;

  const finish = (name: string, role: keyof typeof HOME_BY_ROLE) => {
    notify(`Welcome${mode === "login" ? " back" : ""}, ${name.split(" ")[0]}.`);
    navigate(from || HOME_BY_ROLE[role], { replace: true });
  };

  const run = async (action: () => Promise<{ name: string; role: keyof typeof HOME_BY_ROLE }>) => {
    setBusy(true);
    setError("");
    try {
      const user = await action();
      finish(user.name, user.role);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "That did not work. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page narrowPage">
      <PageHeading
        eyebrow={mode === "login" ? "Welcome back" : "Join the studio"}
        title={mode === "login" ? "Sign in." : "Create your account."}
        description={
          mode === "login"
            ? "Your bag, wishlist and orders, kept together."
            : "A place for the pieces you collect, and the makers you follow."
        }
      />
      <form
        className="checkoutForm"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const email = String(data.get("email") || "");
          const password = String(data.get("password") || "");
          if (mode === "login") void run(() => login(email, password));
          else
            void run(() =>
              register({ name: String(data.get("name") || ""), email, password }),
            );
        }}
      >
        {mode === "register" && (
          <Field
            label="Full name"
            name="name"
            autoComplete="name"
            minLength={2}
            required
          />
        )}
        <Field
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={mode === "register" ? 8 : undefined}
          required
        />
        {error && (
          <p className="fieldError" role="alert">
            {error}
          </p>
        )}
        <button className="button" disabled={busy}>
          {busy
            ? "One moment…"
            : mode === "login"
              ? "Sign in"
              : "Create account"}
          {!busy && <Arrow />}
        </button>
      </form>

      {mode === "login" ? (
        <>
          <p className="muted">
            New here? <Link className="textLink" to="/register">Create an account</Link>
          </p>
          <section className="infoSection">
            <h2>Demo accounts</h2>
            <p>
              Every seeded account shares the password{" "}
              <code>{DEMO_PASSWORD}</code>. Pick one to explore the role.
            </p>
            <div className="demoAccounts">
              {DEMO_ACCOUNTS.map(([email, role, label]) => (
                <button
                  key={email}
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void run(() => login(email, DEMO_PASSWORD))}
                >
                  {label}
                  <span className="muted"> · {role}</span>
                </button>
              ))}
            </div>
          </section>
        </>
      ) : (
        <p className="muted">
          Already have an account?{" "}
          <Link className="textLink" to="/login">
            Sign in
          </Link>
        </p>
      )}
    </div>
  );
}
