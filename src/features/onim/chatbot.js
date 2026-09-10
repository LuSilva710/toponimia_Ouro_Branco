/**
 * @deprecated Migrado para React — monte `<OnimChatbot />` em `OnimChatbot.jsx`.
 * Domínio: `onimService.js`, `onim-chain.js`, `onim-tools.js`.
 */
export function initChatbot() {
  console.warn(
    '[ONIM] initChatbot() foi removido. Use o componente React <OnimChatbot /> na Home.',
  )
}

export { OnimChatbot } from './OnimChatbot.jsx'
