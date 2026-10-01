import { Link } from "react-router-dom";
import type { Creator } from "../types/domain";
import { Arrow } from "./ui";
export function CreatorCard({ creator }: { creator: Creator }) {
  return (
    <Link className="creatorCard" to={`/creators/${creator.id}`}>
      <div className="creatorImage">
        <img
          src={creator.image}
          alt={`${creator.name}, ${creator.specialty.toLowerCase()}`}
          loading="lazy"
          width="600"
          height="650"
        />
        <span>{creator.location}</span>
      </div>
      <div className="creatorName">
        <div>
          <h3>{creator.name}</h3>
          <p>{creator.specialty}</p>
        </div>
        <span className="creatorProfileLink">View profile<Arrow size={17} /></span>
      </div>
    </Link>
  );
}
