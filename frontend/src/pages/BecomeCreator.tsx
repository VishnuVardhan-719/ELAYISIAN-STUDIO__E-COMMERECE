import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Upload } from "lucide-react";
import { assets } from "../data/assets";
import { categoryService, creatorService } from "../services/api";
import { useResource } from "../hooks/useResource";
import { validateCollaboration } from "../utils/commerce";
import type { Collaboration, CollaborationInput } from "../types/domain";
import { Arrow, Field } from "../components/ui";
import { useAuth } from "../context/AuthContext";
const initial: CollaborationInput = {
  name: "",
  email: "",
  categoryId: "",
  portfolio: "",
  description: "",
  reason: "",
  sample: "",
  terms: false,
};
export default function BecomeCreator() {
  const { user, ready } = useAuth();
  const [form, setForm] = useState(initial),
    [errors, setErrors] = useState<
      Partial<Record<keyof CollaborationInput, string>>
    >({}),
    [fileNames, setFileNames] = useState<string[]>([]),
    [fileError, setFileError] = useState(""),
    [busy, setBusy] = useState(false),
    [submitted, setSubmitted] = useState(false),
    [created, setCreated] = useState<Collaboration | null>(null),
    [serviceError, setServiceError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const loadCategories = useCallback(() => categoryService.list(), []);
  const { data: categoryList } = useResource(loadCategories);
  const categories = categoryList ?? [];
  const update = (key: keyof CollaborationInput, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));
  return (
    <>
      <div className="creatorOnboardingHero">
        <div>
          <p className="eyebrow">For the ones who make</p>
          <h1>
            Your hands make it.
            <br />
            We help it find a home.
          </h1>
          <p>
            Bring your craft to a community that cares about the story behind
            it. A considered space for independent artists, makers, and small
            studios across India.
          </p>
          <a href="#application" className="button">
            Share your craft
            <Arrow />
          </a>
        </div>
        <img
          src={assets.studio}
          alt="Handmade pottery in an artisan’s studio"
        />
      </div>
      <section className="container section" id="how-it-works">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">From your studio to ours</p>
            <h2>A thoughtful beginning.</h2>
          </div>
        </div>
        <ol className="processSteps">
          {[
            [
              "Tell us your story",
              "Share who you are, what you make and a few pieces you love.",
            ],
            [
              "A conversation about craft",
              "Our team reviews your application and gets to know your work.",
            ],
            [
              "Make yourself at home",
              "Approved collaborators can build their profile and showcase products.",
            ],
            [
              "Reach people who care",
              "Your work becomes part of a collection made for thoughtful discovery.",
            ],
          ].map(([title, copy], i) => (
            <li key={title}>
              <span>0{i + 1}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="applicationSection" id="application">
        <div className="container applicationLayout">
          <aside>
            <p className="eyebrow">Let’s get to know you</p>
            <h2>
              Every maker
              <br />
              has a story.
              <br />
              What’s yours?
            </h2>
            <p>
              You don’t need a large following or a polished studio. Just
              original work, a thoughtful practice, and a little love for what
              you do.
            </p>
            <p className="demoNotice">
              Applications are recorded in this browser and reviewed by the
              studio team. Images stay on your device.
            </p>
          </aside>
          {!ready ? (
            <p role="status">Loading your account…</p>
          ) : !user ? (
            <div className="successPanel">
              <h2>Sign in to share your craft.</h2>
              <Link className="button" to="/login" state={{ from: "/become-a-creator#application" }}>
                Sign in
                <Arrow />
              </Link>
            </div>
          ) : submitted ? (
            <div className="successPanel" role="status">
              <Check size={36} />
              <h2>Your application is with our studio team.</h2>
              <p>
                Application <strong>{created?.id}</strong> was received and is
                waiting for review. It now appears in the studio team’s
                collaboration queue. No images were uploaded.
              </p>
              <dl>
                <div>
                  <dt>Maker</dt>
                  <dd>{form.name}</dd>
                </div>
                <div>
                  <dt>Craft</dt>
                  <dd>
                    {categories.find((c) => c.id === form.categoryId)?.name}
                  </dd>
                </div>
                <div>
                  <dt>Samples selected</dt>
                  <dd>{fileNames.length}</dd>
                </div>
              </dl>
              <button
                className="button secondary"
                onClick={() => setSubmitted(false)}
              >
                Edit application
              </button>
            </div>
          ) : (
            <form
              ref={formRef}
              noValidate
              onSubmit={async (e) => {
                e.preventDefault();
                const application = { ...form, email: user.email };
                const next = validateCollaboration(application);
                setErrors(next);
                if (Object.keys(next).length || fileError) {
                  setTimeout(
                    () =>
                      formRef.current
                        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
                        ?.focus(),
                    0,
                  );
                  return;
                }
                setBusy(true);
                setServiceError("");
                try {
                  setCreated(
                    await creatorService.createCollaborationDraft(application),
                  );
                  setSubmitted(true);
                } catch {
                  setServiceError(
                    "Your preview could not be prepared. Please try again.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="formGrid">
                <Field
                  label="Full name"
                  name="name"
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  error={errors.name}
                  required
                />
                <Field
                  label="Email address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={user.email}
                  readOnly
                  error={errors.email}
                  required
                />
              </div>
              <Field label="Your craft" error={errors.categoryId}>
                <select
                  id="your-craft"
                  value={form.categoryId}
                  onChange={(e) => update("categoryId", e.target.value)}
                  aria-invalid={!!errors.categoryId}
                  aria-describedby={
                    errors.categoryId ? "your-craft-error" : undefined
                  }
                  required
                >
                  <option value="">Choose your craft</option>
                  {categories.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Portfolio or social link (optional)"
                name="portfolio"
                type="url"
                placeholder="https://"
                value={form.portfolio}
                onChange={(e) => update("portfolio", e.target.value)}
                error={errors.portfolio}
              />
              {(
                [
                  {
                    key: "description",
                    label: "Tell us about your work",
                    hint: "Your materials, your process, and what draws you to your craft.",
                  },
                  {
                    key: "reason",
                    label: "Why would you like to join Elysian?",
                    hint: "Tell us what you hope to find in our community.",
                  },
                  {
                    key: "sample",
                    label: "A piece you would like to share",
                    hint: "Describe a product, its materials, and an indicative price.",
                  },
                ] as const
              ).map(({ key, label, hint }) => (
                <Field key={key} label={label} id={key} error={errors[key]}>
                  <textarea
                    id={key}
                    value={form[key]}
                    placeholder={hint}
                    onChange={(e) => update(key, e.target.value)}
                    aria-invalid={!!errors[key]}
                    aria-describedby={errors[key] ? `${key}-error` : undefined}
                    rows={3}
                    required
                  />
                </Field>
              ))}
              <div className="uploadField">
                <Upload size={22} />
                <label htmlFor="samples">Select images of your work</label>
                <small>
                  Up to 5 JPG, PNG or WebP files. 5 MB each. Files stay on your
                  device.
                </small>
                <input
                  id="samples"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  aria-invalid={!!fileError}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const valid =
                      files.length <= 5 &&
                      files.every(
                        (f) =>
                          f.size <= 5 * 1024 * 1024 &&
                          ["image/jpeg", "image/png", "image/webp"].includes(
                            f.type,
                          ),
                      );
                    setFileError(
                      valid
                        ? ""
                        : "Choose up to 5 JPG, PNG or WebP images, each under 5 MB.",
                    );
                    setFileNames(valid ? files.map((f) => f.name) : []);
                  }}
                />
                {fileNames.map((n) => (
                  <span key={n}>{n}</span>
                ))}
                {fileError && <span className="fieldError">{fileError}</span>}
              </div>
              <label className="checkboxLabel">
                <input
                  type="checkbox"
                  checked={form.terms}
                  onChange={(e) => update("terms", e.target.checked)}
                  aria-invalid={!!errors.terms}
                />{" "}
                <span>
                  I create original work and agree to the{" "}
                  <Link to="/terms" className="underlined">
                    collaboration terms
                  </Link>
                  .
                </span>
              </label>
              {errors.terms && <p className="fieldError">{errors.terms}</p>}
              {serviceError && (
                <p role="alert" className="fieldError">
                  {serviceError}
                </p>
              )}
              <button className="button" disabled={busy}>
                {busy ? "Preparing preview…" : "Preview collaboration request"}
                <Arrow />
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
