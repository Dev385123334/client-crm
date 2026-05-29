import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { getBaseRole } from '../../utils/helpers';

export default function SecurityLayer({ children }) {
  const { userRole } = useContext(AuthContext);
  const isAdmin = getBaseRole(userRole) === 'admin';
  const [blurred, setBlurred] = useState(false);

  useEffect(() => {
    if (isAdmin) return;

    const preventDefault = (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    const onContextMenu = (e) => preventDefault(e);
    const onCopy = (e) => preventDefault(e);
    const onCut = (e) => preventDefault(e);
    const onDragStart = (e) => preventDefault(e);

    const onKeyDown = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl) {
        if (['a', 'c', 's', 'u', 'p'].includes(e.key.toLowerCase())) {
          preventDefault(e);
        }
      }
      if (e.key === 'F12' || e.key === 'PrintScreen') {
        preventDefault(e);
      }
    };

    const onBlur = () => setBlurred(true);
    const onFocus = () => setBlurred(false);

    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    document.addEventListener('dragstart', onDragStart);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      setBlurred(document.hidden);
    });

    return () => {
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('dragstart', onDragStart);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [isAdmin]);

  if (isAdmin) return children;

  return (
    <div className="security-protected">
      {blurred && <div className="security-overlay">Content hidden</div>}
      <div className={blurred ? 'security-blurred' : ''}>
        {children}
      </div>
    </div>
  );
}
