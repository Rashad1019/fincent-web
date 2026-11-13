export function Hero() {
  return (
    <section className="hero">
      <div className="kicker">Fincent / independent market intelligence</div>
      <h1>
        Read the market.
        <br />
        Know the business.
      </h1>
      <p>
        Price action, intrinsic value, risk, and sixteen investor frameworks — brought into one disciplined
        research view.
      </p>
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
