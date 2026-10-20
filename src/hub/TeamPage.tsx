import type { Snapshot } from "../lib/types";
import { TeamPanel } from "../team/TeamPanel";

const noop = () => undefined;

/** Every product's team on one page. */
export function TeamPage({ snapshot }: { snapshot: Snapshot }) {
  if (snapshot.pets.length === 0)
    return (
      <div className="reminders">
        <section className="card">
          <p className="setup__hint">
            Add a product first, then give it a sales co-chair, a showrunner or
            whoever it needs.
          </p>
        </section>
      </div>
    );
  return (
    <div className="reminders">
      {snapshot.pets.map((pet) => (
        <section
          key={pet.id}
          className="card"
          aria-label={`${pet.name} team section`}
        >
          <h2>{pet.name}</h2>
          <TeamPanel
            pet={pet}
            team={snapshot.teammates.filter(
              (teammate) => teammate.productId === pet.id,
            )}
            roles={snapshot.roles}
            helper={snapshot.helper}
            onTyping={noop}
          />
        </section>
      ))}
    </div>
  );
}
