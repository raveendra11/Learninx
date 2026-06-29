export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p className="text-slate-400">
        That page doesn't exist. Try the{' '}
        <a href="/lessons" className="text-terminal-accent hover:underline">
          lesson list
        </a>
        .
      </p>
    </div>
  );
}
