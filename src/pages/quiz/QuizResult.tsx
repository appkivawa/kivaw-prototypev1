type RecItem = {
  id: string;
  title: string;
};

function buildMockResults(_state: string, focus: string): RecItem[] {
  return [
    { id: "1", title: `Sample for ${focus}` },
    { id: "2", title: "Another suggestion" },
  ];
}

export default function QuizResult() {
  const results = buildMockResults("any", "focus");

  return (
    <div className="page">
      <div className="center-wrap">
        <h1>Results</h1>

        {results.map((r) => (
          <div key={r.id}>{r.title}</div>
        ))}
      </div>
    </div>
  );
}



















