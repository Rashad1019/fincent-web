export function Hero() {
  return (
    <section className="hero">
      <div className="kicker">Fincent / no jargon</div>
      <h1>Know what you&apos;re buying.</h1>
      <p>What it is. What it&apos;s worth today. Whether now&apos;s the time. Explained like a friend would.</p>
    </section>
  );
}

export function PageHeader({ title, kicker, description }: { title: string; kicker: string; description: string }) {
  return (
    <header className="page-header">
      <div className="kicker">{kicker}</div>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}
