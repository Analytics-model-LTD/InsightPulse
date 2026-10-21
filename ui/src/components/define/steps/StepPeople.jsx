import { useDispatch, useSelector } from 'react-redux';
import { addRecipient, selectCurrentSet } from '../../../features/kpiSets/kpiSetsSlice';
import Icon from '../../common/Icon';
import RecipientCard from '../RecipientCard';

export default function StepPeople() {
  const dispatch = useDispatch();
  const { measures, alerting } = useSelector(selectCurrentSet);
  const recipients = alerting.recipients;

  return (
    <>
      <div className="stack">
        {recipients.length ? (
          recipients.map((r, i) => <RecipientCard key={r.uid} r={r} index={i} measures={measures} />)
        ) : (
          <div className="empty">Nobody is set to get alerts yet. Add the first person or team.</div>
        )}
      </div>
      <button className="add-block" onClick={() => dispatch(addRecipient())}>
        <Icon name="plus" size={18} /> Add a person or team
      </button>
    </>
  );
}
