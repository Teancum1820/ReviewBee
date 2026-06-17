import { CHECKLIST_STATUS_LABELS, REVIEW_CHECKLIST, type ChecklistStatus } from "../lib/checklist";

export type ChecklistFormState = Record<
  string,
  {
    status: ChecklistStatus | "";
    notes: string;
  }
>;

type ChecklistFormProps = {
  value: ChecklistFormState;
  onChange: (nextValue: ChecklistFormState) => void;
  validationAttempted?: boolean;
};

export function createInitialChecklistState(): ChecklistFormState {
  return REVIEW_CHECKLIST.reduce<ChecklistFormState>((state, item) => {
    state[item.key] = { status: "", notes: "" };
    return state;
  }, {});
}

export default function ChecklistForm({
  value,
  onChange,
  validationAttempted = false,
}: ChecklistFormProps) {
  function updateStatus(itemKey: string, status: ChecklistStatus) {
    onChange({
      ...value,
      [itemKey]: {
        status,
        notes: value[itemKey]?.notes ?? "",
      },
    });
  }

  function updateNotes(itemKey: string, notes: string) {
    onChange({
      ...value,
      [itemKey]: {
        status: value[itemKey]?.status ?? "",
        notes,
      },
    });
  }

  return (
    <div className="checklist-form">
      {REVIEW_CHECKLIST.map((item, index) => {
        const entry = value[item.key] ?? { status: "", notes: "" };
        const needsNotes = entry.status === "fail" || entry.status === "not_sure";
        const missing = validationAttempted && !entry.status;

        return (
          <section className={`checklist-item ${missing ? "checklist-item-error" : ""}`} key={item.key}>
            <div className="checklist-item-header">
              <span className="checklist-number">{index + 1}</span>
              <h3>{item.label}</h3>
            </div>

            <div className="radio-group" aria-label={`${item.label} status`}>
              {Object.entries(CHECKLIST_STATUS_LABELS).map(([status, label]) => (
                <label className="radio-pill" key={status}>
                  <input
                    type="radio"
                    name={`checklist-${item.key}`}
                    value={status}
                    checked={entry.status === status}
                    onChange={() => updateStatus(item.key, status as ChecklistStatus)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            {missing ? <p className="field-error">Choose a result for this item.</p> : null}
            {needsNotes ? <p className="field-hint">Notes are helpful when an item is not a clear pass.</p> : null}

            <label className="field-label" htmlFor={`notes-${item.key}`}>
              Notes
            </label>
            <textarea
              id={`notes-${item.key}`}
              value={entry.notes}
              onChange={(event) => updateNotes(item.key, event.target.value)}
              placeholder="Add context for the campaign owner"
              rows={3}
            />
          </section>
        );
      })}
    </div>
  );
}
