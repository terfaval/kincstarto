export const metadata = {
  title: "Yogi's Choice",
};

export default function YogisChoicePage() {
  return (
    <section className="admin-stack">
      <div className="admin-card">
        <div className="admin-heading">
          <h1 className="admin-heading__title">{"Yogi's choice"}</h1>
          <p className="admin-text-muted">
            {"Admin-only előkészítő oldal a generatív tudásbázishoz."}
          </p>
        </div>
        <p className="admin-text-muted">
          {
            "Itt lesz majd a jóga pózokkal, mozdulatokkal és anatómiával kapcsolatos tudás generálása. Most még csak üres váz, későbbi bővítéshez."
          }
        </p>
      </div>
    </section>
  );
}
