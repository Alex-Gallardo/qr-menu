/** Skeleton del contenido al navegar entre secciones (el marco ya está en pantalla). */
export default function PanelLoading() {
  return (
    <div
      className="mx-auto grid max-w-5xl animate-pulse gap-4 px-4 py-6 lg:px-8 lg:py-10"
      aria-hidden
    >
      <div className="h-9 w-48 rounded-md bg-muted" />
      <div className="h-4 w-72 max-w-full rounded-sm bg-muted" />
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
