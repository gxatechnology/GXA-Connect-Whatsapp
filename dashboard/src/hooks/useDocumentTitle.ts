import { useEffect } from 'react';

/**
 * Custom hook to set document title dynamically.
 * Automatically appends " | GXA Technologies" suffix.
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | GXA Technologies`;

    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}
