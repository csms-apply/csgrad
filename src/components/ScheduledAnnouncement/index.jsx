import React, {useEffect, useState} from 'react';

// Keep server rendering and initial hydration identical. Visitors with the page
// already open also see the announcement when its publication time arrives.
export default function ScheduledAnnouncement({publishAt, children}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const deadline = Date.parse(publishAt);
    if (!Number.isFinite(deadline)) return undefined;
    let timer;
    const check = () => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        setVisible(true);
      } else {
        timer = setTimeout(check, Math.min(remaining, 60_000));
      }
    };
    check();
    return () => clearTimeout(timer);
  }, [publishAt]);
  return visible ? <>{children}</> : null;
}
