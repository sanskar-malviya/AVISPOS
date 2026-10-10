/**
 * Browser-print fallback: renders the receipt HTML into a hidden iframe and
 * opens the system print dialog. Works on any device, but the browser always
 * shows a dialog (silent printing is not possible from a normal web page) and
 * we cannot know whether the user actually printed — so callers must describe
 * the result as "print dialog opened", never "printed".
 */
export function printHtmlViaBrowser(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    Object.assign(iframe.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '0',
      height: '0',
      border: '0',
    });

    let removed = false;
    const remove = () => {
      if (!removed) {
        removed = true;
        iframe.remove();
      }
    };

    iframe.onload = () => {
      const w = iframe.contentWindow;
      if (!w) {
        remove();
        reject(new Error('Could not open the print preview.'));
        return;
      }
      w.addEventListener('afterprint', () => setTimeout(remove, 500));
      setTimeout(remove, 120_000); // safety net
      try {
        w.focus();
        w.print();
        resolve();
      } catch (e) {
        remove();
        reject(e);
      }
    };

    document.body.appendChild(iframe);
    iframe.srcdoc = html;
  });
}
