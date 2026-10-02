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
          "Elysian Studio is a full-stack demonstration for a Database Systems Engineering project. A live support channel has not been connected.",
        ],
        [
          "For makers",
          "Use the collaboration form to submit a demonstration application. Validated applications are saved for administrator review.",
        ],
        [
          "For collectors",
          "Explore the product pages for materials, dimensions and indicative shipping details. Checkout creates demonstration orders only; no real purchases are fulfilled.",
        ],
      ],
    },
    "/shipping": {
      title: "From their hands to your home.",
      intro: "Thoughtful details for the journey ahead.",
      sections: [
        [
          "Shipping preview",
          "The demo estimates delivery in 5–8 working days within India. Estimated shipping is ₹150, or complimentary for baskets of ₹3,000 or more. The expo demo bookmark has zero shipping when purchased on its own. These are demonstration estimates, not delivery promises.",
        ],
        [
          "Handmade takes its own time",
          "Small differences in colour, texture and shape are part of handmade work. Individual maker lead times will be shown before live checkout.",
        ],
        [
          "Returns at launch",
          "Return eligibility, damage reporting and refunds will be confirmed in the live store’s published policy. This demo records sample orders but does not fulfil purchases or process real refunds.",
        ],
      ],
    },
    "/privacy": {
      title: "Your details, treated thoughtfully.",
      intro: "How this demonstration handles information.",
      sections: [
        [
          "Stored on this device",
          "Guest shopping bags, saved items and session tokens use browser storage. Signed-in account and order records are stored in MongoDB. Clearing browser data does not delete server-side records. Use fictional details for this expo demonstration.",
        ],
        [
          "Forms and uploads",
          "Account registrations, addresses and collaboration applications are sent to the backend and saved in MongoDB. Passwords are stored as hashes. Image files are not uploaded and newsletter subscriptions are not connected. Do not enter sensitive personal information for this demonstration.",
        ],
        [
          "External connections",
          "The app’s fonts and images are bundled locally. When enabled, Razorpay test mode sends checkout requests to Razorpay and stores sandbox payment references on our server. No real money is charged. External services and links have their own privacy practices. Application analytics tracking is not enabled.",
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
          "The application is intended for original work created by the applicant. It sends a demonstration request for administrator review, but does not form a commercial agreement.",
        ],
        [
          "Future launch",
          "Live marketplace terms, payment conditions, returns, and creator agreements must be defined before real commerce is enabled. Sandbox checkout is for educational demonstrations only.",
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
