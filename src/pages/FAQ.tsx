import Card from "../ui/Card";
import { FAQ } from "../data/faq";

export default function FAQPage() {
  return (
    <div className="page">
      <div className="center-wrap">
        <Card>
          <div className="mini-star">✦</div>
          <h1 className="h1">Guide</h1>

          <div className="guide-sub">
            A quick map of how Kivaw works — simple, on purpose.
          </div>

          <div className="faq">
            <section className="faq__item">
              <h2 className="faq__q">{FAQ.state.title}</h2>
              <p className="faq__a">{FAQ.state.body}</p>
            </section>

            <section className="faq__item">
              <h2 className="faq__q">{FAQ.focus.title}</h2>
              <p className="faq__a">{FAQ.focus.body}</p>
            </section>

            <section className="faq__item">
              <h2 className="faq__q">{FAQ.connect.title}</h2>
              <p className="faq__a">{FAQ.connect.body}</p>
            </section>
          </div>
        </Card>
      </div>
    </div>
  );
}

