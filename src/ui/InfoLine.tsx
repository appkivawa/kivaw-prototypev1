import Popover from "./Popover";

type InfoLineProps = {
  title: string;
  body: string;
};

export default function InfoLine({ title, body }: InfoLineProps) {
  return (
    <div className="infoline">
      <span className="infoline__text">{title}</span>
      <Popover
        label={title}
        content={
          <div>
            <div className="popover__title">{title}</div>
            <p>{body}</p>
          </div>
        }
      >
        <span className="popover__icon">i</span>
      </Popover>
    </div>
  );
}
