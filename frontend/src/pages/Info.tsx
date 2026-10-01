import { Link, useLocation } from "react-router-dom";
import { assets } from "../data/assets";
import { Arrow, EmptyState, PageHeading } from "../components/ui";
export default function Info() {
  const { pathname } = useLocation();
  if (pathname === "/about")
    return (
      <div className="container page">
        <PageHeading
          eyebrow="Why we’re here"
          title="A little more human."
          description="We believe the things around us should have something to say."
        />
        <div className="editorialPage">
          <img
            src={assets.ceramics}
            alt="Handmade ceramic pieces, each with its own character"
          />
          <div>
            <h2>
              Made by people.
              <br />
              Found with feeling.
            </h2>
            <p>
              Elysian began with a simple observation: the objects we keep
              longest are often the ones with a story. A cup shaped by a potter.
              A textile woven over patient afternoons. A painting that feels
              like a place we’ve been.
            </p>
            <p>
              We’re building a considered marketplace for independent Indian
              makers and the people who love their work. A space where the
              creator is as visible as the creation.
            </p>
            <p>
              Each piece in this demonstration tells an illustrative maker
              story. Our purpose is to show how discovery, collaboration and
              thoughtful commerce can live together.
            </p>
            <Link className="button" to="/creators">
              Meet the makers
              <Arrow />
            </Link>
          </div>
        </div>
      </div>
    );
  const pages: Record<
    string,
    { title: string; intro: string; sections: [string, string][] }
  > = {
    "/contact": {
      title: "Let’s talk.",
      intro:
        "For questions about a piece, a maker, or finding your place here.",
      sections: [
        [
          "About this studio",
          "Elysian Studio is currently a frontend demonstration for a Database Systems Engineering project. A live support channel has not been connected.",
        ],
        [
          "For makers",
          "Use the collaboration form to prepare an application preview. It validates your details without sending them.",
        ],
        [
          "For collectors",
          "Explore the product pages for materials, dimensions and indicative shipping details. Ordering will be enabled when the live service launches.",
        ],
      ],
    },
    "/shipping": {
      title: "From their hands to your home.",
      intro: "Thoughtful details for the journey ahead.",
      sections: [
        [
          "Shipping preview",
          "The demo estimates delivery in 5–8 working days within India. Estimated shipping is ₹150, or complimentary for baskets of ₹3,000 or more.",
        ],
        [
          "Handmade takes its own time",
          "Small differences in colour, texture and shape are part of handmade work. Individual maker lead times will be shown before live checkout.",
        ],
        [
          "Returns at launch",
          "Return eligibility, damage reporting and refunds will be confirmed in the live store’s published policy. This demo cannot accept orders or process returns.",
        ],
      ],
    },
    "/privacy": {
      title: "Your details, treated thoughtfully.",
      intro: "How this frontend demonstration handles information.",
      sections: [
        [
          "Stored on this device",
          "Your shopping bag and wishlist are stored in your browser’s local storage. Clear the site’s browser data to remove them.",
        ],
        [
          "Forms and uploads",
          "Form entries are held in memory during this session. Application images stay on your device; no uploads, newsletter subscriptions or account registrations are transmitted.",
        ],
        [
          "External connections",
          "The app’s fonts and images are bundled locally. External links, such as Instagram, have their own privacy practices. This demonstration has no analytics or payment tracking.",
        ],
      ],
    },
    "/terms": {
      title: "A shared understanding.",
      intro: "The boundaries of this demonstration.",
      sections: [
        [
          "Demonstration only",
          "Products, makers, prices, orders and accounts are illustrative sample data. They are not offers for sale or evidence of real transactions.",
        ],
        [
          "Creator collaboration",
          "The application preview is intended for original work created by the applicant. It does not send a request, grant approval, or form a commercial agreement.",
        ],
        [
          "Future launch",
          "Live marketplace terms, payment conditions, returns, and creator agreements must be defined before commerce is enabled.",
        ],
      ],
    },
  };
  const page = pages[pathname];
  if (!page)
    return (
      <EmptyState
        title="A little off the beaten path."
        description="This page isn’t part of the collection. Let’s take you somewhere lovely."
        href="/"
        label="Back to the studio"
      />
    );
  return (
    <div className="container page narrowPage">
      <PageHeading title={page.title} description={page.intro} />
      {page.sections.map(([title, copy]) => (
        <section className="infoSection" key={title}>
          <h2>{title}</h2>
          <p>{copy}</p>
        </section>
      ))}
      {pathname === "/contact" && (
        <Link className="button" to="/become-a-creator">
          For creators
          <Arrow />
        </Link>
      )}
    </div>
  );
}
