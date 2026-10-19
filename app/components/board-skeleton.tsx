export function BoardSkeleton() {
  return (
    <section className="board" aria-label="Room chores" aria-busy="true">
      <div className="board-heading"><h2>Chores</h2></div>
      <p role="status">Loading chores…</p>
      <ul className="chore-list" aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <li key={row} className="chore-row skeleton-row">
            <div className="chore-details">
              <div className="skeleton-line skeleton-title" />
              <div className="skeleton-line skeleton-detail" />
            </div>
            <div className="skeleton-action" />
          </li>
        ))}
      </ul>
    </section>
  );
}
