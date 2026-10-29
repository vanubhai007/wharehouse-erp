import Reveal from './Reveal.jsx';

export default function SectionHeading({ eyebrow, title, subtitle, accentWord }) {
  return (
    <Reveal className="section-heading">
      <span className="section-eyebrow">{eyebrow}</span>
      <h2 className="section-title">
        {accentWord ? (
          <>
            {title.replace(accentWord, '')}
            <span className="accent">{accentWord}</span>
          </>
        ) : (
          title
        )}
      </h2>
      {subtitle ? <p>{subtitle}</p> : null}
    </Reveal>
  );
}
