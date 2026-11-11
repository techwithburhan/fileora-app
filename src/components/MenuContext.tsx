import React, { createContext, useContext, useMemo, useState } from 'react';

type Menu = { visible: boolean; open: () => void; close: () => void };
const Ctx = createContext<Menu>({ visible: false, open: () => {}, close: () => {} });

export function MenuProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const value = useMemo(() => ({ visible, open: () => setVisible(true), close: () => setVisible(false) }), [visible]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useMenu = () => useContext(Ctx);
