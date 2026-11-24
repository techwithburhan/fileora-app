/** Tool lists that follow App Center (hidden tools removed, re-rendered when settings change). */
import { useMemo } from 'react';
import { Tool, TOOLS, isHidden, toolById } from '../data/tools';
import { useRemote } from './remote';

export function useVisibleTools(): Tool[] {
  const config = useRemote(s => s.config);
  return useMemo(() => TOOLS.filter(t => !isHidden(t)), [config]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Popular tools chosen in App Center, or null to use each person's own. */
export function useRemotePopular(): Tool[] | null {
  const config = useRemote(s => s.config);
  return useMemo(() => {
    const ids = config?.popular ?? [];
    const list = ids.map(id => toolById(id)).filter((t): t is Tool => !!t && !isHidden(t));
    return list.length ? list : null;
  }, [config]);
}
