import {
  useEffect,
  useRef,
  type ReactNode,
  type InputHTMLAttributes,
} from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Minus,
  Plus,
  X,
  PackageOpen,
  RotateCcw,
} from "lucide-react";
export function Arrow({ size = 18 }: { size?: number }) {
  return <ArrowUpRight size={size} strokeWidth={1.5} aria-hidden="true" />;
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="pageHeading">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p className="lede">{description}</p>}
      {children}
    </header>
  );
}
export function EmptyState({
  title,
  description,
  href,
  label = "Explore the shop",
}: {
  title: string;
  description: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="emptyState">
      <PackageOpen size={38} strokeWidth={1} />
      <h2>{title}</h2>
      <p>{description}</p>
      {href && (
        <Link className="button" to={href}>
          {label}
          <Arrow />
        </Link>
      )}
    </div>
  );
}
export function LoadingState() {
  return (
    <div className="loadingState" role="status">
      <span className="srOnly">Loading the studio…</span>
      <div className="skeleton titleSkeleton" />
      <div className="skeletonGrid">
        {[1, 2, 3].map((i) => (
          <div className="skeleton" key={i} />
        ))}
      </div>
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="emptyState" role="alert">
      <h2>A little interruption.</h2>
      <p>{message}</p>
      <button className="button" onClick={retry}>
        Try again
        <RotateCcw size={16} />
      </button>
    </div>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}
export function Quantity({
  value,
  max,
  onChange,
  disabled = false,
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="quantity" aria-label="Quantity">
      <button
        aria-label="Decrease quantity"
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={14} />
      </button>
      <span aria-live="polite">{value}</span>
      <button
        aria-label="Increase quantity"
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
export function Field({
  label,
  error,
  children,
  ...input
}: {
  label: string;
  error?: string;
  children?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = input.id || input.name || label.toLowerCase().replaceAll(" ", "-");
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children || (
        <input
          {...input}
          id={id}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      )}{" "}
      {error && (
        <span id={`${id}-error`} className="fieldError">
          {error}
        </span>
      )}
    </div>
  );
}
export function Modal({
  open,
  onClose,
  title,
  children,
  drawer = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
    if (open) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previous;
      };
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`modal ${drawer ? "drawer" : ""}`}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modalHeader">
        <h2>{title}</h2>
        <button
          className="iconButton"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function DemoNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className="demoNotice">
      <span className="demoDot" />
      Demo workspace
      {!compact && (
        <span>Sample data. Changes stay in this browser session.</span>
      )}
    </div>
  );
}
