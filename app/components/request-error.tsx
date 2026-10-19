export function RequestError({ message, retry }: { message: string; retry: string }) {
  return (
    <main className="shell">
      <h1>Could not load ChoreCycle</h1>
      <p className="error" role="alert">{message}</p>
      <a className="button" href={retry}>Try again</a>
    </main>
  );
}
