export function isTrustedPanelUrl(target, panelUrl) {
  try {
    const candidate = new URL(target);
    const panel = new URL(panelUrl);
    return ['http:', 'https:'].includes(panel.protocol)
      && !panel.username && !panel.password
      && !candidate.username && !candidate.password
      && candidate.origin === panel.origin
      && candidate.pathname === panel.pathname
      && candidate.search === panel.search;
  } catch { return false; }
}

export function isTrustedDesktopSender(event, window, panelUrl) {
  try {
    return Boolean(window && !window.isDestroyed()
      && event.sender === window.webContents
      && event.senderFrame && event.senderFrame === window.webContents.mainFrame
      && isTrustedPanelUrl(event.senderFrame.url, panelUrl));
  } catch { return false; }
}

export function createDesktopIpcHandler(getWindow, panelUrl) {
  return handler => async (event, ...args) => {
    if (!isTrustedDesktopSender(event, getWindow(), panelUrl)) throw new Error('Недоверенный источник IPC.');
    return handler(...args);
  };
}
