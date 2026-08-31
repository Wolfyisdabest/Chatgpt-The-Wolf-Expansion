// ChatGPT selectors are intentionally confined to this adapter directory.
export const CHATGPT_SELECTORS = {
  sidebarCandidates: [
    'nav[aria-label="Chat history"]',
    'nav[aria-label*="Chat"]',
    "aside nav",
    "nav",
  ],
  conversationLink: 'a[href^="/c/"], a[href^="https://chatgpt.com/c/"]',
  menu: '[role="menu"], [data-radix-menu-content], [data-headlessui-menu-items]',
  menuItem: '[role="menuitem"]',
  button: 'button, [role="button"]',
  currentConversationMenuRegion:
    'main header, [data-testid="conversation-header"], header[data-testid*="header"]',
} as const;
