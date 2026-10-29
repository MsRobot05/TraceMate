import { useApp } from '../context/AppContext.jsx';
import AuthModal from './AuthModal.jsx';
import ProfileModal from './ProfileModal.jsx';
import ReportFormModal from './ReportFormModal.jsx';
import ClaimModal from './ClaimModal.jsx';
import AssistantModal from './AssistantModal.jsx';
import MatchModal from './MatchModal.jsx';
import FlagModal from './FlagModal.jsx';

/** Renders whichever modal is active. Each modal receives its payload via context. */
export default function ModalHost() {
  const { modal } = useApp();
  if (!modal) return null;
  switch (modal.name) {
    case 'auth': return <AuthModal />;
    case 'profile': return <ProfileModal />;
    case 'report': return <ReportFormModal item={modal.payload} />;
    case 'claim': return <ClaimModal item={modal.payload} />;
    case 'assistant': return <AssistantModal />;
    case 'matches': return <MatchModal item={modal.payload} />;
    case 'flag': return <FlagModal item={modal.payload} />;
    default: return null;
  }
}
