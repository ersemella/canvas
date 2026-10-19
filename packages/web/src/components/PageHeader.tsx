import {createContext, useContext, useEffect, useState} from 'react';

/** What the top bar shows for the current page on phones: its title, and where Back goes. */
export interface PageHeader {
  title: string;
  backTo: string;
}

const PageHeaderContext = createContext<{
  header: PageHeader | null;
  setHeader: (header: PageHeader | null) => void;
}>({header: null, setHeader: () => {}});

export function PageHeaderProvider({children}: {children: React.ReactNode}) {
  const [header, setHeader] = useState<PageHeader | null>(null);
  return <PageHeaderContext.Provider value={{header, setHeader}}>{children}</PageHeaderContext.Provider>;
}

export function useCurrentPageHeader(): PageHeader | null {
  return useContext(PageHeaderContext).header;
}

/**
 * Puts the page's title and a back link in the top bar on phones, in place
 * of the site name, while the page is shown. A null title leaves the site name.
 */
export function usePageHeader(title: string | null | undefined, backTo = '/'): void {
  const {setHeader} = useContext(PageHeaderContext);
  useEffect(() => {
    setHeader(title ? {title, backTo} : null);
    return () => setHeader(null);
  }, [title, backTo, setHeader]);
}
